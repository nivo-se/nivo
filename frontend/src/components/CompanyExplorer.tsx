import { useEffect, useMemo, useState } from 'react'
import type { CompanyRow } from '../lib/apiService'

interface CompanyExplorerProps {
  companies: CompanyRow[]
  loading?: boolean
  onSelectionChange?: (selected: CompanyRow[]) => void
  onCompanyClick?: (company: CompanyRow) => void
  onSaveList?: (companies: CompanyRow[], name: string, description?: string) => Promise<void>
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange?: (page: number) => void
  }
  onEnrichSelection?: (selected: CompanyRow[]) => void
  onExportSelection?: (selected: CompanyRow[]) => void
  onViewProfile?: (selected: CompanyRow[]) => void
  enriching?: boolean
  exporting?: boolean
  onEnrichAll?: () => void
  disableEnrichAll?: boolean
}

const formatMillions = (value?: number | null): string => {
  if (value === undefined || value === null) return 'N/A'
  return `${(value / 1_000_000).toFixed(1)} mSEK`
}

const formatPercent = (value?: number | null): string => {
  if (value === undefined || value === null || isNaN(value)) return 'N/A'
  const displayValue = Math.abs(value) > 1 ? value : value * 100
  return `${displayValue.toFixed(1)}%`
}

export const CompanyExplorer: React.FC<CompanyExplorerProps> = ({
  companies,
  loading = false,
  onSelectionChange,
  onCompanyClick,
  onSaveList,
  pagination,
  onEnrichSelection,
  onExportSelection,
  onViewProfile,
  enriching = false,
  exporting = false,
  onEnrichAll,
  disableEnrichAll = false,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [listName, setListName] = useState('')
  const [listDescription, setListDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleToggle = (orgnr: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orgnr)) {
        next.delete(orgnr)
      } else {
        next.add(orgnr)
      }
      if (onSelectionChange) {
        const selectedRows = companies.filter((company) => next.has(company.orgnr))
        onSelectionChange(selectedRows)
      }
      return next
    })
  }

  // Sync selection with available companies
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>()
      let changed = false

      // Only keep selected companies that are currently in the list
      companies.forEach((company) => {
        if (prev.has(company.orgnr)) {
          next.add(company.orgnr)
        }
      })

      // Check if selection actually changed
      if (prev.size !== next.size) {
        changed = true
      }

      return changed ? next : prev
    })
  }, [companies])

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = companies.filter((company) => selected.has(company.orgnr))
      // Wrap in timeout to avoid "update while rendering" warning if this triggers immediately
      const timer = setTimeout(() => {
        onSelectionChange(selectedRows)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selected, companies, onSelectionChange])

  const renderedRows = useMemo(() => companies, [companies])
  const selectedRows = useMemo(
    () => renderedRows.filter((company) => selected.has(company.orgnr)),
    [renderedRows, selected]
  )

  const handleSaveList = async () => {
    if (!listName.trim() || !onSaveList) return

    setSaving(true)
    try {
      const companiesToSave = selected.size > 0
        ? companies.filter(c => selected.has(c.orgnr))
        : companies

      await onSaveList(companiesToSave, listName.trim(), listDescription.trim() || undefined)
      setShowSaveDialog(false)
      setListName('')
      setListDescription('')
    } catch (error) {
      console.error('Failed to save list:', error)
      alert('Failed to save list. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const totalSelected = selected.size
  const totalCompanies = companies.length
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1
  const startRange = pagination
    ? pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1
    : totalCompanies > 0
      ? 1
      : 0
  const endRange = pagination
    ? pagination.total === 0
      ? 0
      : Math.min(pagination.page * pagination.pageSize, pagination.total)
    : totalCompanies

  const handleViewProfile = () => {
    if (!onViewProfile) return
    onViewProfile(selectedRows)
  }

  const handleEnrich = () => {
    if (!onEnrichSelection) return
    onEnrichSelection(selectedRows)
  }

  const handleExport = () => {
    if (!onExportSelection) return
    onExportSelection(selectedRows)
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Explorer View</p>
          <p className="text-xs text-muted-foreground">
            {pagination ? pagination.total.toLocaleString() : companies.length} companies •{' '}
            {totalSelected} selected
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEnrich}
            disabled={totalSelected === 0 || enriching}
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
          >
            {enriching ? 'Enriching…' : 'Enrich selection'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={totalSelected === 0 || exporting}
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export to CRM'}
          </button>
          <button
            type="button"
            onClick={handleViewProfile}
            disabled={totalSelected === 0}
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
          >
            View AI Profile
          </button>
          {onEnrichAll && (
            <button
              type="button"
              onClick={onEnrichAll}
              disabled={enriching || disableEnrichAll}
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
            >
              {disableEnrichAll ? 'Refine to ≤300 to enrich all' : 'Enrich all companies'}
            </button>
          )}
          {onSaveList && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="inline-flex items-center rounded-md bg-card px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-card/90"
            >
              Save List
            </button>
          )}
        </div>
      </div>

      {showSaveDialog && (
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <div className="space-y-2">
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="List name (required)"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-border focus:outline-none"
            />
            <textarea
              value={listDescription}
              onChange={(e) => setListDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-border focus:outline-none"
              rows={2}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveList}
                disabled={!listName.trim() || saving}
                className="inline-flex items-center rounded-md bg-card px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-card/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Save ${selected.size > 0 ? `${selected.size} selected` : 'all'} companies`}
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setListName('')
                  setListDescription('')
                }}
                className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Select</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Company</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Org.nr</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Revenue</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">EBITDA margin</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Growth</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">AI Summary</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">AI Fit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {renderedRows.map((company) => (
              <tr key={company.orgnr} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-foreground focus:ring-black"
                    checked={selected.has(company.orgnr)}
                    onChange={() => handleToggle(company.orgnr)}
                  />
                </td>
                <td className="px-4 py-3">
                  {onCompanyClick ? (
                    <button
                      onClick={() => onCompanyClick(company)}
                      className="cursor-pointer text-left hover:underline"
                    >
                      <div className="font-medium text-foreground hover:text-foreground">
                        {company.company_name || company.orgnr}
                      </div>
                      {company.homepage && (
                        <p className="text-xs text-primary">{company.homepage.replace(/^https?:\/\//, '')}</p>
                      )}
                    </button>
                  ) : (
                    <>
                      <div className="font-medium text-foreground">{company.company_name || company.orgnr}</div>
                      {company.homepage && (
                        <p className="text-xs text-primary">{company.homepage.replace(/^https?:\/\//, '')}</p>
                      )}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{company.orgnr}</td>
                <td className="px-4 py-3">{formatMillions(company.latest_revenue_sek)}</td>
                <td className="px-4 py-3">{formatPercent(company.avg_ebitda_margin)}</td>
                <td className="px-4 py-3">{formatPercent(company.revenue_growth_yoy ?? company.revenue_cagr_3y)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {company.ai_business_summary ||
                    company.company_context ||
                    company.ai_product_description ||
                    'Not enriched'}
                  {company.ai_industry_keywords && company.ai_industry_keywords.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {company.ai_industry_keywords.slice(0, 3).map((keyword) => (
                        <span key={keyword} className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {company.ai_fit_status && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          company.ai_fit_status === 'YES'
                            ? 'bg-emerald-50 text-emerald-700'
                            : company.ai_fit_status === 'NO'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-accent/60 text-foreground'
                        }`}
                      >
                        {company.ai_fit_status}
                      </span>
                    )}
                    {company.ai_strategic_score ? (
                      <span className="text-sm font-semibold text-foreground">
                        {company.ai_strategic_score}/10
                        <span className="ml-1 text-xs font-normal text-muted-foreground">fit score</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not scored</span>
                    )}
                    {company.ai_acquisition_angle && (
                      <span className="text-xs text-muted-foreground">{company.ai_acquisition_angle}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading company details...
                </td>
              </tr>
            )}
            {!loading && renderedRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No companies loaded yet. Run the AI filter to populate this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex flex-col items-start gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>
            Showing {startRange}-{endRange} of {pagination.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pagination.onPageChange?.(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-muted-foreground">
              Page {pagination.page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                pagination.onPageChange?.(Math.min(totalPages, pagination.page + 1))
              }
              disabled={pagination.page >= totalPages}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

