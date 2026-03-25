import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card, CardContent } from '@/components/ui/card'
import { getCompanyByOrgnr, searchCompanySummaries } from '@/lib/api/companies/service'
import {
  startAnalysisDetailed,
  getCostEstimate,
  type CostEstimate,
  type ResearchMode,
  type StartAnalysisRequest,
} from '@/lib/services/deepResearchService'
import { toast } from '@/hooks/use-toast'
import type { Company } from '@/lib/api/types'
import { Building2, Check, ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react'

const STEPS = [
  { id: 1, title: 'Company' },
  { id: 2, title: 'Research mode' },
  { id: 3, title: 'Context' },
  { id: 4, title: 'Input data' },
  { id: 5, title: 'Advanced' },
  { id: 6, title: 'Summary' },
]

const RESEARCH_MODES: { value: ResearchMode; label: string; analysisType: 'quick' | 'full' }[] = [
  { value: 'quick', label: 'Quick Screen', analysisType: 'quick' },
  { value: 'standard', label: 'Standard Deep Research', analysisType: 'full' },
  { value: 'full', label: 'Full IC Prep', analysisType: 'full' },
]

/** Prefill when opening the wizard from screening or company profile (avoids re-typing org.nr / name). */
export type ReportWizardPrefill = {
  orgnr: string
  name?: string | null
  website?: string | null
  source?: 'screening' | 'company' | 'gpt_target'
  campaignName?: string | null
}

interface NewReportWizardProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** When set and the dialog opens, company fields are resolved from the universe DB by org.nr. */
  prefill?: ReportWizardPrefill | null
  onPrefillConsumed?: () => void
}

export function NewReportWizard({
  open,
  onClose,
  onSuccess,
  prefill = null,
  onPrefillConsumed,
}: NewReportWizardProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [companySearch, setCompanySearch] = useState('')
  const [searchResults, setSearchResults] = useState<Company[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [manualCompanyName, setManualCompanyName] = useState('')
  const [manualOrgnr, setManualOrgnr] = useState('')
  const [manualWebsite, setManualWebsite] = useState('')
  const [researchMode, setResearchMode] = useState<ResearchMode>('standard')
  const [analystContext, setAnalystContext] = useState('')
  const [prioritizeMarket, setPrioritizeMarket] = useState(false)
  const [prioritizeCompetitors, setPrioritizeCompetitors] = useState(false)
  const [includeValuation, setIncludeValuation] = useState(true)
  const [refreshWebEvidence, setRefreshWebEvidence] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inputUrls, setInputUrls] = useState<string[]>([])
  const [inputUrlDraft, setInputUrlDraft] = useState('')
  const [inputNotes, setInputNotes] = useState('')
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [costEstimateLoading, setCostEstimateLoading] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [handoffSource, setHandoffSource] = useState<'screening' | 'company' | 'gpt_target' | null>(null)
  const [handoffCampaignName, setHandoffCampaignName] = useState<string | null>(null)
  /** True when handoff org.nr was not found in universe — user should verify manual fields. */
  const [prefillManualFallback, setPrefillManualFallback] = useState(false)
  const prevOpenRef = useRef(false)

  const company = selectedCompany || (manualCompanyName ? { orgnr: manualOrgnr || '', display_name: manualCompanyName, website_url: manualWebsite || undefined, has_3y_financials: false, has_homepage: !!manualWebsite } as Company : null)

  useEffect(() => {
    if (step !== 6) return
    setCostEstimateLoading(true)
    const analysisType = refreshWebEvidence ? 'refresh' : RESEARCH_MODES.find((m) => m.value === researchMode)?.analysisType ?? 'full'
    getCostEstimate(analysisType as 'full' | 'quick' | 'refresh')
      .then((est) => setCostEstimate(est ?? null))
      .catch(() => setCostEstimate(null))
      .finally(() => setCostEstimateLoading(false))
  }, [step, researchMode, refreshWebEvidence])

  const debouncedSearch = useCallback(async () => {
    if (!companySearch.trim() || companySearch.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await searchCompanySummaries(companySearch, 10)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [companySearch])

  useEffect(() => {
    const t = setTimeout(debouncedSearch, 300)
    return () => clearTimeout(t)
  }, [debouncedSearch])

  /** Resolve org.nr from screening / company profile handoff when the dialog opens. */
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    prevOpenRef.current = open
    if (!justOpened || !prefill?.orgnr || prefill.orgnr.trim().length < 4) return

    let cancelled = false
    setPrefillLoading(true)
    ;(async () => {
      try {
        const trimmedOrgnr = prefill.orgnr.trim()
        const co = await getCompanyByOrgnr(trimmedOrgnr)
        if (cancelled) return
        setSelectedCompany(null)
        setManualCompanyName('')
        setManualOrgnr('')
        setManualWebsite('')
        setCompanySearch('')
        setSearchResults([])
        setStep(1)
        if (co) {
          setSelectedCompany(co)
          setPrefillManualFallback(false)
        } else {
          setManualCompanyName(prefill.name?.trim() || '')
          setManualOrgnr(trimmedOrgnr)
          setManualWebsite(prefill.website?.trim() || '')
          setPrefillManualFallback(true)
        }
        setHandoffSource(prefill.source ?? null)
        setHandoffCampaignName(prefill.campaignName?.trim() || null)
      } finally {
        if (!cancelled) {
          setPrefillLoading(false)
          onPrefillConsumed?.()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, prefill, onPrefillConsumed])

  const handleSelectCompany = (c: Company) => {
    setSelectedCompany(c)
    setManualCompanyName('')
    setManualOrgnr('')
    setManualWebsite('')
  }

  const handleManualEntry = () => {
    setSelectedCompany(null)
    setManualCompanyName(companySearch || '')
    setManualOrgnr('')
    setManualWebsite('')
  }

  const preflightSignals = company
    ? [
        { label: 'Financials found', ok: selectedCompany?.has_3y_financials ?? false },
        { label: 'Website found', ok: !!(selectedCompany?.website_url || manualWebsite) },
        { label: 'Prior report exists', ok: false },
      ]
    : []

  const addUrl = () => {
    const u = inputUrlDraft.trim()
    if (u && !inputUrls.includes(u)) {
      setInputUrls((prev) => [...prev, u])
      setInputUrlDraft('')
    }
  }

  const removeUrl = (idx: number) => {
    setInputUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!company?.display_name && !manualCompanyName) return
    setSubmitting(true)
    try {
      const sources: { source_type: 'url' | 'note'; url?: string; raw_text?: string }[] = []
      for (const u of inputUrls) {
        if (u.trim()) sources.push({ source_type: 'url', url: u.trim() })
      }
      if (inputNotes.trim()) {
        sources.push({ source_type: 'note', raw_text: inputNotes.trim() })
      }
      const req: StartAnalysisRequest = {
        company_name: company?.display_name || manualCompanyName,
        orgnr: (company?.orgnr && company.orgnr.length >= 4 ? company.orgnr : undefined) || (manualOrgnr || undefined),
        website: company?.website_url || manualWebsite || undefined,
        query: analystContext.trim() || undefined,
        analysis_type: refreshWebEvidence ? 'refresh' : RESEARCH_MODES.find((m) => m.value === researchMode)?.analysisType ?? 'full',
        ...(sources.length > 0 && { sources }),
      }
      const result = await startAnalysisDetailed(req)
      if (result.ok) {
        onSuccess()
        onClose()
        navigate(`/deep-research/runs/${result.data.run_id}`)
      } else {
        toast({
          title: 'Could not start analysis',
          description: result.message,
          variant: 'destructive',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canProceed =
    step === 1
      ? !prefillLoading && !!(selectedCompany || (manualCompanyName.trim().length >= 2))
      : step === 2
        ? true
        : step < 6
          ? true
          : !!(company?.display_name || manualCompanyName)

  const resetOnClose = () => {
    setStep(1)
    setCompanySearch('')
    setSearchResults([])
    setSelectedCompany(null)
    setManualCompanyName('')
    setManualOrgnr('')
    setManualWebsite('')
    setResearchMode('standard')
    setAnalystContext('')
    setPrioritizeMarket(false)
    setPrioritizeCompetitors(false)
    setIncludeValuation(true)
    setRefreshWebEvidence(false)
    setInputUrls([])
    setInputUrlDraft('')
    setInputNotes('')
    setPrefillLoading(false)
    setHandoffSource(null)
    setHandoffCampaignName(null)
    setPrefillManualFallback(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetOnClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New report</DialogTitle>
          <DialogDescription id="new-report-wizard-desc">
            Step {step} of {STEPS.length}: {STEPS[step - 1].title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 1 && (
            <div className="space-y-4">
              {handoffSource && (
                <div
                  className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-foreground"
                  role="status"
                >
                  {handoffSource === 'screening' ? (
                    <>
                      <span className="font-medium">From screening</span>
                      {handoffCampaignName ? (
                        <span className="text-muted-foreground"> — campaign &quot;{handoffCampaignName}&quot;</span>
                      ) : null}
                      . Org.nr and company name are pre-filled — continue through the steps when ready.
                    </>
                  ) : handoffSource === 'gpt_target' ? (
                    <>
                      <span className="font-medium">From GPT target universe</span>
                      . Org.nr, name, and website are pre-filled when available — verify and continue.
                    </>
                  ) : (
                    <>
                      <span className="font-medium">From company profile</span>
                      . Details are pre-filled — adjust if needed and continue.
                    </>
                  )}
                  {prefillManualFallback && handoffSource ? (
                    <span className="block mt-2 text-muted-foreground">
                      This org.nr was not found in the universe registry — name and website below are from your handoff;
                      confirm or edit before running.
                    </span>
                  ) : null}
                </div>
              )}
              {prefillLoading && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading company from registry…
                </p>
              )}
              <div>
                <Label htmlFor="company-search">Search by company name or org nr</Label>
                <Input
                  id="company-search"
                  placeholder="e.g. Acme AB or 556123-4567"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="mt-2"
                />
              </div>
              {searching && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </p>
              )}
              {searchResults.length > 0 && !selectedCompany && !manualCompanyName && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Select a company</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {searchResults.map((c) => (
                      <Card
                        key={c.orgnr}
                        className="cursor-pointer transition-colors hover:border-primary/40"
                        onClick={() => handleSelectCompany(c)}
                      >
                        <CardContent className="py-2 px-3 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.display_name || c.legal_name}</p>
                            <p className="text-xs text-muted-foreground">{c.orgnr}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Button variant="ghost" size="sm" onClick={handleManualEntry}>
                  Company not found? Enter manually
                </Button>
              </div>
              {(selectedCompany || manualCompanyName) && (
                <Card>
                  <CardContent className="py-3">
                    <p className="text-sm font-medium">
                      {selectedCompany?.display_name || selectedCompany?.legal_name || manualCompanyName}
                    </p>
                    {(selectedCompany?.orgnr || manualOrgnr) && (
                      <p className="text-xs text-muted-foreground mt-1">Org nr: {selectedCompany?.orgnr || manualOrgnr}</p>
                    )}
                    {manualCompanyName && (
                      <div className="mt-2 space-y-2">
                        <Input
                          placeholder="Org nr (optional)"
                          value={manualOrgnr}
                          onChange={(e) => setManualOrgnr(e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          placeholder="Website (optional)"
                          value={manualWebsite}
                          onChange={(e) => setManualWebsite(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {RESEARCH_MODES.map((m) => (
                <Card
                  key={m.value}
                  className={`cursor-pointer transition-colors ${researchMode === m.value ? 'border-primary' : 'hover:border-primary/40'}`}
                  onClick={() => setResearchMode(m.value)}
                >
                  <CardContent className="py-3">{m.label}</CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 3 && (
            <div>
              <Label htmlFor="context">What should the report focus on? (optional)</Label>
              <textarea
                id="context"
                className="mt-2 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Focus on market expansion potential and competitor threats"
                value={analystContext}
                onChange={(e) => setAnalystContext(e.target.value)}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="input-urls" className="text-sm font-medium">
                  Add URLs to include (e.g. investor deck, press release)
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="input-urls"
                    type="url"
                    placeholder="https://..."
                    value={inputUrlDraft}
                    onChange={(e) => setInputUrlDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addUrl}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {inputUrls.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {inputUrls.map((u, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <a href={u} target="_blank" rel="noopener noreferrer" className="text-primary truncate flex-1">
                          {u}
                        </a>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeUrl(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <Label htmlFor="input-notes" className="text-sm font-medium">
                  Paste notes, comments, or extracted text from PDFs (optional)
                </Label>
                <textarea
                  id="input-notes"
                  className="mt-2 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Paste any relevant text to help the analysis..."
                  value={inputNotes}
                  onChange={(e) => setInputNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="options">
                <AccordionTrigger>Advanced settings</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prioritizeMarket}
                      onChange={(e) => setPrioritizeMarket(e.target.checked)}
                    />
                    <span className="text-sm">Prioritize market analysis</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prioritizeCompetitors}
                      onChange={(e) => setPrioritizeCompetitors(e.target.checked)}
                    />
                    <span className="text-sm">Prioritize competitor analysis</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeValuation}
                      onChange={(e) => setIncludeValuation(e.target.checked)}
                    />
                    <span className="text-sm">Include valuation</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refreshWebEvidence}
                      onChange={(e) => setRefreshWebEvidence(e.target.checked)}
                    />
                    <span className="text-sm">Refresh web evidence (vs reuse cache)</span>
                  </label>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Company</p>
                <p className="text-sm text-muted-foreground">
                  {company?.display_name || manualCompanyName}
                  {(company?.orgnr || manualOrgnr) && ` (${company?.orgnr || manualOrgnr})`}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Data signals</p>
                <ul className="space-y-1 text-sm">
                  {preflightSignals.map((s) => (
                    <li key={s.label} className="flex items-center gap-2">
                      {s.ok ? <Check className="h-4 w-4 text-green-500" /> : <span className="w-4" />}
                      {s.label}
                    </li>
                  ))}
                </ul>
              </div>
              {preflightSignals.filter((s) => !s.ok).length > 1 && (
                <p className="text-sm text-amber-600">Limited data may produce weaker output.</p>
              )}
              {(inputUrls.length > 0 || inputNotes.trim()) && (
                <div>
                  <p className="text-sm font-medium mb-2">Input data</p>
                  <p className="text-sm text-muted-foreground">
                    {inputUrls.length > 0 && `${inputUrls.length} URL(s)`}
                    {inputUrls.length > 0 && inputNotes.trim() && ' · '}
                    {inputNotes.trim() && 'Notes included'}
                  </p>
                </div>
              )}
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-medium mb-2">Estimated cost (OpenAI)</p>
                {costEstimateLoading ? (
                  <p className="text-sm text-muted-foreground">Loading estimate…</p>
                ) : costEstimate ? (
                  <p className="text-sm">
                    <span className="font-semibold text-foreground">~${costEstimate.total_usd.toFixed(2)}</span>
                    <span className="text-muted-foreground"> USD per run</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Estimate unavailable</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {step < 6 ? (
              <Button variant="primary" onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!canProceed || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  'Run report'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
