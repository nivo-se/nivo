import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChatInterface } from '@/components/analysis/ChatInterface'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, Eye, ArrowRight, Sparkles } from 'lucide-react'

interface RunStatus {
    run_id: string
    status: string
    stage: number
    stage1_count?: number
    stage2_count?: number
    stage3_count?: number
    started_at: string
    completed_at?: string
}

interface CompanyAnalysis {
    orgnr: string
    company_name: string
    strategic_fit_score: number
    recommendation: string
    business_model?: string
    products_summary?: string
    investment_memo: string
    latest_revenue_sek?: number
    avg_ebitda_margin?: number
    revenue_cagr_3y?: number
    // Enriched data
    extracted_products?: string[]
    extracted_markets?: string[]
    sales_channels?: string[]
    digital_score?: number
}

export default function AnalysisPage() {
    const navigate = useNavigate()
    const [criteria, setCriteria] = useState<any>(null)
    const [currentRun, setCurrentRun] = useState<RunStatus | null>(null)
    const [companies, setCompanies] = useState<CompanyAnalysis[]>([])
    const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
    const [isRunning, setIsRunning] = useState(false)
    const [selectedCompany, setSelectedCompany] = useState<CompanyAnalysis | null>(null)
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)

    useEffect(() => {
        if (actionFeedback) {
            const timer = setTimeout(() => setActionFeedback(null), 4000)
            return () => clearTimeout(timer)
        }
    }, [actionFeedback])

    const startWorkflow = async () => {
        if (!criteria) return

        setIsRunning(true)
        try {
            const response = await fetch('/api/analysis/start', { // Updated endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(criteria),
            })

            const data = await response.json()
            if (data.success) {
                setCurrentRun({
                    run_id: data.run_id,
                    status: data.status,
                    stage: 0,
                    started_at: new Date().toISOString(),
                })
                pollRunStatus(data.run_id)
            }
        } catch (error) {
            console.error('Failed to start workflow:', error)
            setIsRunning(false)
            setActionFeedback({ type: 'error', message: 'Failed to start analysis.' })
        }
    }

    const pollRunStatus = async (runId: string) => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/analysis/runs/${runId}`) // Updated endpoint
                const status: RunStatus = await response.json()

                setCurrentRun(status)

                if (status.status === 'complete') {
                    clearInterval(interval)
                    setIsRunning(false)
                    loadCompanies(runId)
                    setActionFeedback({ type: 'success', message: 'Analysis complete!' })
                } else if (status.status === 'failed') {
                    clearInterval(interval)
                    setIsRunning(false)
                    setActionFeedback({ type: 'error', message: 'Analysis failed.' })
                }
            } catch (error) {
                console.error('Failed to poll status:', error)
                clearInterval(interval)
                setIsRunning(false)
            }
        }, 2000)
    }

    const loadCompanies = async (runId: string) => {
        try {
            const response = await fetch(`/api/analysis/runs/${runId}/companies`) // Updated endpoint
            const data = await response.json()
            if (data.success) {
                setCompanies(data.companies)
            }
        } catch (error) {
            console.error('Failed to load companies:', error)
        }
    }

    const toggleCompanySelection = (orgnr: string) => {
        const newSelection = new Set(selectedCompanies)
        if (newSelection.has(orgnr)) {
            newSelection.delete(orgnr)
        } else {
            newSelection.add(orgnr)
        }
        setSelectedCompanies(newSelection)
    }

    const getRecommendationColor = (rec: string) => {
        switch (rec) {
            case 'buy': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
            case 'pass': return 'bg-destructive/10 text-destructive border-destructive/40'
            case 'watch': return 'bg-accent/60 text-foreground border-accent'
            default: return 'bg-muted/40 text-foreground border-border'
        }
    }

    const formatMillions = (val?: number) => val ? `${(val / 1_000_000).toFixed(1)} M` : '-'
    const formatPercent = (val?: number) => val ? `${(val * 100).toFixed(1)}%` : '-'

    const enrichSelected = async () => {
        if (selectedCompanies.size === 0) return

        setActionFeedback({ type: 'info', message: `Starting enrichment for ${selectedCompanies.size} companies...` })

        try {
            const response = await fetch('/api/enrichment/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orgnrs: Array.from(selectedCompanies) }),
            })

            const data = await response.json()
            setActionFeedback({ type: 'success', message: 'Enrichment started in background.' })
        } catch (error) {
            console.error('Failed to start enrichment:', error)
            setActionFeedback({ type: 'error', message: 'Failed to start enrichment.' })
        }
    }

    return (
        <div className="min-h-screen bg-muted/40 px-4 py-6 sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                {/* Header */}
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Workflow</p>
                    <h1 className="text-base font-semibold text-foreground">Search & Analysis</h1>
                    <p className="text-sm text-muted-foreground">
                        Chat with the AI to filter companies, then run deep analysis to generate investment memos.
                    </p>
                </div>

                {/* Stats Grid */}
                {currentRun && (
                    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-3">
                        <div>
                            <p className="text-xs uppercase text-muted-foreground">Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                {isRunning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                <p className="text-sm font-medium text-foreground capitalize">{currentRun.status.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-muted-foreground">Funnel</p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-foreground">
                                <span>{currentRun.stage1_count || 0} Filtered</span>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                <span>{currentRun.stage2_count || 0} Researched</span>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                <span className="font-semibold">{currentRun.stage3_count || 0} Analyzed</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-muted-foreground">Selection</p>
                            <p className="text-base font-semibold text-foreground">{selectedCompanies.size} companies</p>
                        </div>
                    </div>
                )}

                {/* Feedback Toast */}
                {actionFeedback && (
                    <div className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${actionFeedback.type === 'success' ? 'border-primary/40 bg-primary/10 text-primary' :
                        actionFeedback.type === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive' :
                            'border-primary/40 bg-primary/10 text-primary'
                        }`}>
                        {actionFeedback.message}
                    </div>
                )}

                <div className="flex flex-col gap-6 lg:flex-row">
                    {/* Left Panel - Chat */}
                    <div className="lg:w-[400px] lg:flex-shrink-0">
                        <div className="h-[600px] rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
                            <ChatInterface
                                onCriteriaChange={setCriteria}
                                onStartAnalysis={startWorkflow}
                                isRunning={isRunning}
                            />
                        </div>
                    </div>

                    {/* Right Panel - Results */}
                    <div className="flex-1 space-y-4">
                        <div className="flex h-full flex-col rounded-2xl border border-border bg-card min-h-[600px]">
                            <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Analysis Results</p>
                                    <p className="text-xs text-muted-foreground">
                                        {companies.length} companies analyzed
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={enrichSelected}
                                        disabled={selectedCompanies.size === 0}
                                        className="inline-flex items-center rounded-md bg-primary/10 border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
                                    >
                                        <Sparkles className="w-3 h-3 mr-1.5" />
                                        Enrich
                                    </button>
                                    <button
                                        disabled={selectedCompanies.size === 0}
                                        className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
                                    >
                                        <Download className="w-3 h-3 mr-1.5" />
                                        Export
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto">
                                {companies.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                        <div className="w-16 h-16 bg-muted/40 rounded-full flex items-center justify-center mb-4">
                                            <Loader2 className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <p className="text-base font-medium text-foreground">Ready to Analyze</p>
                                        <p className="text-sm text-center max-w-xs mt-1">
                                            Chat with the AI to define your target, then run the analysis to see investment memos here.
                                        </p>
                                    </div>
                                ) : (
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-muted/40 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left">
                                                    <input type="checkbox" className="rounded border-border" />
                                                </th>
                                                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Company</th>
                                                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Score</th>
                                                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Rec</th>
                                                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Revenue</th>
                                                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Margin</th>
                                                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Business Model</th>
                                                <th className="px-4 py-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {companies.map((company) => (
                                                <tr
                                                    key={company.orgnr}
                                                    className="hover:bg-muted/40 cursor-pointer"
                                                    onClick={() => setSelectedCompany(company)}
                                                >
                                                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCompanies.has(company.orgnr)}
                                                            onChange={() => toggleCompanySelection(company.orgnr)}
                                                            className="rounded border-border"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-foreground">{company.company_name}</div>
                                                        <div className="text-xs text-muted-foreground">{company.orgnr}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${company.strategic_fit_score >= 8 ? 'bg-emerald-500' :
                                                                        company.strategic_fit_score >= 5 ? 'bg-accent' : 'bg-destructive'
                                                                        }`}
                                                                    style={{ width: `${company.strategic_fit_score * 10}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-medium">{company.strategic_fit_score}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge className={getRecommendationColor(company.recommendation)} variant="outline">
                                                            {company.recommendation.toUpperCase()}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">{formatMillions(company.latest_revenue_sek)}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{formatPercent(company.avg_ebitda_margin)}</td>
                                                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                                                        {company.business_model || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button className="text-muted-foreground hover:text-primary">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedCompany && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-card/70 p-4" onClick={() => setSelectedCompany(null)}>
                    <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-card shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between border-b border-border p-6 bg-muted/40">
                            <div>
                                <h3 className="text-base font-bold text-foreground">{selectedCompany.company_name}</h3>
                                <p className="text-sm text-muted-foreground">{selectedCompany.orgnr}</p>
                            </div>
                            <div className="flex gap-3">
                                <Badge className={getRecommendationColor(selectedCompany.recommendation)}>
                                    {selectedCompany.recommendation.toUpperCase()}
                                </Badge>
                                <Badge variant="outline" className="bg-card">
                                    Score: {selectedCompany.strategic_fit_score}/10
                                </Badge>
                                {selectedCompany.digital_score !== undefined && selectedCompany.digital_score > 0 && (
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/40">
                                        Digital Score: {selectedCompany.digital_score}
                                    </Badge>
                                )}
                                <button
                                    onClick={() => setSelectedCompany(null)}
                                    className="rounded-full p-1 hover:bg-muted"
                                >
                                    <span className="sr-only">Close</span>
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">

                            {/* Enriched Data Section */}
                            {(selectedCompany.extracted_products?.length || selectedCompany.extracted_markets?.length) ? (
                                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-primary/10 rounded-xl border border-primary/30">
                                    {selectedCompany.extracted_products && selectedCompany.extracted_products.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase text-primary mb-2">Products & Services</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedCompany.extracted_products.map((p, i) => (
                                                    <span key={i} className="px-2 py-1 bg-card text-primary text-xs rounded-md border border-primary/30 shadow-sm">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedCompany.extracted_markets && selectedCompany.extracted_markets.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase text-primary mb-2">Target Markets</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedCompany.extracted_markets.map((m, i) => (
                                                    <span key={i} className="px-2 py-1 bg-card text-primary text-xs rounded-md border border-primary/30 shadow-sm">
                                                        {m}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedCompany.sales_channels && selectedCompany.sales_channels.length > 0 && (
                                        <div className="col-span-full">
                                            <h4 className="text-xs font-semibold uppercase text-primary mb-2">Sales Channels</h4>
                                            <div className="flex gap-3">
                                                {selectedCompany.sales_channels.map((c, i) => (
                                                    <span key={i} className="font-medium text-sm text-primary flex items-center gap-1">
                                                        • {c}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h3:text-foreground prose-p:text-muted-foreground">
                                <div dangerouslySetInnerHTML={{ __html: selectedCompany.investment_memo.replace(/\n/g, '<br/>') }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
