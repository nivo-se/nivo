import React, { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Loader2, TrendingUp, DollarSign, BarChart3, Users, AlertCircle } from 'lucide-react'
import { intelligenceService, type FilterWeights, type FilterAnalytics } from '../lib/intelligenceService'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface FinancialFilterPanelProps {
  onShortlistGenerated?: (companies: any[]) => void
}

export const FinancialFilterPanel: React.FC<FinancialFilterPanelProps> = ({ onShortlistGenerated }) => {
  const [weights, setWeights] = useState<FilterWeights>({
    revenue: 30,
    ebitMargin: 25,
    growth: 25,
    leverage: 10,
    headcount: 10
  })
  const [usePercentiles, setUsePercentiles] = useState(false)
  const [stageOneSize, setStageOneSize] = useState(180)

  // Fetch analytics for current weights
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ['filter-analytics', weights, usePercentiles],
    queryFn: () => intelligenceService.getFilterAnalytics(weights, usePercentiles),
    staleTime: 30000, // 30 seconds
  })

  // Apply filters mutation
  const applyFiltersMutation = useMutation({
    mutationFn: () => intelligenceService.applyFilters(weights),
    onSuccess: (data) => {
      if (onShortlistGenerated) {
        onShortlistGenerated(data.companies)
      }
    },
  })

  // Normalize weights to sum to 100
  const normalizeWeights = (newWeights: FilterWeights): FilterWeights => {
    const total = newWeights.revenue + newWeights.ebitMargin + newWeights.growth + newWeights.leverage + newWeights.headcount
    if (total === 0) return newWeights
    const factor = 100 / total
    return {
      revenue: Math.round(newWeights.revenue * factor),
      ebitMargin: Math.round(newWeights.ebitMargin * factor),
      growth: Math.round(newWeights.growth * factor),
      leverage: Math.round(newWeights.leverage * factor),
      headcount: Math.round(newWeights.headcount * factor),
    }
  }

  const handleWeightChange = (key: keyof FilterWeights, value: number[]) => {
    const newWeights = { ...weights, [key]: value[0] }
    const normalized = normalizeWeights(newWeights)
    setWeights(normalized)
  }

  const handleRunStage1 = () => {
    applyFiltersMutation.mutate()
  }

  const totalWeight = weights.revenue + weights.ebitMargin + weights.growth + weights.leverage + weights.headcount

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Financial Filter Configuration</CardTitle>
          <CardDescription>
            Adjust weights for financial metrics to generate Stage 1 shortlist (150-180 companies)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Weight Sliders */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Revenue Weight
                </Label>
                <span className="text-sm font-medium">{weights.revenue}%</span>
              </div>
              <Slider
                value={[weights.revenue]}
                onValueChange={(value) => handleWeightChange('revenue', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  EBIT Margin Weight
                </Label>
                <span className="text-sm font-medium">{weights.ebitMargin}%</span>
              </div>
              <Slider
                value={[weights.ebitMargin]}
                onValueChange={(value) => handleWeightChange('ebitMargin', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Growth Weight
                </Label>
                <span className="text-sm font-medium">{weights.growth}%</span>
              </div>
              <Slider
                value={[weights.growth]}
                onValueChange={(value) => handleWeightChange('growth', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Leverage Weight
                </Label>
                <span className="text-sm font-medium">{weights.leverage}%</span>
              </div>
              <Slider
                value={[weights.leverage]}
                onValueChange={(value) => handleWeightChange('leverage', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Headcount Weight
                </Label>
                <span className="text-sm font-medium">{weights.headcount}%</span>
              </div>
              <Slider
                value={[weights.headcount]}
                onValueChange={(value) => handleWeightChange('headcount', value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Total weight indicator */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Total Weight</span>
            <span className={`text-sm font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-orange-600'}`}>
              {totalWeight}%
            </span>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Switch
              id="use-percentiles"
              checked={usePercentiles}
              onCheckedChange={setUsePercentiles}
            />
            <Label htmlFor="use-percentiles">Use Percentile Filters</Label>
          </div>

          {/* Stage 1 Size */}
          <div>
            <Label htmlFor="stage-one-size">Stage 1 Shortlist Size</Label>
            <input
              id="stage-one-size"
              type="number"
              min={50}
              max={300}
              value={stageOneSize}
              onChange={(e) => setStageOneSize(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 border rounded-md"
            />
          </div>

          {/* Run Stage 1 Button */}
          <Button
            onClick={handleRunStage1}
            disabled={applyFiltersMutation.isPending || totalWeight !== 100}
            className="w-full"
            size="lg"
          >
            {applyFiltersMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Shortlist...
              </>
            ) : (
              `Run Stage 1 (Generate ${stageOneSize} Company Shortlist)`
            )}
          </Button>

          {applyFiltersMutation.isError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              Error: {applyFiltersMutation.error?.message || 'Failed to generate shortlist'}
            </div>
          )}

          {applyFiltersMutation.isSuccess && (
            <div className="p-3 bg-green-50 text-green-800 rounded-md text-sm">
              ✅ Generated shortlist with {applyFiltersMutation.data?.total || 0} companies
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics Visualizations */}
      {analyticsLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading analytics...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {analyticsError && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-destructive">
              Error loading analytics: {analyticsError.message}
            </div>
          </CardContent>
        </Card>
      )}

      {analytics && (
        <>
          {/* Scatter Plot */}
          <Card>
            <CardHeader>
              <CardTitle>Growth vs Margin Distribution</CardTitle>
              <CardDescription>Company distribution by revenue growth and EBITDA margin</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart data={analytics.scatter_data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Revenue Growth"
                    label={{ value: 'Revenue Growth (CAGR)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="EBITDA Margin"
                    label={{ value: 'EBITDA Margin (decimal)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white p-3 border rounded shadow-lg">
                            <p className="font-semibold">{data.name}</p>
                            <p className="text-sm">Growth: {(data.x * 100).toFixed(1)}%</p>
                            <p className="text-sm">EBITDA Margin: {(data.y * 100).toFixed(1)}%</p>
                            <p className="text-sm">Revenue: {(data.revenue / 1000).toFixed(1)} MSEK</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Scatter name="Companies" data={analytics.scatter_data} fill="#8884d8">
                    {analytics.scatter_data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#8884d8" />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Clusters */}
          <Card>
            <CardHeader>
              <CardTitle>Company Clusters</CardTitle>
              <CardDescription>Distribution by growth and margin profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {analytics.clusters.map((cluster) => (
                  <div key={cluster.id} className="p-4 border rounded-lg">
                    <div className="font-semibold">{cluster.name}</div>
                    <div className="text-2xl font-bold mt-2">{cluster.count}</div>
                    <div className="text-sm text-muted-foreground">companies</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

