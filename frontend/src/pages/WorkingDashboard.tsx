import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BarChart3, Building2, Search, Brain, FileText, Download, Shield, Menu, X, LogOut, User, Loader2, Target, TrendingUp, DollarSign, Users } from 'lucide-react'
import { supabaseDataService, DashboardAnalytics } from '../lib/supabaseDataService'
import { supabaseConfig } from '../lib/supabase'
import EnhancedCompanySearch from '../components/EnhancedCompanySearch'
import BusinessRulesConfig from '../components/BusinessRulesConfig'
import DataExport from '../components/DataExport'
import ListBasedAnalytics from '../components/ListBasedAnalytics'
import AIAnalytics from '../components/AIAnalytics'
import AIAnalysis from '../components/AIAnalysis'
import AnalyzedCompanies from '../pages/AnalyzedCompanies'
import Valuation from '../pages/Valuation'
import AdminPanel from '../components/AdminPanel'
import SegmentationTiers from '../components/SegmentationTiers'
import { FinancialFilterPanel } from '../components/FinancialFilterPanel'
import { AIDeepDivePanel } from '../components/AIDeepDivePanel'

const WorkingDashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState('overview')
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const { user, userRole, signOut } = useAuth()
  const supabaseEnabled = supabaseConfig.isConfigured

  // Load dashboard analytics
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true)
        const data = await supabaseDataService.getDashboardAnalytics()
        setAnalytics(data)
        // Log card values for verification
        const cardValues = {
          'Card 1 - Totalt antal företag': data.totalCompanies?.toLocaleString('sv-SE') || 'N/A',
          'Card 2 - Genomsnittlig omsättning': data.averageRevenue ? `${(data.averageRevenue / 1_000_000).toFixed(1)} mSEK` : 'N/A',
          'Card 3 - Genomsnittlig tillväxt': data.averageRevenueGrowth ? `${(data.averageRevenueGrowth * 100).toFixed(1)}%` : 'N/A',
          'Card 4 - EBIT-marginal': data.averageEBITMargin ? `${(data.averageEBITMargin * 100).toFixed(1)}%` : 'N/A',
          'Card 5 - Vinstmarginal': data.averageNetProfitMargin ? `${(data.averageNetProfitMargin * 100).toFixed(1)}%` : 'N/A'
        }
        console.log('[Dashboard] Loaded analytics - Card Values:', cardValues)
      } catch (error) {
        console.error('Error loading analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [])

  // Check if user is admin
  const isAdmin = userRole === 'admin' || user?.email === 'jesper@rgcapital.se'

  interface MenuItem {
    id: string
    label: string
    icon: any
    disabled?: boolean
  }

  const menuItems: MenuItem[] = [
    { id: 'overview', label: 'Översikt', icon: BarChart3 },
    { id: 'financial-filters', label: 'Financial Filters', icon: Target },
    { id: 'companies', label: 'Företagssökning', icon: Search },
    { id: 'segmentation', label: 'Segmentering', icon: Target },
    { id: 'analytics', label: 'Analys', icon: Building2 },
    { id: 'ai-insights', label: 'AI-insikter', icon: Brain },
    { id: 'analyzed-companies', label: 'Analyser', icon: FileText },
    { id: 'valuation', label: 'Värdering', icon: Target },
    { id: 'export', label: 'Exportera', icon: Download },
  ]

  // Add admin item at the bottom if user is admin
  const adminItems: MenuItem[] = isAdmin ? [{ id: 'admin', label: 'Admin', icon: Shield }] : []
  const allMenuItems = [...menuItems, ...adminItems]

  const formatMillion = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'N/A'
    }
    if (Math.abs(value) >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)} bSEK`  // Database stores in actual SEK
    }
    return `${(value / 1_000_000).toFixed(1)} mSEK`  // Database stores in actual SEK
  }

  const formatPercent = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'N/A'
    }
    // Value is already a decimal (e.g., 0.1175 = 11.75%)
    return `${(value * 100).toFixed(1)}%`
  }

  const industryColors = ['bg-primary', 'bg-chart-2', 'bg-primary', 'bg-accent', 'bg-destructive']
  const sizeColorMap: Record<string, string> = {
    'Mikro (1-9)': 'bg-muted/70',
    'Små (10-49)': 'bg-muted-foreground',
    'Medelstora (50-249)': 'bg-foreground/70',
    'Stora (250+)': 'bg-foreground/80',
  }

  const digitalPresenceShare =
    analytics && analytics.totalCompanies
      ? analytics.totalWithDigitalPresence / analytics.totalCompanies
      : null

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedView = params.get('view') || params.get('tab')
    if (requestedView && [...menuItems, ...adminItems].some((item) => item.id === requestedView)) {
      setCurrentPage(requestedView)
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch (err) {
      console.error('Logout error:', err)
      window.location.href = '/'
    }
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'financial-filters':
        return <FinancialFilterPanel />
      
      case 'overview': {
        const metricCards = [
          {
            key: 'avgRevenue',
            label: 'Genomsnittlig omsättning',
            value: formatMillion(analytics?.averageRevenue),
            icon: DollarSign,
            iconClass: 'text-primary',
          },
          {
            key: 'avgRevenueGrowth',
            label: 'Genomsnittlig tillväxt (3 år CAGR)',
            value: formatPercent(analytics?.averageRevenueGrowth),
            icon: TrendingUp,
            iconClass: 'text-primary',
          },
          {
            key: 'avgEbitMargin',
            label: 'Genomsnittlig EBIT-marginal',
            value: formatPercent(analytics?.averageEBITMargin),
            icon: BarChart3,
            iconClass: 'text-primary',
          },
          {
            key: 'avgNetMargin',
            label: 'Genomsnittlig vinstmarginal',
            value: formatPercent(analytics?.averageNetProfitMargin),
            icon: Target,
            iconClass: 'text-foreground',
          },
          {
            key: 'totalCompanies',
            label: 'Totalt antal företag',
            value: analytics?.totalCompanies ? analytics.totalCompanies.toLocaleString('sv-SE') : 'N/A',
            icon: Building2,
            iconClass: 'text-indigo-600',
          },
        ]

        const industryDistribution = analytics?.topIndustries ?? []
        const sizeDistribution = analytics?.companySizeDistribution ?? []
        
        // Debug logging
        console.log('[Dashboard] Analytics object:', analytics)
        console.log('[Dashboard] Size distribution from analytics:', analytics?.companySizeDistribution)
        console.log('[Dashboard] Size distribution variable:', sizeDistribution)
        console.log('[Dashboard] Size distribution length:', sizeDistribution.length)
        if (sizeDistribution.length > 0) {
          console.log('[Dashboard] First size item:', sizeDistribution[0])
        }

        return (
          <div className="space-y-6">
            <div className="bg-card rounded-lg p-6 text-primary-foreground">
              <h2 className="text-base font-bold mb-2">Välkommen till Nivo Dashboard</h2>
              <p className="text-muted-foreground">
                Din omfattande affärsintelligensplattform med realtidsdata och insikter.
              </p>
            </div>

            {!supabaseEnabled && (
              <Alert>
                <AlertDescription>
                  Supabase-integration är inte konfigurerad i denna miljö. Instrumentpanelen använder det incheckade demo-
                  datasetet för att visa funktionaliteten.
                </AlertDescription>
              </Alert>
            )}
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Laddar instrumentpanelsdata...</span>
              </div>
            ) : (
              <>
                {/* Key Metrics - Using Analytics Tab Style */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {metricCards.map(({ key, label, value, icon: Icon, iconClass }) => (
                    <Card key={key} className="border-border">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">{label}</p>
                            <p className="text-base font-bold text-foreground">{value}</p>
                          </div>
                          <Icon className={`h-8 w-8 ${iconClass}`} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Industry and Market Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Branschfördelning</CardTitle>
                      <CardDescription className="text-muted-foreground">Företag efter branschsegment</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {industryDistribution.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Ingen branschdata tillgänglig.</p>
                        ) : (
                          <>
                            {industryDistribution.map((industry, index) => (
                              <div key={industry.name} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div
                                    className={`w-3 h-3 rounded-full ${
                                      industryColors[index % industryColors.length]
                                    }`}
                                  ></div>
                                  <span className="text-sm font-medium text-foreground">
                                    {industry.name}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-foreground">
                                    {industry.count.toLocaleString('sv-SE')}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {industry.percentage ? industry.percentage.toFixed(1) : '0.0'}%
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">Totalt</span>
                              <div className="text-right">
                                <div className="text-sm font-bold text-foreground">
                                  {analytics?.totalCompanies?.toLocaleString('sv-SE') || '0'}
                                </div>
                                <div className="text-xs text-muted-foreground">100.0%</div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Företagsstorleksfördelning</CardTitle>
                      <CardDescription className="text-muted-foreground">Företag efter omsättning</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {sizeDistribution.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Ingen storleksdata tillgänglig.</p>
                        ) : (
                          <>
                            {sizeDistribution.map((size) => (
                              <div key={size.name} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div
                                    className={`w-3 h-3 rounded-full ${
                                      sizeColorMap[size.name] || 'bg-muted-foreground'
                                    }`}
                                  ></div>
                                  <span className="text-sm font-medium text-foreground">{size.name}</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-foreground">
                                    {size.count.toLocaleString('sv-SE')}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {size.percentage ? size.percentage.toFixed(1) : '0.0'}%
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">Totalt</span>
                              <div className="text-right">
                                <div className="text-sm font-bold text-foreground">
                                  {analytics?.totalCompanies?.toLocaleString('sv-SE') || '0'}
                                </div>
                                <div className="text-xs text-muted-foreground">100.0%</div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                </div>

                {/* Margin Analysis Card */}
                {analytics?.marginAnalysis && (
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Finansiell analys - Detaljerad översikt</CardTitle>
                      <CardDescription className="text-muted-foreground">Fördelning av lönsamhet och marginaler</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Profit Analysis */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-foreground text-sm mb-3">Vinst (Nettoresultat)</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Negativ vinst:</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-destructive">
                                  {analytics.marginAnalysis.profit.negative.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.profit.negative / analytics.marginAnalysis.profit.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Positiv vinst:</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-primary">
                                  {analytics.marginAnalysis.profit.positive.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.profit.positive / analytics.marginAnalysis.profit.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Saknar data:</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-foreground">
                                  {analytics.marginAnalysis.profit.null.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.profit.null / analytics.marginAnalysis.profit.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* EBIT Analysis */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-foreground text-sm mb-3">EBIT (Rörelseresultat)</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Negativ EBIT:</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-destructive">
                                  {analytics.marginAnalysis.ebit.negative.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.ebit.negative / analytics.marginAnalysis.ebit.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Positiv EBIT:</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-primary">
                                  {analytics.marginAnalysis.ebit.positive.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.ebit.positive / analytics.marginAnalysis.ebit.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Saknar data:</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-foreground">
                                  {analytics.marginAnalysis.ebit.null.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.ebit.null / analytics.marginAnalysis.ebit.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* EBIT Margin Analysis */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-foreground text-sm mb-3">EBIT-marginal</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Extrem negativ (&lt; -100%):</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-destructive">
                                  {analytics.marginAnalysis.ebitdaMargin.extremeNegative.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.ebitdaMargin.extremeNegative / analytics.marginAnalysis.ebitdaMargin.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Negativ (-100% till 0%):</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-foreground">
                                  {analytics.marginAnalysis.ebitdaMargin.negative.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.ebitdaMargin.negative / analytics.marginAnalysis.ebitdaMargin.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Positiv (0% till 100%):</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-primary">
                                  {analytics.marginAnalysis.ebitdaMargin.positive.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.ebitdaMargin.positive / analytics.marginAnalysis.ebitdaMargin.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Extrem positiv (&gt; 100%):</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-primary">
                                  {analytics.marginAnalysis.ebitdaMargin.extremePositive.toLocaleString('sv-SE')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({((analytics.marginAnalysis.ebitdaMargin.extremePositive / analytics.marginAnalysis.ebitdaMargin.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          <strong>Totalt:</strong> {analytics.marginAnalysis.profit.total.toLocaleString('sv-SE')} företag. 
                          Extremvärden (&lt; -100% eller &gt; 100%) filtreras bort vid beräkning av genomsnittlig EBIT-marginal för att undvika snedvridning.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                  <h3 className="font-semibold text-primary mb-2">✅ Dashboard ansluten till livedata</h3>
                  <p className="text-foreground">
                    All statistik hämtas nu från den nya company_metrics-datamodellen i realtid.
                    Navigera till Företagssökning för att utforska data i detalj.
                  </p>
                </div>
              </>
            )}
          </div>
        )
      }
      
      case 'companies':
        return <EnhancedCompanySearch />
      
      case 'segmentation':
        return <SegmentationTiers />
      
      case 'analytics':
        return <ListBasedAnalytics />
      
      case 'ai-insights':
        return <AIAnalysis selectedDataView="company_metrics" />
      
      case 'analyzed-companies':
        return <AnalyzedCompanies />
      
      case 'valuation':
        return <Valuation />
      
      case 'export':
        return <DataExport />
      
      case 'admin':
        return <AdminPanel currentUser={user} />
      
      default:
        return <div>Page not found</div>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h1 className="ml-2 text-base font-semibold text-foreground">
                Nivo Dashboard
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-lg border-r border-border transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:inset-0
        `}>
          <div className="p-4">
            <nav className="space-y-2">
              {allMenuItems.map((item) => {
                const Icon = item.icon
                const isDisabled = item.disabled
                return (
                  <Button
                    key={item.id}
                    variant={currentPage === item.id ? 'secondary' : 'ghost'}
                    disabled={isDisabled}
                    className={`w-full justify-start ${
                      isDisabled
                        ? 'cursor-not-allowed opacity-50'
                        : currentPage === item.id
                          ? 'bg-muted'
                          : ''
                    }`}
                    onClick={() => {
                      if (!isDisabled) {
                        setCurrentPage(item.id)
                        setSidebarOpen(false)
                      }
                    }}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.label}
                    {isDisabled && <span className="ml-auto text-xs">(Under utveckling)</span>}
                  </Button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-card bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default WorkingDashboard
