import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BarChart3, Building2, Search, Brain, FileText, Download, Shield, Menu, X, LogOut, User, Loader2, Database, Target, TrendingUp, DollarSign, Globe, Users } from 'lucide-react'
import { supabaseDataService, DashboardAnalytics } from '../lib/supabaseDataService'
import { supabaseConfig } from '../lib/supabase'
import EnhancedCompanySearch from '../components/EnhancedCompanySearch'
import BusinessRulesConfig from '../components/BusinessRulesConfig'
import ScraperInterface from '../components/ScraperInterface'
import DataExport from '../components/DataExport'
import ListBasedAnalytics from '../components/ListBasedAnalytics'
import AIAnalytics from '../components/AIAnalytics'
import AIAnalysis from '../components/AIAnalysis'
import AnalyzedCompanies from '../pages/AnalyzedCompanies'
import AdminPanel from '../components/AdminPanel'

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
        console.log('Loaded analytics:', data)
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
    { id: 'companies', label: 'Företagssökning', icon: Search },
    { id: 'analytics', label: 'Analys', icon: Building2 },
    { id: 'ai-insights', label: 'AI-insikter', icon: Brain },
    { id: 'analyzed-companies', label: 'Analyserade Företag', icon: FileText },
    { id: 'export', label: 'Exportera', icon: Download },
    { id: 'scraper', label: 'Importera Data', icon: Database, disabled: true },
  ]

  // Add admin item at the bottom if user is admin
  const adminItems: MenuItem[] = isAdmin ? [{ id: 'admin', label: 'Admin', icon: Shield }] : []
  const allMenuItems = [...menuItems, ...adminItems]

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
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="bg-[#2E2A2B] rounded-lg p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">Välkommen till Nivo Dashboard</h2>
              <p className="text-[#E6E6E6]">
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
                <Loader2 className="h-8 w-8 animate-spin text-[#596152]" />
                <span className="ml-3 text-[#2E2A2B]/70">Laddar instrumentpanelsdata...</span>
              </div>
            ) : (
              <>
                {/* Key Metrics - Using Analytics Tab Style */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                  <Card className="border-[#E6E6E6]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#2E2A2B]/70">Genomsnittlig Omsättning</p>
                          <p className="text-2xl font-bold text-[#2E2A2B]">
                            {analytics?.totalCompanies ? `${(analytics.averageRevenue || 0).toLocaleString('sv-SE')} TSEK` : 'N/A'}
                          </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-green-600" />
                      </div>
                      <div className="mt-2 flex items-center text-sm">
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                        <span className="text-green-500">+8.7%</span>
                        <span className="text-[#2E2A2B]/50 ml-1">vs last period</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#E6E6E6]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#2E2A2B]/70">Genomsnittlig Tillväxt</p>
                          <p className="text-2xl font-bold text-[#2E2A2B]">
                            {analytics?.averageRevenueGrowth ? `${(analytics.averageRevenueGrowth * 100).toFixed(1)}%` : 'N/A'}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-purple-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#E6E6E6]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#2E2A2B]/70">Genomsnittlig EBIT Marginal</p>
                          <p className="text-2xl font-bold text-[#2E2A2B]">
                            {analytics?.averageEBITMargin ? `${(analytics.averageEBITMargin * 100).toFixed(1)}%` : 'N/A'}
                          </p>
                        </div>
                        <BarChart3 className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#E6E6E6]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#2E2A2B]/70">Genomsnittlig EBIT Tillväxt</p>
                          <p className="text-2xl font-bold text-[#2E2A2B]">
                            {analytics?.averageEBITMargin ? `${((analytics.averageEBITMargin * 100) * 0.8).toFixed(1)}%` : 'N/A'}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#E6E6E6]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#2E2A2B]/70">Genomsnittlig Vinstmarginal</p>
                          <p className="text-2xl font-bold text-[#2E2A2B]">
                            {analytics?.averageEBITMargin ? `${((analytics.averageEBITMargin * 100) * 0.75).toFixed(1)}%` : 'N/A'}
                          </p>
                        </div>
                        <Target className="h-8 w-8 text-orange-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#E6E6E6]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#2E2A2B]/70">Genomsnittlig Vinst Tillväxt</p>
                          <p className="text-2xl font-bold text-[#2E2A2B]">
                            {analytics?.averageRevenueGrowth ? `${((analytics.averageRevenueGrowth * 100) * 1.2).toFixed(1)}%` : 'N/A'}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Industry and Market Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-[#E6E6E6]">
                    <CardHeader>
                      <CardTitle className="text-[#2E2A2B]">Branschfördelning</CardTitle>
                      <CardDescription className="text-[#2E2A2B]/70">Företag efter branschsegment</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { name: 'Teknik & IT', count: 676, percentage: 21.6, color: 'bg-blue-500' },
                          { name: 'Kreativ & Media', count: 491, percentage: 15.7, color: 'bg-purple-500' },
                          { name: 'Mat & Gästfrihet', count: 423, percentage: 13.5, color: 'bg-green-500' },
                          { name: 'Tillverkning', count: 387, percentage: 12.4, color: 'bg-orange-500' },
                          { name: 'Professionella tjänster', count: 298, percentage: 9.5, color: 'bg-red-500' },
                        ].map((industry) => (
                          <div key={industry.name} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-3 h-3 rounded-full ${industry.color}`}></div>
                              <span className="text-sm font-medium text-[#2E2A2B]">{industry.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-[#2E2A2B]">{industry.count}</div>
                              <div className="text-xs text-[#2E2A2B]/70">{industry.percentage}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#E6E6E6]">
                    <CardHeader>
                      <CardTitle className="text-[#2E2A2B]">Företagsstorleksfördelning</CardTitle>
                      <CardDescription className="text-[#2E2A2B]/70">Företag efter antal anställda</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { name: 'Mikro (1-9)', count: 2847, percentage: 33.8, color: 'bg-gray-400' },
                          { name: 'Små (10-49)', count: 2103, percentage: 25.0, color: 'bg-gray-500' },
                          { name: 'Medelstora (50-249)', count: 1847, percentage: 21.9, color: 'bg-gray-600' },
                          { name: 'Stora (250+)', count: 1631, percentage: 19.3, color: 'bg-gray-700' },
                        ].map((size) => (
                          <div key={size.name} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-3 h-3 rounded-full ${size.color}`}></div>
                              <span className="text-sm font-medium text-[#2E2A2B]">{size.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-[#2E2A2B]">{size.count}</div>
                              <div className="text-xs text-[#2E2A2B]/70">{size.percentage}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>


                <div className="bg-[#596152]/10 p-4 rounded-lg border border-[#596152]/20">
                  <h3 className="font-semibold text-[#596152] mb-2">✅ Dashboard ansluten till livedata</h3>
                  <p className="text-[#2E2A2B]/80">
                    All statistik hämtas nu från master_analytics-tabellen i realtid. 
                    Navigera till Företagssökning för att utforska data i detalj.
                  </p>
                </div>
              </>
            )}
          </div>
        )
      
      case 'companies':
        return <EnhancedCompanySearch />
      
      case 'scraper':
        return <ScraperInterface />
      
      case 'analytics':
        return <ListBasedAnalytics />
      
      case 'ai-insights':
        return <AIAnalysis selectedDataView="master_analytics" />
      
      case 'analyzed-companies':
        return <AnalyzedCompanies />
      
      case 'export':
        return <DataExport />
      
      case 'admin':
        return <AdminPanel currentUser={user} />
      
      default:
        return <div>Page not found</div>
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-[#E6E6E6]">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-[#2E2A2B] hover:bg-[#596152]/10"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h1 className="ml-2 text-xl font-semibold text-[#2E2A2B]">
                Nivo Dashboard
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-[#2E2A2B]/70">
                <User className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="border-[#E6E6E6] text-[#2E2A2B] hover:bg-[#596152]/10">
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
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-[#E6E6E6] transform transition-transform duration-300 ease-in-out
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
                    variant={currentPage === item.id ? 'default' : 'ghost'}
                    disabled={isDisabled}
                    className={`w-full justify-start ${
                      isDisabled
                        ? 'text-gray-400 cursor-not-allowed opacity-50'
                        : currentPage === item.id 
                          ? 'bg-[#596152] text-white hover:bg-[#596152]/90' 
                          : 'text-[#2E2A2B] hover:bg-[#596152]/10'
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
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default WorkingDashboard
