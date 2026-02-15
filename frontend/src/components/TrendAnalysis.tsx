import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { 
  LineChart, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Target,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Building2
} from 'lucide-react'

interface TrendData {
  revenue: { period: string; value: number; growth: number }[]
  profit: { period: string; value: number; growth: number }[]
  employees: { period: string; value: number; growth: number }[]
  industries: { industry: string; trend: 'up' | 'down' | 'stable'; growth: number }[]
  predictions: { period: string; predicted: number; confidence: number }[]
}

interface TrendAnalysisProps {
  selectedCompany?: string
  selectedIndustry?: string
}

const TrendAnalysis: React.FC<TrendAnalysisProps> = ({ 
  selectedCompany, 
  selectedIndustry 
}) => {
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState('revenue')
  const [selectedPeriod, setSelectedPeriod] = useState('24m')
  const [selectedTimeframe, setSelectedTimeframe] = useState('quarterly')

  useEffect(() => {
    const loadTrendData = async () => {
      setLoading(true)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setData({
        revenue: [
          { period: '2022 Q1', value: 125000000000, growth: 5.2 },
          { period: '2022 Q2', value: 128000000000, growth: 2.4 },
          { period: '2022 Q3', value: 132000000000, growth: 3.1 },
          { period: '2022 Q4', value: 135000000000, growth: 2.3 },
          { period: '2023 Q1', value: 140000000000, growth: 3.7 },
          { period: '2023 Q2', value: 145000000000, growth: 3.6 },
          { period: '2023 Q3', value: 148000000000, growth: 2.1 },
          { period: '2023 Q4', value: 152000000000, growth: 2.7 },
          { period: '2024 Q1', value: 158000000000, growth: 3.9 },
          { period: '2024 Q2', value: 162000000000, growth: 2.5 }
        ],
        profit: [
          { period: '2022 Q1', value: 8500000000, growth: 8.1 },
          { period: '2022 Q2', value: 9200000000, growth: 8.2 },
          { period: '2022 Q3', value: 9800000000, growth: 6.5 },
          { period: '2022 Q4', value: 10500000000, growth: 7.1 },
          { period: '2023 Q1', value: 11200000000, growth: 6.7 },
          { period: '2023 Q2', value: 11800000000, growth: 5.4 },
          { period: '2023 Q3', value: 12400000000, growth: 5.1 },
          { period: '2023 Q4', value: 12900000000, growth: 4.0 },
          { period: '2024 Q1', value: 13500000000, growth: 4.7 },
          { period: '2024 Q2', value: 14200000000, growth: 5.2 }
        ],
        employees: [
          { period: '2022 Q1', value: 485000, growth: 2.1 },
          { period: '2022 Q2', value: 492000, growth: 1.4 },
          { period: '2022 Q3', value: 498000, growth: 1.2 },
          { period: '2022 Q4', value: 503000, growth: 1.0 },
          { period: '2023 Q1', value: 508000, growth: 1.0 },
          { period: '2023 Q2', value: 512000, growth: 0.8 },
          { period: '2023 Q3', value: 516000, growth: 0.8 },
          { period: '2023 Q4', value: 519000, growth: 0.6 },
          { period: '2024 Q1', value: 522000, growth: 0.6 },
          { period: '2024 Q2', value: 525000, growth: 0.6 }
        ],
        industries: [
          { industry: 'Technology & IT', trend: 'up', growth: 12.3 },
          { industry: 'Healthcare', trend: 'up', growth: 8.7 },
          { industry: 'Financial Services', trend: 'stable', growth: 3.2 },
          { industry: 'Manufacturing', trend: 'down', growth: -1.5 },
          { industry: 'Retail', trend: 'stable', growth: 2.1 },
          { industry: 'Construction', trend: 'down', growth: -3.2 },
          { industry: 'Education', trend: 'stable', growth: 1.8 },
          { industry: 'Energy', trend: 'up', growth: 6.4 }
        ],
        predictions: [
          { period: '2024 Q3', predicted: 165000000000, confidence: 85 },
          { period: '2024 Q4', predicted: 168000000000, confidence: 82 },
          { period: '2025 Q1', predicted: 172000000000, confidence: 78 },
          { period: '2025 Q2', predicted: 176000000000, confidence: 75 }
        ]
      })
      setLoading(false)
    }

    loadTrendData()
  }, [selectedCompany, selectedIndustry, selectedPeriod])

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (num: number): string => {
    return `${formatNumber(num)} SEK`
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />
      default: return <div className="h-4 w-4 bg-gray-400 rounded-full"></div>
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return 'text-green-600 bg-green-50'
      case 'down': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Trend Analysis</h2>
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-600">Loading trends...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <div>Failed to load trend data</div>

  const currentData = data[selectedMetric as keyof TrendData] as any[]
  const latestValue = currentData[currentData.length - 1]
  const previousValue = currentData[currentData.length - 2]
  const growthRate = latestValue ? latestValue.growth : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold">Trend Analysis</h2>
          <p className="text-gray-600">
            {selectedCompany ? `Analyzing trends for ${selectedCompany}` : 
             selectedIndustry ? `Industry trends for ${selectedIndustry}` : 
             'Market-wide trend analysis'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="profit">Profit</SelectItem>
              <SelectItem value="employees">Employees</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="12m">12 Months</SelectItem>
              <SelectItem value="24m">24 Months</SelectItem>
              <SelectItem value="36m">36 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Value</p>
                <p className="text-2xl font-bold">
                  {selectedMetric === 'revenue' ? formatCurrency(latestValue?.value || 0) :
                   selectedMetric === 'profit' ? formatCurrency(latestValue?.value || 0) :
                   formatNumber(latestValue?.value || 0)}
                </p>
              </div>
              {selectedMetric === 'revenue' ? <DollarSign className="h-8 w-8 text-green-600" /> :
               selectedMetric === 'profit' ? <TrendingUp className="h-8 w-8 text-blue-600" /> :
               <Users className="h-8 w-8 text-purple-600" />}
            </div>
            <div className="mt-2 flex items-center text-sm">
              {growthRate > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={growthRate > 0 ? 'text-green-500' : 'text-red-500'}>
                {growthRate > 0 ? '+' : ''}{growthRate}%
              </span>
              <span className="text-gray-500 ml-1">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Growth</p>
                <p className="text-2xl font-bold">
                  {currentData.reduce((acc, curr) => acc + curr.growth, 0) / currentData.length}%
                </p>
              </div>
              <Target className="h-8 w-8 text-orange-600" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">Consistent</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Points</p>
                <p className="text-2xl font-bold">{currentData.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-indigo-600" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <Clock className="h-4 w-4 text-blue-500 mr-1" />
              <span className="text-blue-500">{selectedTimeframe}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Analysis Tabs */}
      <Tabs defaultValue="historical" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="historical">Historical Trends</TabsTrigger>
          <TabsTrigger value="industry">Industry Trends</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="historical" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LineChart className="h-5 w-5 mr-2" />
                Historical {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Trends
              </CardTitle>
              <CardDescription>
                {selectedPeriod} trend analysis with growth indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentData.map((point, index) => (
                  <div key={point.period} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                        <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{point.period}</p>
                        <p className="text-sm text-gray-600">
                          {selectedMetric === 'revenue' ? formatCurrency(point.value) :
                           selectedMetric === 'profit' ? formatCurrency(point.value) :
                           formatNumber(point.value)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {point.growth > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={point.growth > 0 ? "default" : "destructive"}>
                        {point.growth > 0 ? '+' : ''}{point.growth}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="industry" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Industry Trend Analysis
              </CardTitle>
              <CardDescription>Growth trends across different industries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.industries.map((industry) => (
                  <div key={industry.industry} className={`p-4 rounded-lg border ${getTrendColor(industry.trend)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getTrendIcon(industry.trend)}
                        <div>
                          <p className="font-medium">{industry.industry}</p>
                          <p className="text-sm opacity-75">
                            {industry.trend === 'up' ? 'Growing' : 
                             industry.trend === 'down' ? 'Declining' : 'Stable'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={industry.growth > 0 ? "default" : "destructive"}>
                        {industry.growth > 0 ? '+' : ''}{industry.growth}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Predictive Analysis
              </CardTitle>
              <CardDescription>AI-powered predictions based on historical trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.predictions.map((prediction, index) => (
                  <div key={prediction.period} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-full">
                        <Target className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">{prediction.period}</p>
                        <p className="text-sm text-gray-600">
                          Predicted: {formatCurrency(prediction.predicted)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          prediction.confidence >= 80 ? 'bg-green-500' :
                          prediction.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className="text-sm font-medium">
                          {prediction.confidence}% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Key Insights
                </CardTitle>
                <CardDescription>Automated insights from trend analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <div>
                        <p className="font-medium text-green-900">Positive Growth Trend</p>
                        <p className="text-sm text-green-700">
                          {selectedMetric} has shown consistent growth over the analyzed period
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                      <div>
                        <p className="font-medium text-blue-900">Above Average Performance</p>
                        <p className="text-sm text-blue-700">
                          Current growth rate exceeds market average
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                      <div>
                        <p className="font-medium text-yellow-900">Monitor Volatility</p>
                        <p className="text-sm text-yellow-700">
                          Some periods show higher volatility than others
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Recommendations
                </CardTitle>
                <CardDescription>AI-generated recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Growth Strategy</h4>
                    <p className="text-sm text-gray-600">
                      Consider investing in high-growth sectors to capitalize on current trends
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Risk Management</h4>
                    <p className="text-sm text-gray-600">
                      Diversify portfolio to reduce exposure to volatile segments
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Timing</h4>
                    <p className="text-sm text-gray-600">
                      Current market conditions favor expansion in technology and healthcare sectors
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TrendAnalysis

