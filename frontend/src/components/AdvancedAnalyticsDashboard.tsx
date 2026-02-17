import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  MapPin, 
  PieChart,
  LineChart,
  Target,
  Users,
  DollarSign,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface AnalyticsData {
  totalCompanies: number
  totalRevenue: number
  avgGrowthRate: number
  topIndustries: { name: string; count: number; revenue: number }[]
  topCities: { name: string; count: number; avgRevenue: number }[]
  growthTrends: { period: string; growth: number }[]
  financialHealth: {
    excellent: number
    good: number
    fair: number
    poor: number
  }
  marketSegments: { segment: string; companies: number; avgGrowth: number }[]
}

const AdvancedAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('12m')
  const [selectedMetric, setSelectedMetric] = useState('revenue')

  // Mock data - replace with actual API calls
  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setData({
        totalCompanies: 8479,
        totalRevenue: 125000000000, // 125B SEK
        avgGrowthRate: 8.3,
        topIndustries: [
          { name: 'Technology & IT', count: 1676, revenue: 45000000000 },
          { name: 'Manufacturing', count: 1243, revenue: 32000000000 },
          { name: 'Healthcare', count: 892, revenue: 18000000000 },
          { name: 'Financial Services', count: 567, revenue: 15000000000 },
          { name: 'Retail', count: 445, revenue: 12000000000 }
        ],
        topCities: [
          { name: 'Stockholm', count: 2890, avgRevenue: 18000000 },
          { name: 'Gothenburg', count: 1234, avgRevenue: 15500000 },
          { name: 'Malmö', count: 892, avgRevenue: 14200000 },
          { name: 'Uppsala', count: 456, avgRevenue: 12800000 },
          { name: 'Linköping', count: 334, avgRevenue: 11500000 }
        ],
        growthTrends: [
          { period: '2023 Q1', growth: 6.2 },
          { period: '2023 Q2', growth: 7.8 },
          { period: '2023 Q3', growth: 8.1 },
          { period: '2023 Q4', growth: 8.9 },
          { period: '2024 Q1', growth: 9.2 },
          { period: '2024 Q2', growth: 8.7 }
        ],
        financialHealth: {
          excellent: 2341,
          good: 3456,
          fair: 2234,
          poor: 448
        },
        marketSegments: [
          { segment: 'High Growth', companies: 1234, avgGrowth: 25.3 },
          { segment: 'Stable', companies: 3456, avgGrowth: 8.7 },
          { segment: 'Mature', companies: 2890, avgGrowth: 2.1 },
          { segment: 'Declining', companies: 899, avgGrowth: -5.2 }
        ]
      })
      setLoading(false)
    }

    loadAnalytics()
  }, [selectedPeriod])

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (num: number): string => {
    return `${formatNumber(num)} SEK`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading analytics...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <div>Failed to load analytics data</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <p className="text-muted-foreground">Comprehensive business intelligence and market insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="12m">12 Months</SelectItem>
              <SelectItem value="24m">24 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Companies</p>
                <p className="text-2xl font-bold">{data.totalCompanies.toLocaleString()}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-primary mr-1" />
              <span className="text-primary">+12.3%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-primary mr-1" />
              <span className="text-primary">+8.7%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Growth Rate</p>
                <p className="text-2xl font-bold">{data.avgGrowthRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-primary mr-1" />
              <span className="text-primary">+2.1%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Market Segments</p>
                <p className="text-2xl font-bold">{data.marketSegments.length}</p>
              </div>
              <PieChart className="h-8 w-8 text-foreground" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <CheckCircle className="h-4 w-4 text-primary mr-1" />
              <span className="text-primary">Active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="industries" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="industries">Industries</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="health">Financial Health</TabsTrigger>
          <TabsTrigger value="segments">Market Segments</TabsTrigger>
        </TabsList>

        <TabsContent value="industries" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="h-5 w-5 mr-2" />
                  Top Industries by Company Count
                </CardTitle>
                <CardDescription>Leading industries in the Swedish market</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.topIndustries.map((industry, index) => (
                    <div key={industry.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary/15 rounded-full">
                          <span className="text-sm font-medium text-primary">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{industry.name}</p>
                          <p className="text-sm text-muted-foreground">{industry.count} companies</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{formatCurrency(industry.revenue)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Revenue Distribution
                </CardTitle>
                <CardDescription>Revenue breakdown by industry</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.topIndustries.map((industry) => {
                    const percentage = (industry.revenue / data.totalRevenue) * 100
                    return (
                      <div key={industry.name} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{industry.name}</span>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="geography" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Geographic Distribution
                </CardTitle>
                <CardDescription>Company concentration by city</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.topCities.map((city, index) => (
                    <div key={city.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary/15 rounded-full">
                          <span className="text-sm font-medium text-primary">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{city.name}</p>
                          <p className="text-sm text-muted-foreground">{city.count} companies</p>
                        </div>
                      </div>
                      <Badge variant="outline">{formatCurrency(city.avgRevenue)} avg</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Market Concentration
                </CardTitle>
                <CardDescription>Top cities market share</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.topCities.map((city) => {
                    const percentage = (city.count / data.totalCompanies) * 100
                    return (
                      <div key={city.name} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{city.name}</span>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LineChart className="h-5 w-5 mr-2" />
                Growth Trends Over Time
              </CardTitle>
              <CardDescription>Quarterly growth rate analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.growthTrends.map((trend, index) => (
                  <div key={trend.period} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-accent rounded-full">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{trend.period}</p>
                        <p className="text-sm text-muted-foreground">Quarterly growth</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {trend.growth >= 8 ? (
                        <TrendingUp className="h-4 w-4 text-primary" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                      <Badge variant={trend.growth >= 8 ? "default" : "secondary"}>
                        {trend.growth}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Financial Health Distribution
                </CardTitle>
                <CardDescription>Company financial health assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Excellent', count: data.financialHealth.excellent, color: 'bg-primary' },
                    { label: 'Good', count: data.financialHealth.good, color: 'bg-primary' },
                    { label: 'Fair', count: data.financialHealth.fair, color: 'bg-accent' },
                    { label: 'Poor', count: data.financialHealth.poor, color: 'bg-destructive' }
                  ].map((health) => {
                    const percentage = (health.count / data.totalCompanies) * 100
                    return (
                      <div key={health.label} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{health.label}</span>
                          <span>{health.count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className={`${health.color} h-2 rounded-full`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Health Insights
                </CardTitle>
                <CardDescription>Key financial health indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-primary mr-2" />
                      <div>
                        <p className="font-medium text-primary">Strong Performance</p>
                        <p className="text-sm text-primary">
                          {data.financialHealth.excellent + data.financialHealth.good} companies show good financial health
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-accent/60 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-foreground mr-2" />
                      <div>
                        <p className="font-medium text-foreground">Attention Needed</p>
                        <p className="text-sm text-foreground">
                          {data.financialHealth.poor} companies require immediate attention
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="h-5 w-5 mr-2" />
                Market Segmentation Analysis
              </CardTitle>
              <CardDescription>Company distribution by growth segments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.marketSegments.map((segment) => (
                  <div key={segment.segment} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{segment.segment}</h4>
                      <Badge variant={segment.avgGrowth > 10 ? "default" : segment.avgGrowth > 0 ? "secondary" : "destructive"}>
                        {segment.avgGrowth > 0 ? '+' : ''}{segment.avgGrowth}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{segment.companies} companies</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`${segment.avgGrowth > 10 ? 'bg-primary' : segment.avgGrowth > 0 ? 'bg-primary' : 'bg-destructive'} h-2 rounded-full`}
                        style={{ width: `${(segment.companies / data.totalCompanies) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdvancedAnalyticsDashboard

