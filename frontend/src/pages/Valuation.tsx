import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { toast } from '../components/ui/use-toast'
import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  BarChart,
  Bar
} from 'recharts'
import {
  ValuationMetrics,
  ValuationDatasetForExport,
  toCsv
} from '../lib/valuation'

const MIN_COMPANIES = 3

interface CompanyOption {
  OrgNr: string
  name: string
  segment_name?: string | null
  city?: string | null
  SDI?: number | null
  DR?: number | null
  Revenue_growth?: number | null
  employees?: number | null
}

interface CompanyValuationInsight {
  summary: string
  valuationView?: string | null
  valuationRange?: string | null
  riskFlags?: string[]
  opportunities?: string[]
  mode: 'default' | 'deep'
}

interface ValuationChartPoint {
  year: number
  revenue: number | null
  ebit: number | null
  ebitda: number | null
  evToEbitda: number | null
}

interface ValuationCompanyResponse {
  orgnr: string
  name: string
  industry: string | null
  employees: number | null
  metrics: ValuationMetrics
  chartSeries: ValuationChartPoint[]
  aiInsights?: CompanyValuationInsight
}

interface ValuationApiResponse {
  valuationSessionId: string | null
  mode: 'default' | 'deep'
  generatedAt: string
  overallSummary: string
  companies: ValuationCompanyResponse[]
  exportDataset: ValuationDatasetForExport
}

interface CompaniesResponse {
  success: boolean
  companies: CompanyOption[]
}

const formatCurrency = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '–'
  return `${(value / 1_000_000).toFixed(1)} MSEK`
}

const formatMultiple = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '–'
  return `${value.toFixed(1)}x`
}

const formatPercentage = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '–'
  return `${(value * 100).toFixed(1)}%`
}

const formatCagr = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '–'
  return `${(value * 100).toFixed(1)}%`
}

const uniqueCompanies = (companies: CompanyOption[]) => {
  const seen = new Set<string>()
  return companies.filter((company) => {
    if (seen.has(company.OrgNr)) return false
    seen.add(company.OrgNr)
    return true
  })
}

const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

const buildExcelBlob = (dataset: ValuationDatasetForExport) => {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const header = [
    'OrgNr',
    'Företag',
    'Bransch',
    'År',
    'Företagsvärde',
    'Marknadsvärde',
    'Nettoskuld',
    'EV/EBIT',
    'EV/EBITDA',
    'P/E',
    'P/B',
    'P/S',
    'Soliditet',
    'Omsättning',
    'EBIT',
    'EBITDA',
    'Nettoresultat',
  ]

  const rows = dataset.rows
    .map((row) => [
      row.orgnr,
      row.company,
      row.industry ?? '',
      row.year.toString(),
      row.enterpriseValue ?? '',
      row.marketCap ?? '',
      row.netDebt ?? '',
      row.evToEbit ?? '',
      row.evToEbitda ?? '',
      row.peRatio ?? '',
      row.pbRatio ?? '',
      row.psRatio ?? '',
      row.equityRatio ?? '',
      row.revenue ?? '',
      row.ebit ?? '',
      row.ebitda ?? '',
      row.netIncome ?? '',
    ]
      .map((value) => `<td>${escape(String(value))}</td>`)
      .join(''))
    .map((rowHtml) => `<tr>${rowHtml}</tr>`)
    .join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${header
    .map((column) => `<th>${escape(column)}</th>`)
    .join('')}</tr></thead><tbody>${rows}</tbody></table></body></html>`

  return new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' })
}

const escapePdfText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const buildPdfBlob = (valuation: ValuationApiResponse) => {
  const lines: string[] = []
  lines.push('Värderingsrapport')
  lines.push(`Genererad: ${new Date(valuation.generatedAt).toLocaleString('sv-SE')}`)
  lines.push('')

  valuation.companies.forEach((company) => {
    lines.push(`${company.name} (${company.orgnr})`)
    lines.push(
      `EV ${formatCurrency(company.metrics.enterpriseValue)} · EV/EBIT ${formatMultiple(
        company.metrics.evToEbit
      )} · EV/EBITDA ${formatMultiple(company.metrics.evToEbitda)}`
    )
    if (company.aiInsights?.summary) {
      lines.push(`AI: ${company.aiInsights.summary}`)
    }
    lines.push('')
  })

  if (valuation.overallSummary) {
    lines.push(`Övergripande: ${valuation.overallSummary}`)
  }

  const textCommands = lines
    .map((line, index) => {
      const prefix = index === 0 ? '' : '0 -16 Td\n'
      return `${prefix}(${escapePdfText(line)}) Tj`
    })
    .join('\n')

  const textStream = `BT\n/F1 12 Tf\n50 780 Td\n${textCommands}\nET`
  const encoder = new TextEncoder()
  const streamLength = encoder.encode(textStream).length

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${streamLength} >> stream\n${textStream}\nendstream endobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ]

  const header = '%PDF-1.3\n'
  const offsets: number[] = [0]
  let currentOffset = header.length
  const bodyEncoder = new TextEncoder()
  const body = objects
    .map((object) => {
      offsets.push(currentOffset)
      const bytes = bodyEncoder.encode(object)
      currentOffset += bytes.length
      return object
    })
    .join('')

  const xrefOffset = currentOffset
  const xrefEntries = offsets
    .map((offset, index) => {
      if (index === 0) {
        return '0000000000 65535 f \n'
      }
      return `${offset.toString().padStart(10, '0')} 00000 n \n`
    })
    .join('')

  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries}`
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  const pdf = header + body + xref + '\n' + trailer
  return new Blob([pdf], { type: 'application/pdf' })
}

const useDebounce = <T,>(value: T, delay = 400) => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

const fetchCompanies = async (searchTerm: string): Promise<CompanyOption[]> => {
  const params = new URLSearchParams({ limit: '20' })
  if (searchTerm) {
    params.set('search', searchTerm)
  }

  const response = await fetch(`/api/companies?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Kunde inte hämta företag')
  }
  const data: CompaniesResponse = await response.json()
  return data.companies || []
}

const runValuationRequest = async (payload: {
  companyIds: string[]
  mode: 'default' | 'deep'
}): Promise<ValuationApiResponse> => {
  const response = await fetch('/api/valuation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Okänt fel' }))
    throw new Error(error.error || 'Värderingsberäkning misslyckades')
  }

  const data = await response.json()
  return data.data as ValuationApiResponse
}

const ValuationPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm)
  const [selectedCompanies, setSelectedCompanies] = useState<CompanyOption[]>([])
  const [valuation, setValuation] = useState<ValuationApiResponse | null>(null)
  const [mode, setMode] = useState<'default' | 'deep'>('default')
  const [chartCompany, setChartCompany] = useState<string | null>(null)

  const { data: searchResults = [], isFetching: searchLoading } = useQuery({
    queryKey: ['valuation-search', debouncedSearch],
    queryFn: () => fetchCompanies(debouncedSearch),
  })

  const valuationMutation = useMutation({
    mutationFn: runValuationRequest,
    onSuccess: (data) => {
      setValuation(data)
      if (data.companies.length) {
        setChartCompany(data.companies[0].orgnr)
      }
      toast({
        title: 'Värdering klar',
        description: `AI-analys och nyckeltal genererade för ${data.companies.length} bolag.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Värderingen misslyckades',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleAddCompany = (company: CompanyOption) => {
    setSelectedCompanies((prev) => uniqueCompanies([...prev, company]))
  }

  const handleRemoveCompany = (orgnr: string) => {
    setSelectedCompanies((prev) => prev.filter((company) => company.OrgNr !== orgnr))
  }

  const handleRunValuation = () => {
    if (selectedCompanies.length < MIN_COMPANIES) {
      toast({
        title: 'För få företag valda',
        description: `Välj minst ${MIN_COMPANIES} företag för en meningsfull värderingsjämförelse.`,
        variant: 'destructive',
      })
      return
    }

    valuationMutation.mutate({
      companyIds: selectedCompanies.map((company) => company.OrgNr),
      mode,
    })
  }

  useEffect(() => {
    if (valuation?.companies?.length) {
      setChartCompany((current) => current || valuation.companies[0].orgnr)
    }
  }, [valuation])

  const activeChartCompany = useMemo(() => {
    if (!valuation?.companies?.length) return null
    return (
      valuation.companies.find((company) => company.orgnr === chartCompany) || valuation.companies[0]
    )
  }, [chartCompany, valuation])

  const handleExportCsv = () => {
    if (!valuation) return
    const csv = toCsv(valuation.exportDataset)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, 'valuation-report.csv')
  }

  const handleExportExcel = () => {
    if (!valuation) return
    const blob = buildExcelBlob(valuation.exportDataset)
    downloadBlob(blob, 'valuation-report.xls')
  }

  const handleExportPdf = () => {
    if (!valuation) return
    const blob = buildPdfBlob(valuation)
    downloadBlob(blob, 'valuation-report.pdf')
  }

  const isRunDisabled = valuationMutation.isPending || selectedCompanies.length < MIN_COMPANIES

  const sortedCompanies = useMemo(() => {
    if (!valuation?.companies) return []
    return [...valuation.companies].sort((a, b) => {
      const valueA = a.metrics.enterpriseValue || 0
      const valueB = b.metrics.enterpriseValue || 0
      return valueB - valueA
    })
  }, [valuation])

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI-stödd värdering</h1>
            <p className="text-muted-foreground">
              Välj svenska bolag för att jämföra multiplar, historik och AI-genererade insikter.
            </p>
          </div>
          {valuation?.valuationSessionId && (
            <Badge variant="secondary" className="w-fit">
              Session {valuation.valuationSessionId.substring(0, 8)}
            </Badge>
          )}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Välj företag</CardTitle>
          <CardDescription>
            Sök bland importerade bolag och bygg en lista om minst {MIN_COMPANIES} företag för att köra värdering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Sök företag</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Sök på namn eller organisationsnummer"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>AI-läge</Label>
              <RadioGroup
                className="flex gap-4"
                value={mode}
                onValueChange={(value: 'default' | 'deep') => setMode(value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="default" id="mode-default" />
                  <Label htmlFor="mode-default">Snabb jämförelse</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="deep" id="mode-deep" />
                  <Label htmlFor="mode-deep">Fördjupad analys</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="grid gap-3">
            <Label>Valda företag ({selectedCompanies.length})</Label>
            {selectedCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Inga företag valda ännu. Sök efter bolag i listan nedan och lägg till dem i din jämförelse.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedCompanies.map((company) => (
                  <Badge
                    key={company.OrgNr}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    {company.name}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => handleRemoveCompany(company.OrgNr)}
                    >
                      ×
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tillgängliga företag</Label>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Företag</TableHead>
                    <TableHead>OrgNr</TableHead>
                    <TableHead>Omsättning</TableHead>
                    <TableHead>Tillväxt</TableHead>
                    <TableHead className="text-right">Åtgärd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        Söker företag...
                      </TableCell>
                    </TableRow>
                  ) : searchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        Inga bolag matchade din sökning.
                      </TableCell>
                    </TableRow>
                  ) : (
                    searchResults.map((company) => {
                      const isSelected = selectedCompanies.some((item) => item.OrgNr === company.OrgNr)
                      return (
                        <TableRow key={company.OrgNr}>
                          <TableCell>
                            <div className="font-medium">{company.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {company.segment_name || 'Bransch saknas'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{company.OrgNr}</TableCell>
                          <TableCell className="text-sm">
                            {typeof company.SDI === 'number' ? `${(company.SDI / 1_000_000).toFixed(1)} MSEK` : '–'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {typeof company.Revenue_growth === 'number'
                              ? `${(company.Revenue_growth * 100).toFixed(1)}%`
                              : '–'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddCompany(company)}
                              disabled={isSelected}
                            >
                              {isSelected ? 'Tillagd' : 'Lägg till'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedCompanies.length < MIN_COMPANIES
                ? `Minst ${MIN_COMPANIES} företag krävs för att aktivera värderingsmotorn.`
                : `${selectedCompanies.length} företag valda. Klart att värdera.`}
            </p>
            <Button onClick={handleRunValuation} disabled={isRunDisabled}>
              {valuationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kör värdering...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Kör AI-värdering
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {valuation && (
        <div className="space-y-8">
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle>Översikt</CardTitle>
                <CardDescription>{valuation.overallSummary}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={valuation.mode === 'deep' ? 'default' : 'outline'}>
                  {valuation.mode === 'deep' ? 'Fördjupad AI-analys' : 'Snabb AI-analys'}
                </Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportCsv}>
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPdf}>
                    <FileText className="mr-2 h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nyckeltal per bolag</CardTitle>
              <CardDescription>
                Multiplar och balansindikatorer för de valda bolagen. Sorterade efter företagsvärde.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Företag</TableHead>
                    <TableHead>EV</TableHead>
                    <TableHead>EV/EBIT</TableHead>
                    <TableHead>EV/EBITDA</TableHead>
                    <TableHead>P/E</TableHead>
                    <TableHead>P/B</TableHead>
                    <TableHead>P/S</TableHead>
                    <TableHead>Soliditet</TableHead>
                    <TableHead>Omsättning</TableHead>
                    <TableHead>Rev CAGR 3 år</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCompanies.map((company) => (
                    <TableRow key={company.orgnr}>
                      <TableCell>
                        <div className="font-medium">{company.name}</div>
                        <div className="text-xs text-muted-foreground">{company.orgnr}</div>
                      </TableCell>
                      <TableCell>{formatCurrency(company.metrics.enterpriseValue)}</TableCell>
                      <TableCell>{formatMultiple(company.metrics.evToEbit)}</TableCell>
                      <TableCell>{formatMultiple(company.metrics.evToEbitda)}</TableCell>
                      <TableCell>{formatMultiple(company.metrics.peRatio)}</TableCell>
                      <TableCell>{formatMultiple(company.metrics.pbRatio)}</TableCell>
                      <TableCell>{formatMultiple(company.metrics.psRatio)}</TableCell>
                      <TableCell>{formatPercentage(company.metrics.equityRatio)}</TableCell>
                      <TableCell>{formatCurrency(company.metrics.revenueLatest)}</TableCell>
                      <TableCell>{formatCagr(company.metrics.revenueCagr3Y)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="h-full">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Historiska trender</CardTitle>
                  <CardDescription>
                    Välj ett bolag för att se utvecklingen av omsättning, EBIT och EBITDA.
                  </CardDescription>
                </div>
                {valuation.companies.length > 1 ? (
                  <Select
                    value={activeChartCompany?.orgnr}
                    onValueChange={(value) => setChartCompany(value)}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Välj bolag" />
                    </SelectTrigger>
                    <SelectContent>
                      {valuation.companies.map((company) => (
                        <SelectItem key={company.orgnr} value={company.orgnr}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </CardHeader>
              <CardContent>
                {activeChartCompany && activeChartCompany.chartSeries.length ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={activeChartCompany.chartSeries} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" stroke="#94a3b8" />
                      <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={(value) => `${Math.round(value / 1_000_000)} M`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tickFormatter={(value) => `${value?.toFixed?.(1) ?? value}`}/>
                      <Tooltip formatter={(value: number) => `${(value / 1_000_000).toFixed(1)} MSEK`} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" name="Omsättning" stroke="#2563eb" yAxisId="left" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="ebit" name="EBIT" stroke="#16a34a" yAxisId="left" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#9333ea" yAxisId="left" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Ingen historik kunde visualiseras.</p>
                )}
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle>EV/EBITDA över tid</CardTitle>
                <CardDescription>
                  Multipelutveckling baserat på historiska resultatdata och fallback-värdering.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeChartCompany && activeChartCompany.chartSeries.length ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={activeChartCompany.chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="year" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" tickFormatter={(value) => `${value?.toFixed?.(1) ?? value}`} />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}x`} />
                      <Legend />
                      <Bar dataKey="evToEbitda" name="EV/EBITDA" fill="#fb7185" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Multiplarna saknas för vald period.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">AI-insikter</CardTitle>
              <Badge variant="secondary">GPT-4.1 mini</Badge>
              {valuation.mode === 'deep' && <Badge variant="default">Fördjupad GPT-4o</Badge>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {valuation.companies.map((company) => (
                <Card key={company.orgnr} className="flex flex-col">
                  <CardHeader className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle>{company.name}</CardTitle>
                        <CardDescription>
                          {company.industry || 'Bransch saknas'} • {company.orgnr}
                        </CardDescription>
                      </div>
                      <Badge variant={company.aiInsights?.mode === 'deep' ? 'default' : 'outline'}>
                        {company.aiInsights?.mode === 'deep' ? 'Fördjupad' : 'AI'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    <p className="text-muted-foreground">
                      {company.aiInsights?.summary || 'Ingen AI-sammanfattning tillgänglig.'}
                    </p>
                    {company.aiInsights?.valuationView && (
                      <div className="rounded-md bg-muted p-3 text-xs">
                        <div className="font-semibold uppercase tracking-wide text-muted-foreground">
                          Värderingsspan</div>
                        <p>{company.aiInsights.valuationView}</p>
                        {company.aiInsights.valuationRange && (
                          <p className="text-muted-foreground">
                            Spann: {company.aiInsights.valuationRange}
                          </p>
                        )}
                      </div>
                    )}
                    {company.aiInsights?.riskFlags && company.aiInsights.riskFlags.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <AlertTriangle className="h-3 w-3" /> Riskflaggor
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {company.aiInsights.riskFlags.map((risk) => (
                            <Badge key={risk} variant="destructive" className="text-xs">
                              {risk}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {company.aiInsights?.opportunities && company.aiInsights.opportunities.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <CheckCircle className="h-3 w-3" /> Möjligheter
                        </div>
                        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                          {company.aiInsights.opportunities.map((opportunity) => (
                            <li key={opportunity}>{opportunity}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ValuationPage
