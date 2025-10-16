import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'

interface MetricResult {
  metric_name: string
  metric_value: number
  metric_unit?: string | null
  source?: string | null
  year?: number | null
  confidence?: number | null
}

interface FinancialMetricsCardProps {
  metrics: MetricResult[]
  benchmarks?: {
    segment?: string | null
    avgRevenueGrowth?: number | null
    avgEbitMargin?: number | null
    avgNetMargin?: number | null
    avgEquityRatio?: number | null
  } | null
}

export function FinancialMetricsCard({ metrics, benchmarks }: FinancialMetricsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'confidence'>('name')

  const formatValue = (value: number, unit?: string | null) => {
    if (unit === '%') {
      return `${(value * 100).toFixed(1)}%`
    }
    if (unit === 'TSEK') {
      return `${value.toLocaleString('sv-SE')} TSEK`
    }
    if (unit === 'x' || unit === 'ratio') {
      return value.toFixed(2)
    }
    return value.toLocaleString('sv-SE')
  }

  const getMetricIcon = (metricName: string) => {
    const name = metricName.toLowerCase()
    if (name.includes('tillväxt') || name.includes('growth')) {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    }
    if (name.includes('marginal') || name.includes('margin')) {
      return <BarChart3 className="h-4 w-4 text-blue-600" />
    }
    if (name.includes('soliditet') || name.includes('equity')) {
      return <BarChart3 className="h-4 w-4 text-purple-600" />
    }
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  const getMetricColor = (metricName: string, value: number) => {
    const name = metricName.toLowerCase()
    
    // Growth metrics - green for positive, red for negative
    if (name.includes('tillväxt') || name.includes('growth')) {
      return value > 0 ? 'text-green-600' : 'text-red-600'
    }
    
    // Margin metrics - green for high, yellow for medium, red for low
    if (name.includes('marginal') || name.includes('margin')) {
      if (value > 0.1) return 'text-green-600'
      if (value > 0.05) return 'text-yellow-600'
      return 'text-red-600'
    }
    
    // Equity ratio - green for high, yellow for medium, red for low
    if (name.includes('soliditet') || name.includes('equity')) {
      if (value > 0.3) return 'text-green-600'
      if (value > 0.2) return 'text-yellow-600'
      return 'text-red-600'
    }
    
    return 'text-gray-600'
  }

  const getBenchmarkComparison = (metricName: string, value: number) => {
    if (!benchmarks) return null
    
    const name = metricName.toLowerCase()
    
    if (name.includes('tillväxt') && benchmarks.avgRevenueGrowth !== null) {
      const diff = value - (benchmarks.avgRevenueGrowth || 0)
      return {
        benchmark: benchmarks.avgRevenueGrowth,
        difference: diff,
        isBetter: diff > 0
      }
    }
    
    if (name.includes('ebit') && benchmarks.avgEbitMargin !== null) {
      const diff = value - (benchmarks.avgEbitMargin || 0)
      return {
        benchmark: benchmarks.avgEbitMargin,
        difference: diff,
        isBetter: diff > 0
      }
    }
    
    if (name.includes('netto') && benchmarks.avgNetMargin !== null) {
      const diff = value - (benchmarks.avgNetMargin || 0)
      return {
        benchmark: benchmarks.avgNetMargin,
        difference: diff,
        isBetter: diff > 0
      }
    }
    
    if (name.includes('soliditet') && benchmarks.avgEquityRatio !== null) {
      const diff = value - (benchmarks.avgEquityRatio || 0)
      return {
        benchmark: benchmarks.avgEquityRatio,
        difference: diff,
        isBetter: diff > 0
      }
    }
    
    return null
  }

  const sortedMetrics = [...metrics].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return b.metric_value - a.metric_value
      case 'confidence':
        return (b.confidence || 0) - (a.confidence || 0)
      default:
        return a.metric_name.localeCompare(b.metric_name)
    }
  })

  const displayedMetrics = isExpanded ? sortedMetrics : sortedMetrics.slice(0, 4)
  const hasMoreMetrics = metrics.length > 4

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Finansiella Nyckeltal
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {metrics.length} nyckeltal • {benchmarks?.segment ? `Benchmark: ${benchmarks.segment}` : 'Ingen benchmark tillgänglig'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'value' | 'confidence')}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="name">Sortera efter namn</option>
              <option value="value">Sortera efter värde</option>
              <option value="confidence">Sortera efter tillförlitlighet</option>
            </select>
            
            {hasMoreMetrics && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 px-3"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Visa färre
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Visa alla
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {displayedMetrics.map((metric, index) => {
            const benchmark = getBenchmarkComparison(metric.metric_name, metric.metric_value)
            
            return (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex-shrink-0">
                    {getMetricIcon(metric.metric_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {metric.metric_name}
                    </h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {metric.year ? `År ${metric.year}` : 'Senaste data'}
                      </span>
                      {metric.confidence && (
                        <Badge variant="secondary" className="text-xs">
                          {metric.confidence}% tillförlitlighet
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${getMetricColor(metric.metric_name, metric.metric_value)}`}>
                      {formatValue(metric.metric_value, metric.metric_unit)}
                    </div>
                    {benchmark && (
                      <div className="text-xs text-gray-500">
                        vs {formatValue(benchmark.benchmark, metric.metric_unit)} benchmark
                        <span className={`ml-1 ${benchmark.isBetter ? 'text-green-600' : 'text-red-600'}`}>
                          ({benchmark.isBetter ? '+' : ''}{formatValue(benchmark.difference, metric.metric_unit)})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {metrics.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>Inga finansiella nyckeltal tillgängliga</p>
          </div>
        )}
        
        {/* Summary Stats */}
        {metrics.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">{metrics.length}</div>
                <div className="text-xs text-gray-600">Totalt nyckeltal</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.filter(m => m.confidence && m.confidence > 80).length}
                </div>
                <div className="text-xs text-gray-600">Hög tillförlitlighet</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {benchmarks ? 'Ja' : 'Nej'}
                </div>
                <div className="text-xs text-gray-600">Benchmark tillgänglig</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
