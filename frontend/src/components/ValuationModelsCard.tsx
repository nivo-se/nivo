import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Building2, 
  Target,
  Info,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface ValuationResult {
  modelKey: string
  modelName: string
  valueEv: number | null
  valueEquity: number | null
  basis: string
  multipleUsed: number | null
  confidence: number
  inputs: {
    revenue?: number
    netProfit?: number
    ebitda?: number
    multiple?: number
    netDebt?: number
    netDebtMethod?: string
    netDebtSource?: string
    reason?: string
    [key: string]: any
  }
}

interface ValuationRun {
  id: string
  selectedModelKey: string | null
  valueType: 'equity' | 'ev'
}

interface ValuationModelsCardProps {
  runId: string
  orgnr: string
  onModelSelect?: (modelKey: string, valueType: 'equity' | 'ev') => void
  selectedModelKey?: string
  valueType?: 'equity' | 'ev'
}

const ValuationModelsCard: React.FC<ValuationModelsCardProps> = ({
  runId,
  orgnr,
  onModelSelect,
  selectedModelKey,
  valueType = 'equity'
}) => {
  const [valuations, setValuations] = useState<ValuationResult[]>([])
  const [valuationRun, setValuationRun] = useState<ValuationRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeValueType, setActiveValueType] = useState<'equity' | 'ev'>(valueType)

  useEffect(() => {
    loadValuations()
  }, [runId, orgnr])

  const loadValuations = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/valuation/${runId}/${orgnr}`)
      if (!response.ok) {
        // If API endpoint doesn't exist, use mock data
        console.warn('Valuation API endpoint not available, using mock data')
        const mockValuations: ValuationResult[] = [
          {
            modelKey: 'revenue_multiple',
            modelName: 'Omsättningsmultipel',
            valueEv: 168513,
            valueEquity: 146045,
            basis: 'Omsättning × 1.5x',
            multipleUsed: 1.5,
            confidence: 0.8,
            inputs: { revenue: 112342, multiple: 1.5, reason: 'Standard branschmultipel' }
          },
          {
            modelKey: 'ebitda_multiple',
            modelName: 'EBITDA-multipel',
            valueEv: 51108,
            valueEquity: 28640,
            basis: 'EBITDA × 6.0x',
            multipleUsed: 6.0,
            confidence: 0.85,
            inputs: { ebitda: 8518, multiple: 6.0, reason: 'Konservativ EBITDA-multipel' }
          },
          {
            modelKey: 'earnings_multiple',
            modelName: 'Vinstmultipel',
            valueEv: 53256,
            valueEquity: 30788,
            basis: 'Nettoresultat × 8.0x',
            multipleUsed: 8.0,
            confidence: 0.75,
            inputs: { netProfit: 6657, multiple: 8.0, reason: 'Standard vinstmultipel' }
          }
        ]
        
        setValuations(mockValuations)
        setValuationRun({
          id: runId,
          selectedModelKey: 'revenue_multiple',
          valueType: 'equity'
        })
        setActiveValueType('equity')
        return
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to load valuations')
      }

      setValuations(data.data.valuations || [])
      setValuationRun(data.data.valuationRun)
      
      if (data.data.valuationRun?.valueType) {
        setActiveValueType(data.data.valuationRun.valueType)
      }
    } catch (error) {
      console.error('Error loading valuations:', error)
      setError(error instanceof Error ? error.message : 'Failed to load valuations')
    } finally {
      setLoading(false)
    }
  }

  const handleModelSelect = async (modelKey: string) => {
    if (!valuationRun) return

    try {
      const response = await fetch(`/api/valuation/${valuationRun.id}/select`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelKey,
          valueType: activeValueType
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update model selection')
      }

      // Update local state
      setValuationRun(prev => prev ? { ...prev, selectedModelKey: modelKey, valueType: activeValueType } : null)
      
      // Notify parent component
      onModelSelect?.(modelKey, activeValueType)
    } catch (error) {
      console.error('Error selecting model:', error)
    }
  }

  const getModelIcon = (modelKey: string) => {
    switch (modelKey) {
      case 'revenue_multiple':
        return <TrendingUp className="h-4 w-4" />
      case 'ebitda_multiple':
        return <Building2 className="h-4 w-4" />
      case 'earnings_multiple':
        return <DollarSign className="h-4 w-4" />
      case 'dcf_lite':
        return <Calculator className="h-4 w-4" />
      case 'hybrid_score':
        return <Target className="h-4 w-4" />
      default:
        return <Calculator className="h-4 w-4" />
    }
  }

  const getModelDescription = (modelKey: string) => {
    switch (modelKey) {
      case 'revenue_multiple':
        return 'Enterprise Value = Omsättning × Multiple'
      case 'ebitda_multiple':
        return 'Enterprise Value = EBITDA × Multiple'
      case 'earnings_multiple':
        return 'Equity Value = Nettoresultat × Multiple'
      case 'dcf_lite':
        return 'Discounted Cash Flow med förenklade antaganden'
      case 'hybrid_score':
        return 'Viktad kombination av alla modeller'
      default:
        return 'Värderingsmodell'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800 border-green-200'
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  const formatValue = (value: number | null) => {
    if (value === null) return 'N/A'
    return `${(value / 1000000).toFixed(1)} MSEK`
  }

  const getNetDebtBadge = (inputs: any) => {
    if (inputs.netDebtMethod === 'zero') return null
    
    return (
      <Badge variant="outline" className="text-xs">
        <Info className="h-3 w-3 mr-1" />
        Net Debt: {inputs.netDebtSource || inputs.netDebtMethod}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Värderingsmodeller
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Laddar värderingsmodeller...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Värderingsmodeller
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (valuations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Värderingsmodeller
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Inga värderingsmodeller tillgängliga</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Värderingsmodeller
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Value Type Toggle */}
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Visa värde som:</Label>
          <Tabs value={activeValueType} onValueChange={(value: 'equity' | 'ev') => setActiveValueType(value)}>
            <TabsList>
              <TabsTrigger value="equity">Equity Value</TabsTrigger>
              <TabsTrigger value="ev">Enterprise Value</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Model Selection */}
        <RadioGroup 
          value={selectedModelKey || valuationRun?.selectedModelKey || ''} 
          onValueChange={handleModelSelect}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {valuations.map((valuation) => {
              const isSelected = (selectedModelKey || valuationRun?.selectedModelKey) === valuation.modelKey
              const displayValue = activeValueType === 'ev' ? valuation.valueEv : valuation.valueEquity
              const isNull = displayValue === null

              return (
                <div
                  key={valuation.modelKey}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleModelSelect(valuation.modelKey)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={valuation.modelKey} id={valuation.modelKey} />
                      <div className="flex items-center gap-2">
                        {getModelIcon(valuation.modelKey)}
                        <Label htmlFor={valuation.modelKey} className="font-medium cursor-pointer">
                          {valuation.modelName}
                        </Label>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {getModelDescription(valuation.modelKey)}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold">
                        {isNull ? (
                          <span className="text-gray-400">N/A</span>
                        ) : (
                          formatValue(displayValue)
                        )}
                      </div>
                      <Badge className={getConfidenceColor(valuation.confidence)}>
                        {valuation.confidence}%
                      </Badge>
                    </div>

                    {valuation.multipleUsed && (
                      <div className="text-sm text-gray-500">
                        Multiple: {valuation.multipleUsed}x
                      </div>
                    )}

                    {getNetDebtBadge(valuation.inputs)}

                    {valuation.inputs.reason && (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        {valuation.inputs.reason}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </RadioGroup>

        {/* Summary */}
        {selectedModelKey || valuationRun?.selectedModelKey ? (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Vald modell</h4>
            <p className="text-sm text-gray-600">
              {(() => {
                const selected = valuations.find(v => v.modelKey === (selectedModelKey || valuationRun?.selectedModelKey))
                if (!selected) return 'Ingen modell vald'
                
                const value = activeValueType === 'ev' ? selected.valueEv : selected.valueEquity
                const valueTypeText = activeValueType === 'ev' ? 'Enterprise Value' : 'Equity Value'
                
                return `${selected.modelName}: ${formatValue(value)} (${valueTypeText}) med ${selected.confidence}% konfidens`
              })()}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default ValuationModelsCard
