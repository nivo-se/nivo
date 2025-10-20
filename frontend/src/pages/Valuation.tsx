import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { 
  Calculator, 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target,
  BarChart3,
  Settings,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react'
import { SavedListsService, SavedCompanyList } from '../lib/savedListsService'
import { toast } from '../components/ui/use-toast'

interface ValuationInputs {
  revenue: number
  netProfit: number
  ebitda: number
  revenueGrowth: number
  ebitMargin: number
  netProfitMargin: number
  employees: number
  industry: string
  sizeBucket: 'small' | 'medium' | 'large'
  growthBucket: 'low' | 'medium' | 'high'
}

interface ValuationAssumptions {
  revenueMultiple: number
  ebitdaMultiple: number
  earningsMultiple: number
  discountRate: number
  terminalMultiple: number
  netDebtMethod: 'ratio_revenue' | 'ratio_ebitda' | 'direct'
  netDebtK: number
  netDebtDirect: number
}

interface ValuationResult {
  modelKey: string
  modelName: string
  valueEv: number
  valueEquity: number
  multipleUsed: number | null
  confidence: number
  inputs: any
}

const Valuation: React.FC = () => {
  // Company selection
  const [selectedList, setSelectedList] = useState<SavedCompanyList | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [loadingLists, setLoadingLists] = useState(false)

  // Financial inputs
  const [inputs, setInputs] = useState<ValuationInputs>({
    revenue: 0,
    netProfit: 0,
    ebitda: 0,
    revenueGrowth: 0,
    ebitMargin: 0,
    netProfitMargin: 0,
    employees: 0,
    industry: '',
    sizeBucket: 'small',
    growthBucket: 'low'
  })

  // Valuation assumptions
  const [assumptions, setAssumptions] = useState<ValuationAssumptions>({
    revenueMultiple: 1.5,
    ebitdaMultiple: 6.0,
    earningsMultiple: 8.0,
    discountRate: 0.10,
    terminalMultiple: 8.0,
    netDebtMethod: 'ratio_revenue',
    netDebtK: 0.2,
    netDebtDirect: 0
  })

  // Results
  const [valuations, setValuations] = useState<ValuationResult[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('hybrid_score')
  const [valueType, setValueType] = useState<'equity' | 'ev'>('equity')
  const [loading, setLoading] = useState(false)

  // Load saved lists on mount
  useEffect(() => {
    loadSavedLists()
  }, [])

  // Auto-populate inputs when company is selected
  useEffect(() => {
    if (selectedCompany) {
      setInputs({
        revenue: selectedCompany.SDI || 0,
        netProfit: selectedCompany.DR || 0,
        ebitda: selectedCompany.ORS || 0,
        revenueGrowth: (selectedCompany.Revenue_growth || 0) * 100,
        ebitMargin: (selectedCompany.EBIT_margin || 0) * 100,
        netProfitMargin: (selectedCompany.NetProfit_margin || 0) * 100,
        employees: selectedCompany.employees || 0,
        industry: selectedCompany.segment_name || '',
        sizeBucket: (selectedCompany.SDI || 0) > 100000 ? 'large' : 
                   (selectedCompany.SDI || 0) > 10000 ? 'medium' : 'small',
        growthBucket: (selectedCompany.Revenue_growth || 0) > 0.1 ? 'high' : 
                     (selectedCompany.Revenue_growth || 0) > 0.05 ? 'medium' : 'low'
      })
    }
  }, [selectedCompany])

  const loadSavedLists = async () => {
    setLoadingLists(true)
    try {
      const lists = await SavedListsService.getSavedLists()
      setSavedLists(lists)
    } catch (error) {
      console.error('Error loading saved lists:', error)
      toast({
        title: 'Fel vid laddning av listor',
        description: 'Kunde inte ladda sparade företagslistor.',
        variant: 'destructive',
      })
    } finally {
      setLoadingLists(false)
    }
  }

  const calculateValuations = async () => {
    if (!selectedCompany) {
      toast({
        title: 'Välj företag',
        description: 'Du måste välja ett företag först.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // Simulate API call - replace with actual valuation API
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock valuation results
      const mockResults: ValuationResult[] = [
        {
          modelKey: 'revenue_multiple',
          modelName: 'Omsättningsmultipel',
          valueEv: inputs.revenue * assumptions.revenueMultiple,
          valueEquity: inputs.revenue * assumptions.revenueMultiple - (inputs.revenue * assumptions.netDebtK),
          multipleUsed: assumptions.revenueMultiple,
          confidence: 0.8,
          inputs: { revenue: inputs.revenue, multiple: assumptions.revenueMultiple }
        },
        {
          modelKey: 'ebitda_multiple',
          modelName: 'EBITDA-multipel',
          valueEv: inputs.ebitda * assumptions.ebitdaMultiple,
          valueEquity: inputs.ebitda * assumptions.ebitdaMultiple - (inputs.revenue * assumptions.netDebtK),
          multipleUsed: assumptions.ebitdaMultiple,
          confidence: 0.85,
          inputs: { ebitda: inputs.ebitda, multiple: assumptions.ebitdaMultiple }
        },
        {
          modelKey: 'earnings_multiple',
          modelName: 'Vinstmultipel',
          valueEv: inputs.netProfit * assumptions.earningsMultiple,
          valueEquity: inputs.netProfit * assumptions.earningsMultiple - (inputs.revenue * assumptions.netDebtK),
          multipleUsed: assumptions.earningsMultiple,
          confidence: 0.75,
          inputs: { netProfit: inputs.netProfit, multiple: assumptions.earningsMultiple }
        }
      ]
      
      setValuations(mockResults)
      setSelectedModel('revenue_multiple')
      
      toast({
        title: 'Värderingar beräknade',
        description: `${mockResults.length} värderingsmodeller har beräknats.`,
      })
    } catch (error) {
      console.error('Error calculating valuations:', error)
      toast({
        title: 'Fel vid beräkning',
        description: 'Kunde inte beräkna värderingar. Försök igen.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('sv-SE').format(value)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Värderingsanalys</h1>
          <p className="text-gray-600 mt-1">Beräkna och jämför olika värderingsmodeller för svenska företag</p>
        </div>
        <Button 
          onClick={calculateValuations} 
          disabled={!selectedCompany || loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Beräknar...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Beräkna värderingar
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Company Selection & Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Företagsval
              </CardTitle>
              <CardDescription>
                Välj företag från dina sparade listor för värdering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* List Selection */}
              <div className="space-y-2">
                <Label>Välj sparad lista</Label>
                <Select 
                  value={selectedList?.id || ''} 
                  onValueChange={(value) => {
                    const list = savedLists.find(l => l.id === value)
                    setSelectedList(list || null)
                    setSelectedCompany(null)
                  }}
                  disabled={loadingLists}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingLists ? "Laddar listor..." : "Välj en sparad lista"} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedLists.length > 0 ? (
                      savedLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.companies.length} företag)
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-lists" disabled>
                        Inga sparade listor
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Company Selection */}
              {selectedList && (
                <div className="space-y-2">
                  <Label>Välj företag</Label>
                  <Select 
                    value={selectedCompany?.OrgNr || ''} 
                    onValueChange={(value) => {
                      const company = selectedList.companies.find(c => c.OrgNr === value)
                      setSelectedCompany(company || null)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj företag..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedList.companies.map((company) => (
                        <SelectItem key={company.OrgNr} value={company.OrgNr}>
                          {company.name} ({company.OrgNr})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Company Info */}
              {selectedCompany && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-lg mb-2">{selectedCompany.name}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Organisationsnummer:</span>
                      <p className="font-medium">{selectedCompany.OrgNr}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Bransch:</span>
                      <p className="font-medium">{selectedCompany.segment_name || 'Okänt'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Omsättning:</span>
                      <p className="font-medium">{formatCurrency(selectedCompany.SDI || 0)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Anställda:</span>
                      <p className="font-medium">{selectedCompany.employees || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Finansiella indata
              </CardTitle>
              <CardDescription>
                Justera finansiella siffror för värderingsberäkning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue">Omsättning (SEK)</Label>
                  <Input
                    id="revenue"
                    type="number"
                    value={inputs.revenue}
                    onChange={(e) => setInputs(prev => ({ ...prev, revenue: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="netProfit">Nettoresultat (SEK)</Label>
                  <Input
                    id="netProfit"
                    type="number"
                    value={inputs.netProfit}
                    onChange={(e) => setInputs(prev => ({ ...prev, netProfit: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ebitda">EBITDA (SEK)</Label>
                  <Input
                    id="ebitda"
                    type="number"
                    value={inputs.ebitda}
                    onChange={(e) => setInputs(prev => ({ ...prev, ebitda: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employees">Anställda</Label>
                  <Input
                    id="employees"
                    type="number"
                    value={inputs.employees}
                    onChange={(e) => setInputs(prev => ({ ...prev, employees: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenueGrowth">Tillväxt (%)</Label>
                  <Input
                    id="revenueGrowth"
                    type="number"
                    step="0.1"
                    value={inputs.revenueGrowth}
                    onChange={(e) => setInputs(prev => ({ ...prev, revenueGrowth: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ebitMargin">EBIT-marginal (%)</Label>
                  <Input
                    id="ebitMargin"
                    type="number"
                    step="0.1"
                    value={inputs.ebitMargin}
                    onChange={(e) => setInputs(prev => ({ ...prev, ebitMargin: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Valuation Assumptions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Värderingsantaganden
              </CardTitle>
              <CardDescription>
                Justera multiplar och antaganden för olika värderingsmodeller
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenueMultiple">Omsättningsmultipel</Label>
                  <Input
                    id="revenueMultiple"
                    type="number"
                    step="0.1"
                    value={assumptions.revenueMultiple}
                    onChange={(e) => setAssumptions(prev => ({ ...prev, revenueMultiple: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ebitdaMultiple">EBITDA-multipel</Label>
                  <Input
                    id="ebitdaMultiple"
                    type="number"
                    step="0.1"
                    value={assumptions.ebitdaMultiple}
                    onChange={(e) => setAssumptions(prev => ({ ...prev, ebitdaMultiple: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="earningsMultiple">Vinstmultipel</Label>
                  <Input
                    id="earningsMultiple"
                    type="number"
                    step="0.1"
                    value={assumptions.earningsMultiple}
                    onChange={(e) => setAssumptions(prev => ({ ...prev, earningsMultiple: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountRate">Diskontränta (%)</Label>
                  <Input
                    id="discountRate"
                    type="number"
                    step="0.1"
                    value={assumptions.discountRate * 100}
                    onChange={(e) => setAssumptions(prev => ({ ...prev, discountRate: Number(e.target.value) / 100 }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Value Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Värdevisning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={valueType} onValueChange={(value) => setValueType(value as 'equity' | 'ev')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="equity">Equity Value</TabsTrigger>
                  <TabsTrigger value="ev">Enterprise Value</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* Valuation Results */}
          {valuations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Värderingsresultat
                </CardTitle>
                <CardDescription>
                  Jämför olika värderingsmodeller
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {valuations.map((valuation) => (
                    <div 
                      key={valuation.modelKey}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedModel === valuation.modelKey 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedModel(valuation.modelKey)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{valuation.modelName}</h3>
                        <Badge variant={selectedModel === valuation.modelKey ? 'default' : 'secondary'}>
                          {Math.round(valuation.confidence * 100)}% konfidens
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(valueType === 'equity' ? valuation.valueEquity : valuation.valueEv)}
                      </div>
                      {valuation.multipleUsed && (
                        <div className="text-sm text-gray-600 mt-1">
                          Multippel: {valuation.multipleUsed}x
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {selectedCompany && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  Sammanfattning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Företag:</span>
                    <span className="font-medium">{selectedCompany.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Omsättning:</span>
                    <span className="font-medium">{formatCurrency(inputs.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nettoresultat:</span>
                    <span className="font-medium">{formatCurrency(inputs.netProfit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">EBITDA:</span>
                    <span className="font-medium">{formatCurrency(inputs.ebitda)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Anställda:</span>
                    <span className="font-medium">{formatNumber(inputs.employees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tillväxt:</span>
                    <span className="font-medium">{inputs.revenueGrowth.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">EBIT-marginal:</span>
                    <span className="font-medium">{inputs.ebitMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default Valuation