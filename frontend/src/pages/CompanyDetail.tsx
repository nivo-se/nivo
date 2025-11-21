import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiService, type CompanyRow } from '../lib/apiService'
import { ArrowLeft } from 'lucide-react'

interface FinancialYear {
  year: number
  revenue_sek: number | null
  profit_sek: number | null
  ebit_sek: number | null
  ebitda_sek: number | null
  net_margin: number | null
  ebit_margin: number | null
  ebitda_margin: number | null
}

const CompanyDetail: React.FC = () => {
  const { orgnr } = useParams<{ orgnr: string }>()
  const navigate = useNavigate()
  const [company, setCompany] = useState<CompanyRow | null>(null)
  const [financials, setFinancials] = useState<FinancialYear[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCompany = async () => {
      if (!orgnr) {
        setError('No company ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Fetch company data
        const [companyResponse, financialsResponse] = await Promise.all([
          apiService.getCompaniesBatch([orgnr]),
          apiService.getCompanyFinancials(orgnr).catch(() => ({ financials: [], count: 0 }))
        ])
        
        if (companyResponse.companies.length > 0) {
          setCompany(companyResponse.companies[0])
        } else {
          setError('Company not found')
        }
        
        if (financialsResponse.financials) {
          setFinancials(financialsResponse.financials)
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load company details')
      } finally {
        setLoading(false)
      }
    }

    fetchCompany()
  }, [orgnr])

  const formatMillions = (value?: number | null): string => {
    if (value === undefined || value === null) return 'N/A'
    if (value === 0) return '0.0 mSEK'
    const msek = value / 1_000_000
    // Show more precision for small values
    if (Math.abs(msek) < 0.1) {
      return `${msek.toFixed(3)} mSEK`
    }
    return `${msek.toFixed(1)} mSEK`
  }

  const formatThousands = (value?: number | null): string => {
    if (value === undefined || value === null) return '-'
    if (value === 0) return '0'
    return `${Math.round(value / 1_000).toLocaleString()}`
  }

  const formatPercent = (value?: number | null): string => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A'
    // Backend returns margins as percentages (e.g., 0.0033 for 0.0033%, 15.5 for 15.5%)
    // If value is < 1, it's a small percentage (like 0.0033%)
    // If value is >= 1, it's already a percentage (like 15.5%)
    // Always use as-is since backend calculates (value / revenue * 100)
    return `${value.toFixed(1)}%`
  }

  // Get latest year data - use financials table data (most accurate)
  const latestFinancial = financials.length > 0 ? financials[0] : null
  
  // Calculate CAGR correctly from financials data
  const calculateCAGR = (): number | null => {
    if (financials.length < 2) return null
    const latest = financials[0]
    const oldest = financials[financials.length - 1]
    if (!latest.revenue_sek || !oldest.revenue_sek || oldest.revenue_sek <= 0) return null
    const years = latest.year - oldest.year
    if (years <= 0) return null
    const cagr = (Math.pow(latest.revenue_sek / oldest.revenue_sek, 1 / years) - 1) * 100
    return cagr
  }
  
  const calculatedCAGR = calculateCAGR()
  
  // Calculate YoY growth from financials
  const calculateYoY = (): number | null => {
    if (financials.length < 2) return null
    const current = financials[0]
    const previous = financials[1]
    if (!current.revenue_sek || !previous.revenue_sek || previous.revenue_sek <= 0) return null
    if (current.year - previous.year !== 1) return null // Must be consecutive years
    const yoy = ((current.revenue_sek / previous.revenue_sek) - 1) * 100
    return yoy
  }
  
  const calculatedYoY = calculateYoY()

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="text-center">Loading company details...</div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error || 'Company not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-6 flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="space-y-6">
        {/* Company Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{company.company_name || company.orgnr}</h1>
          <p className="text-sm text-gray-500">Org.nr {company.orgnr}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Financial Metrics</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Revenue</dt>
                <dd className="text-sm font-medium">{formatMillions(latestFinancial?.revenue_sek)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Net Profit</dt>
                <dd className="text-sm font-medium">{formatMillions(latestFinancial?.profit_sek)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">EBIT</dt>
                <dd className="text-sm font-medium">{formatMillions(latestFinancial?.ebit_sek)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">EBITDA</dt>
                <dd className="text-sm font-medium">{formatMillions(latestFinancial?.ebitda_sek)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Margins</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Net Margin</dt>
                <dd className="text-sm font-medium">{formatPercent(latestFinancial?.net_margin)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">EBIT Margin</dt>
                <dd className="text-sm font-medium">{formatPercent(latestFinancial?.ebit_margin)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">EBITDA Margin</dt>
                <dd className="text-sm font-medium">{formatPercent(latestFinancial?.ebitda_margin)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Growth & Info</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">3Y CAGR</dt>
                <dd className="text-sm font-medium">{formatPercent(calculatedCAGR)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">YoY Growth</dt>
                <dd className="text-sm font-medium">{formatPercent(calculatedYoY)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Employees</dt>
                <dd className="text-sm font-medium">{company.employees_latest || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Size</dt>
                <dd className="text-sm font-medium capitalize">{company.company_size_bucket || 'N/A'}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Financial Statement Table (like Allabolag) */}
        {financials.length > 0 && (
          <div className="rounded-lg border border-gray-200 p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Resultaträkning (Belopp i 1000)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">År</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Nettoomsättning</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Rörelseresultat (EBIT)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Årets resultat</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Nettoresultat %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">EBIT-marginal %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {financials.map((fin) => (
                    <tr key={fin.year} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{fin.year}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatThousands(fin.revenue_sek)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatThousands(fin.ebit_sek)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatThousands(fin.profit_sek)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatPercent(fin.net_margin)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatPercent(fin.ebit_margin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompanyDetail
