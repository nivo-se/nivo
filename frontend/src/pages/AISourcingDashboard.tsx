import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AIChatFilter, type PromptHistoryItem } from '../components/AIChatFilter'
import { CompanyExplorer, type CompanyRow } from '../components/CompanyExplorer'
import { apiService, type AIFilterResponse } from '../lib/apiService'
import { SavedListsService } from '../lib/savedListsService'
import { supabaseDataService } from '../lib/supabaseDataService'

const SESSION_KEYS = {
  RESULT: 'aiSourcing_aiResult',
  COMPANIES: 'aiSourcing_companies',
  PROMPT: 'aiSourcing_prompt',
  HISTORY: 'aiSourcing_history',
  PAGINATION: 'aiSourcing_pagination',
}

const DEFAULT_PAGE_SIZE = 20

type ActionFeedback = { type: 'success' | 'error' | 'info'; message: string } | null

const AISourcingDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [aiResult, setAIFilterResult] = useState<AIFilterResponse | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState('')
  const [currentWhereClause, setCurrentWhereClause] = useState<string | undefined>(undefined)
  const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>([])
  const [savedLists, setSavedLists] = useState<any[]>([])
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_PAGE_SIZE, total: 0 })
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null)
  const [enriching, setEnriching] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeProfile, setActiveProfile] = useState<CompanyRow | null>(null)
  const [selectedCompanies, setSelectedCompanies] = useState<CompanyRow[]>([])

  const clearAllData = () => {
    // Clear all session storage
    Object.values(SESSION_KEYS).forEach((key) => {
      sessionStorage.removeItem(key)
    })
    // Reset all state
    setAIFilterResult(null)
    setCompanies([])
    setCurrentPrompt('')
    setPromptHistory([])
    setPagination({ page: 1, limit: DEFAULT_PAGE_SIZE, total: 0 })
    setSelectedCompanies([])
    setActionFeedback({ type: 'success', message: 'Search cleared. Ready for new search.' })
  }

  useEffect(() => {
    try {
      const savedAiResult = sessionStorage.getItem(SESSION_KEYS.RESULT)
      const savedCompanies = sessionStorage.getItem(SESSION_KEYS.COMPANIES)
      const savedPrompt = sessionStorage.getItem(SESSION_KEYS.PROMPT)
      const savedHistory = sessionStorage.getItem(SESSION_KEYS.HISTORY)
      const savedPagination = sessionStorage.getItem(SESSION_KEYS.PAGINATION)

      // Only restore if we have data (optional: could add timestamp check for stale data)
      if (savedAiResult) {
        setAIFilterResult(JSON.parse(savedAiResult))
      }
      if (savedCompanies) {
        setCompanies(JSON.parse(savedCompanies))
      }
      if (savedPrompt) {
        setCurrentPrompt(savedPrompt)
      }
      if (savedHistory) {
        setPromptHistory(JSON.parse(savedHistory))
      }
      if (savedPagination) {
        setPagination(JSON.parse(savedPagination))
      }
    } catch (error) {
      console.error('Failed to restore dashboard session state:', error)
    }
  }, [])

  useEffect(() => {
    if (!aiResult) return
    try {
      sessionStorage.setItem(SESSION_KEYS.RESULT, JSON.stringify(aiResult))
    } catch (error) {
      console.error('Failed to persist AI result:', error)
    }
  }, [aiResult])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEYS.COMPANIES, JSON.stringify(companies))
    } catch (error) {
      console.error('Failed to persist companies:', error)
    }
  }, [companies])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEYS.PROMPT, currentPrompt)
    } catch (error) {
      console.error('Failed to persist prompt:', error)
    }
  }, [currentPrompt])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEYS.HISTORY, JSON.stringify(promptHistory))
    } catch (error) {
      console.error('Failed to persist prompt history:', error)
    }
  }, [promptHistory])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEYS.PAGINATION, JSON.stringify(pagination))
    } catch (error) {
      console.error('Failed to persist pagination:', error)
    }
  }, [pagination])

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!aiResult || aiResult.org_numbers.length === 0) {
        setCompanies([])
        return
      }

      setLoadingCompanies(true)
      try {
        const response = await apiService.getCompaniesBatch(aiResult.org_numbers)
        setCompanies(response.companies)
      } catch (error) {
        console.error('Failed to fetch company details:', error)
        setCompanies(aiResult.org_numbers.map((orgnr) => ({ orgnr })))
      } finally {
        setLoadingCompanies(false)
      }
    }

    fetchCompanyDetails()
  }, [aiResult])

  useEffect(() => {
    const loadSavedLists = async () => {
      try {
        const lists = await SavedListsService.getSavedLists()
        setSavedLists(lists)
        // Only log if there are actually lists, otherwise it's just noise
        if (lists.length > 0) {
          console.log(`Loaded ${lists.length} saved lists`)
        }
      } catch (error) {
        // Silently handle - already falls back to localStorage
        console.debug('Saved lists not available (Supabase not configured)')
      }
    }
    loadSavedLists()
  }, [])

  useEffect(() => {
    if (!actionFeedback) return
    const timer = setTimeout(() => setActionFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [actionFeedback])

  const executePrompt = async (prompt: string, targetPage = 1, addToHistory = true) => {
    const pageSize = pagination.limit || DEFAULT_PAGE_SIZE
    setIsFiltering(true)
    try {
      // Pass current WHERE clause for stateful filtering
      const response = await apiService.aiFilter(
        prompt,
        pageSize,
        (targetPage - 1) * pageSize,
        currentWhereClause
      )
      setCurrentPrompt(prompt)
      setAIFilterResult(response)
      // Update the current WHERE clause with the new one from the response
      setCurrentWhereClause(response.parsed_where_clause)
      setPagination({
        page: targetPage,
        limit: response.metadata?.limit ?? pageSize,
        total: response.total,
      })
      if (addToHistory) {
        setPromptHistory((prev) => {
          const next: PromptHistoryItem[] = [
            { prompt, count: response.total, timestamp: new Date().toISOString() },
            ...prev.filter((item) => item.prompt !== prompt),
          ]
          return next.slice(0, 10)
        })
      }
    } catch (error: any) {
      setActionFeedback({
        type: 'error',
        message: error?.message || 'Failed to run AI filter',
      })
    } finally {
      setIsFiltering(false)
    }
  }

  const handleLoadList = async (list: any) => {
    try {
      const companyRows: CompanyRow[] = list.companies.map((company: any) => ({
        orgnr: company.OrgNr || company.orgnr,
        company_name: company.name || company.company_name,
        latest_revenue_sek: company.SDI || company.revenue ? parseFloat(company.revenue || company.SDI) : undefined,
        latest_profit_sek: company.DR || company.profit ? parseFloat(company.profit || company.DR) : undefined,
        latest_ebitda_sek: company.ORS || company.RG || company.ebitda ? parseFloat(company.ebitda || company.ORS || company.RG) : undefined,
        avg_ebitda_margin: company.EBIT_margin || company.avg_ebitda_margin,
        revenue_cagr_3y: company.Revenue_growth || company.revenue_cagr_3y,
        revenue_growth_yoy: company.revenue_growth_yoy,
        company_size_bucket: company.company_size_category || company.company_size_bucket,
        growth_bucket: company.growth_category || company.growth_bucket,
        profitability_bucket: company.profitability_category || company.profitability_bucket,
      }))

      setCompanies(companyRows)
      const syntheticResult: AIFilterResponse = {
        sql: list.filters?.prompt || 'Loaded from saved list',
        parsed_where_clause: list.filters?.prompt || 'Loaded from saved list',
        org_numbers: companyRows.map((c) => c.orgnr),
        count: companyRows.length,
        total: companyRows.length,
        metadata: {
          where_clause: list.filters?.prompt || 'Loaded from saved list',
          limit: companyRows.length || DEFAULT_PAGE_SIZE,
          offset: 0,
          prompt: list.filters?.prompt || 'Saved list import',
          used_llm: false,
          total_matches: companyRows.length,
        },
      }
      setAIFilterResult(syntheticResult)
      setPagination({
        page: 1,
        limit: companyRows.length || DEFAULT_PAGE_SIZE,
        total: companyRows.length,
      })
      setShowLoadDialog(false)
      setCurrentPrompt(list.filters?.prompt || '')
    } catch (error) {
      console.error('Failed to load list:', error)
      setActionFeedback({ type: 'error', message: 'Failed to load list. Please try again.' })
    }
  }

  const handleSaveList = async (companiesToSave: CompanyRow[], name: string, description?: string) => {
    try {
      const supabaseCompanies = await Promise.all(
        companiesToSave.map(async (company) => {
          try {
            const fullCompany = await supabaseDataService.getCompany(company.orgnr)
            if (fullCompany) {
              return fullCompany
            }
          } catch (error) {
            console.warn(`Could not fetch full data for ${company.orgnr}:`, error)
          }

          return {
            OrgNr: company.orgnr,
            name: company.company_name || company.orgnr,
            revenue: company.latest_revenue_sek?.toString(),
            profit: company.latest_profit_sek?.toString(),
            employees: company.employees_latest?.toString(),
            Revenue_growth: company.revenue_growth_yoy,
            EBIT_margin: company.avg_ebitda_margin,
            NetProfit_margin: company.avg_net_margin,
            company_size_category: company.company_size_bucket,
            growth_category: company.growth_bucket,
            profitability_category: company.profitability_bucket,
          } as any
        })
      )

      await SavedListsService.saveList({
        name,
        description,
        companies: supabaseCompanies,
        filters: aiResult ? { prompt: aiResult.parsed_where_clause } : {},
      })

      setActionFeedback({ type: 'success', message: `List "${name}" saved successfully.` })
    } catch (error) {
      console.error('Failed to save list:', error)
      setActionFeedback({ type: 'error', message: 'Failed to save list. Please try again.' })
      throw error
    }
  }

  const handlePageChange = (nextPage: number) => {
    if (!currentPrompt) return
    executePrompt(currentPrompt, nextPage, false)
  }

  const handleEnrichSelection = async (selection: CompanyRow[]) => {
    if (!selection.length) {
      setActionFeedback({ type: 'info', message: 'Select at least one company to enrich.' })
      return
    }
    setEnriching(true)
    try {
      const response = await apiService.startEnrichment(selection.map((company) => company.orgnr))
      setActionFeedback({
        type: 'success',
        message: response.message || 'Enrichment complete.',
      })
    } catch (error: any) {
      setActionFeedback({
        type: 'error',
        message: error?.message || 'Failed to start enrichment.',
      })
    } finally {
      setEnriching(false)
    }
  }

  const handleEnrichAllCompanies = async () => {
    if (!aiResult?.org_numbers?.length) {
      setActionFeedback({ type: 'info', message: 'Run a search before enriching all companies.' })
      return
    }
    setEnriching(true)
    try {
      const response = await apiService.startEnrichment(aiResult.org_numbers)
      setActionFeedback({
        type: 'success',
        message: response.message || 'Batch enrichment started.',
      })
    } catch (error: any) {
      setActionFeedback({
        type: 'error',
        message: error?.message || 'Failed to enrich all companies.',
      })
    } finally {
      setEnriching(false)
    }
  }

  const handleExportSelection = async (selection: CompanyRow[]) => {
    if (!selection.length) {
      setActionFeedback({ type: 'info', message: 'Select at least one company to export.' })
      return
    }
    const token = window.prompt('Enter Copper API Token')
    if (!token) {
      setActionFeedback({ type: 'info', message: 'Export cancelled (no API token provided).' })
      return
    }
    setExporting(true)
    try {
      const response = await apiService.exportToCopper(selection.map((company) => company.orgnr), token)
      if (response.success) {
        setActionFeedback({
          type: 'success',
          message: `Exported ${response.exported} companies to Copper.`,
        })
      } else {
        setActionFeedback({
          type: 'error',
          message: response.message || 'Export failed.',
        })
      }
    } catch (error: any) {
      setActionFeedback({
        type: 'error',
        message: error?.message || 'Export failed.',
      })
    } finally {
      setExporting(false)
    }
  }

  const handleViewProfile = (selection: CompanyRow[]) => {
    if (!selection.length) {
      setActionFeedback({ type: 'info', message: 'Select a company to view its AI profile.' })
      return
    }
    if (selection.length > 1) {
      setActionFeedback({ type: 'info', message: 'Select only one company to view its AI profile.' })
      return
    }
    setActiveProfile(selection[0])
  }

  const closeProfileModal = () => setActiveProfile(null)

  const isResultCapped = Boolean(
    aiResult?.capped || ((aiResult?.total ?? 0) > 300)
  )

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-gray-500">Explorer</p>
              <h1 className="text-2xl font-semibold text-gray-900">AI Sourcing Dashboard</h1>
              <p className="text-sm text-gray-500">
                Describe your investment thesis, let the AI translate it into SQL, then triage and enrich the resulting companies.
              </p>
            </div>
            {aiResult && (
              <button
                type="button"
                onClick={clearAllData}
                className="ml-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                title="Clear all search results and start fresh"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>

        {aiResult && (
          <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Active thesis</p>
              <p className="text-sm text-gray-900">{aiResult.metadata?.prompt || currentPrompt || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Matches</p>
              <p className="text-lg font-semibold text-gray-900">
                {aiResult.total.toLocaleString()}{' '}
                <span className="text-xs font-normal text-gray-500">
                  (showing {(aiResult.result_count ?? aiResult.count).toLocaleString()})
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Selection</p>
              <p className="text-lg font-semibold text-gray-900">{selectedCompanies.length} companies</p>
            </div>
          </div>
        )}

        {actionFeedback && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${actionFeedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : actionFeedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
          >
            {actionFeedback.message}
          </div>
        )}

        {isResultCapped && aiResult?.refinement_message && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">{aiResult.refinement_message}</p>
            {aiResult.suggestions && aiResult.suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {aiResult.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setCurrentPrompt(`${currentPrompt ? `${currentPrompt}\n` : ''}${suggestion}`)}
                    className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-amber-700">
              Refine the thesis to 300 companies or fewer to enable batch enrichment.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-[360px] lg:flex-shrink-0">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">AI Chat Filter</h2>
                  <p className="text-sm text-gray-500">Describe the type of target you are looking for.</p>
                </div>
                {savedLists.length > 0 && (
                  <button
                    onClick={() => setShowLoadDialog(true)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Load list
                  </button>
                )}
              </div>
              <AIChatFilter
                initialPrompt={currentPrompt}
                isLoading={isFiltering}
                lastResult={aiResult}
                history={promptHistory}
                onSubmitPrompt={(prompt) => executePrompt(prompt, 1, true)}
                onSelectHistory={(prompt) => setCurrentPrompt(prompt)}
              />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <CompanyExplorer
              companies={companies}
              loading={loadingCompanies}
              onCompanyClick={(company) => navigate(`/companies/${company.orgnr}`)}
              onSaveList={handleSaveList}
              pagination={{
                page: pagination.page,
                pageSize: pagination.limit,
                total: pagination.total,
                onPageChange: handlePageChange,
              }}
              onEnrichSelection={handleEnrichSelection}
              onExportSelection={handleExportSelection}
              onViewProfile={handleViewProfile}
              onSelectionChange={setSelectedCompanies}
              enriching={enriching}
              exporting={exporting}
              onEnrichAll={handleEnrichAllCompanies}
              disableEnrichAll={isResultCapped}
            />
          </div>
        </div>
      </div>

      {showLoadDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Load Saved List</h3>
            {savedLists.length === 0 ? (
              <p className="text-sm text-gray-500">No saved lists available.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {savedLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => handleLoadList(list)}
                    className="w-full rounded-md border border-gray-200 p-3 text-left text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{list.name}</div>
                    {list.description && (
                      <div className="text-xs text-gray-500">{list.description}</div>
                    )}
                    <div className="mt-1 text-xs text-gray-400">
                      {list.companies?.length || 0} companies •{' '}
                      {list.createdAt ? new Date(list.createdAt).toLocaleDateString() : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowLoadDialog(false)}
              className="mt-4 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {activeProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeProfile.company_name || activeProfile.orgnr}
                </h3>
                <p className="text-sm text-gray-500">{activeProfile.orgnr}</p>
              </div>
              <button
                onClick={closeProfileModal}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-500 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div>
                <p className="text-xs uppercase text-gray-400">Product Description</p>
                <p>{activeProfile.ai_product_description || 'No AI summary yet.'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-gray-400">End Market</p>
                  <p>{activeProfile.ai_end_market || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400">Customer Types</p>
                  <p>{activeProfile.ai_customer_types || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400">Value Chain Position</p>
                  <p>{activeProfile.ai_value_chain_position || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400">Strategic Fit Score</p>
                  <p>{activeProfile.ai_strategic_score ? `${activeProfile.ai_strategic_score}/10` : '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">AI Notes</p>
                <p>{activeProfile.ai_notes || '—'}</p>
              </div>
              {activeProfile.ai_profile_website && (
                <a
                  href={activeProfile.ai_profile_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Visit website
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AISourcingDashboard

