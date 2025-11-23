import { useEffect, useMemo, useState } from 'react'

export interface CompanyRow {
  orgnr: string
  company_name?: string
  homepage?: string
  employees_latest?: number
  segment_names?: string[]
  company_context?: string  // Display-friendly: product description, business model, or industry segments
  latest_revenue_sek?: number
  avg_ebitda_margin?: number
  revenue_cagr_3y?: number
  revenue_growth_yoy?: number
  ai_strategic_score?: number
  ai_product_description?: string
  ai_business_model_summary?: string
  ai_industry_sector?: string
  has_ai_profile?: boolean
  ai_score?: number  // Legacy field
}

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

  // Sync selected state when companies list changes (preserve selections for companies that still exist)
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>()
      companies.forEach((company) => {
        if (prev.has(company.orgnr)) {
          next.add(company.orgnr)
        }
      })
      return next
    })
  }, [companies])

  // Notify parent of selection changes (separate effect to avoid setState during render warning)
  useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = companies.filter((company) => selected.has(company.orgnr))
      onSelectionChange(selectedRows)
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
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Explorer View</p>
          <p className="text-xs text-gray-500">
            {pagination ? pagination.total.toLocaleString() : companies.length} companies •{' '}
            {totalSelected} selected
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEnrich}
            disabled={totalSelected === 0 || enriching}
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {enriching ? 'Enriching…' : 'Enrich selection'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={totalSelected === 0 || exporting}
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export to CRM'}
          </button>
          <button
            type="button"
            onClick={handleViewProfile}
            disabled={totalSelected === 0}
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            View AI Profile
          </button>
          {onSaveList && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="inline-flex items-center rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
            >
              Save List
            </button>
          )}
        </div>
      </div>
      
      {showSaveDialog && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="space-y-2">
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="List name (required)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
            <textarea
              value={listDescription}
              onChange={(e) => setListDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              rows={2}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveList}
                disabled={!listName.trim() || saving}
                className="inline-flex items-center rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Save ${selected.size > 0 ? `${selected.size} selected` : 'all'} companies`}
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setListName('')
                  setListDescription('')
                }}
                className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Select</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Company</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">What they do</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Org.nr</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Revenue</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">EBITDA margin</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Growth</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">AI score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {renderedRows.map((company) => (
              <tr key={company.orgnr} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
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
                      <div className="font-medium text-gray-800 hover:text-black">
                        {company.company_name || company.orgnr}
                      </div>
                      {company.homepage && (
                        <p className="text-xs text-blue-600">{company.homepage.replace(/^https?:\/\//, '')}</p>
                      )}
                    </button>
                  ) : (
                    <>
                      <div className="font-medium text-gray-800">{company.company_name || company.orgnr}</div>
                      {company.homepage && (
                        <p className="text-xs text-blue-600">{company.homepage.replace(/^https?:\/\//, '')}</p>
                      )}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {company.company_context ? (
                    <div className="text-xs text-gray-700">
                      <p className="line-clamp-2">{company.company_context}</p>
                      {company.has_ai_profile && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          AI Enriched
                        </span>
                      )}
                    </div>
                  ) : company.segment_names && company.segment_names.length > 0 ? (
                    <div className="text-xs text-gray-600">
                      <p className="line-clamp-2">{company.segment_names.slice(0, 3).join(', ')}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No context available</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{company.orgnr}</td>
                <td className="px-4 py-3 text-right">{formatMillions(company.latest_revenue_sek)}</td>
                <td className="px-4 py-3 text-right">{formatPercent(company.avg_ebitda_margin)}</td>
                <td className="px-4 py-3 text-right">{formatPercent(company.revenue_growth_yoy ?? company.revenue_cagr_3y)}</td>
                <td className="px-4 py-3 text-right">
                  {company.ai_strategic_score ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {company.ai_strategic_score}/10
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                  Loading company details...
                </td>
              </tr>
            )}
            {!loading && renderedRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                  No companies loaded yet. Run the AI filter to populate this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex flex-col items-start gap-3 border-t border-gray-200 px-4 py-3 text-xs text-gray-600 md:flex-row md:items-center md:justify-between">
          <span>
            Showing {startRange}-{endRange} of {pagination.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pagination.onPageChange?.(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-gray-500">
              Page {pagination.page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                pagination.onPageChange?.(Math.min(totalPages, pagination.page + 1))
              }
              disabled={pagination.page >= totalPages}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

