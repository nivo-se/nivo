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
            case 'pass': return 'bg-red-50 text-red-700 border-red-200'
            case 'watch': return 'bg-amber-50 text-amber-700 border-amber-200'
            default: return 'bg-gray-50 text-gray-700 border-gray-200'
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
        <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                {/* Header */}
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Workflow</p>
                    <h1 className="text-2xl font-semibold text-gray-900">Search & Analysis</h1>
                    <p className="text-sm text-gray-500">
                        Chat with the AI to filter companies, then run deep analysis to generate investment memos.
                    </p>
                </div>

                {/* Stats Grid */}
                {currentRun && (
                    <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-3">
                        <div>
                            <p className="text-xs uppercase text-gray-500">Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                {isRunning && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                                <p className="text-sm font-medium text-gray-900 capitalize">{currentRun.status.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-gray-500">Funnel</p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-900">
                                <span>{currentRun.stage1_count || 0} Filtered</span>
                                <ArrowRight className="w-3 h-3 text-gray-400" />
                                <span>{currentRun.stage2_count || 0} Researched</span>
                                <ArrowRight className="w-3 h-3 text-gray-400" />
                                <span className="font-semibold">{currentRun.stage3_count || 0} Analyzed</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase text-gray-500">Selection</p>
                            <p className="text-lg font-semibold text-gray-900">{selectedCompanies.size} companies</p>
                        </div>
                    </div>
                )}

                {/* Feedback Toast */}
                {actionFeedback && (
                    <div className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${actionFeedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' :
                        actionFeedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' :
                            'border-blue-200 bg-blue-50 text-blue-800'
                        }`}>
                        {actionFeedback.message}
                    </div>
                )}

                <div className="flex flex-col gap-6 lg:flex-row">
                    {/* Left Panel - Chat */}
                    <div className="lg:w-[400px] lg:flex-shrink-0">
                        <div className="h-[600px] rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col">
                            <ChatInterface
                                onCriteriaChange={setCriteria}
                                onStartAnalysis={startWorkflow}
                                isRunning={isRunning}
                            />
                        </div>
                    </div>

                    {/* Right Panel - Results */}
                    <div className="flex-1 space-y-4">
                        <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white min-h-[600px]">
                            <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Analysis Results</p>
                                    <p className="text-xs text-gray-500">
                                        {companies.length} companies analyzed
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={enrichSelected}
                                        disabled={selectedCompanies.size === 0}
                                        className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                    >
                                        <Sparkles className="w-3 h-3 mr-1.5" />
                                        Enrich
                                    </button>
                                    <button
                                        disabled={selectedCompanies.size === 0}
                                        className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <Download className="w-3 h-3 mr-1.5" />
                                        Export
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto">
                                {companies.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <Loader2 className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-lg font-medium text-gray-900">Ready to Analyze</p>
                                        <p className="text-sm text-center max-w-xs mt-1">
                                            Chat with the AI to define your target, then run the analysis to see investment memos here.
                                        </p>
                                    </div>
                                ) : (
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left">
                                                    <input type="checkbox" className="rounded border-gray-300" />
                                                </th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Company</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Score</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Rec</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Revenue</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Margin</th>
                                                <th className="px-4 py-3 text-left font-semibold text-gray-600">Business Model</th>
                                                <th className="px-4 py-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {companies.map((company) => (
                                                <tr
                                                    key={company.orgnr}
                                                    className="hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => setSelectedCompany(company)}
                                                >
                                                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCompanies.has(company.orgnr)}
                                                            onChange={() => toggleCompanySelection(company.orgnr)}
                                                            className="rounded border-gray-300"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{company.company_name}</div>
                                                        <div className="text-xs text-gray-500">{company.orgnr}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${company.strategic_fit_score >= 8 ? 'bg-emerald-500' :
                                                                        company.strategic_fit_score >= 5 ? 'bg-amber-500' : 'bg-red-500'
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
                                                    <td className="px-4 py-3 text-gray-600">{formatMillions(company.latest_revenue_sek)}</td>
                                                    <td className="px-4 py-3 text-gray-600">{formatPercent(company.avg_ebitda_margin)}</td>
                                                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                                                        {company.business_model || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button className="text-gray-400 hover:text-blue-600">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedCompany(null)}>
                    <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between border-b border-gray-200 p-6 bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedCompany.company_name}</h3>
                                <p className="text-sm text-gray-500">{selectedCompany.orgnr}</p>
                            </div>
                            <div className="flex gap-3">
                                <Badge className={getRecommendationColor(selectedCompany.recommendation)}>
                                    {selectedCompany.recommendation.toUpperCase()}
                                </Badge>
                                <Badge variant="outline" className="bg-white">
                                    Score: {selectedCompany.strategic_fit_score}/10
                                </Badge>
                                {selectedCompany.digital_score !== undefined && selectedCompany.digital_score > 0 && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        Digital Score: {selectedCompany.digital_score}
                                    </Badge>
                                )}
                                <button
                                    onClick={() => setSelectedCompany(null)}
                                    className="rounded-full p-1 hover:bg-gray-200"
                                >
                                    <span className="sr-only">Close</span>
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">

                            {/* Enriched Data Section */}
                            {(selectedCompany.extracted_products?.length || selectedCompany.extracted_markets?.length) ? (
                                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    {selectedCompany.extracted_products && selectedCompany.extracted_products.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase text-blue-800 mb-2">Products & Services</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedCompany.extracted_products.map((p, i) => (
                                                    <span key={i} className="px-2 py-1 bg-white text-blue-700 text-xs rounded-md border border-blue-100 shadow-sm">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedCompany.extracted_markets && selectedCompany.extracted_markets.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase text-blue-800 mb-2">Target Markets</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedCompany.extracted_markets.map((m, i) => (
                                                    <span key={i} className="px-2 py-1 bg-white text-blue-700 text-xs rounded-md border border-blue-100 shadow-sm">
                                                        {m}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedCompany.sales_channels && selectedCompany.sales_channels.length > 0 && (
                                        <div className="col-span-full">
                                            <h4 className="text-xs font-semibold uppercase text-blue-800 mb-2">Sales Channels</h4>
                                            <div className="flex gap-3">
                                                {selectedCompany.sales_channels.map((c, i) => (
                                                    <span key={i} className="font-medium text-sm text-blue-900 flex items-center gap-1">
                                                        • {c}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h3:text-gray-900 prose-p:text-gray-600">
                                <div dangerouslySetInnerHTML={{ __html: selectedCompany.investment_memo.replace(/\n/g, '<br/>') }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
