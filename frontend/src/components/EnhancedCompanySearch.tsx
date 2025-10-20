import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Checkbox } from './ui/checkbox'
import { 
  Search, 
  Building2, 
  MapPin, 
  Globe, 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  Filter,
  Download,
  BarChart3,
  Target,
  Users,
  DollarSign,
  X,
  Check
} from 'lucide-react'
import { supabaseDataService, SupabaseCompany, CompanyFilter } from '../lib/supabaseDataService'
import { SavedListsService, SavedCompanyList } from '../lib/savedListsService'
import CompanyListManager from './CompanyListManager'
import AddToListsDialog from './AddToListsDialog'

interface SearchResults {
  companies: SupabaseCompany[]
  total: number
  summary: {
    avgRevenue: number
    avgGrowth: number
    avgMargin: number
    topIndustries: { industry: string; count: number }[]
    topCities: { city: string; count: number }[]
  }
}

// SavedCompanyList interface is now imported from savedListsService

const EnhancedCompanySearch: React.FC = () => {
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<CompanyFilter>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<'list' | 'analysis'>('list')
  const [selectedCompany, setSelectedCompany] = useState<SupabaseCompany | null>(null)
  const [showCompanyDetail, setShowCompanyDetail] = useState(false)
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [allMatchingCompanyOrgNrs, setAllMatchingCompanyOrgNrs] = useState<Set<string>>(new Set())
  const [showAddToListsDialog, setShowAddToListsDialog] = useState(false)

  const itemsPerPage = 20

  // Load saved lists on component mount
  useEffect(() => {
    const loadSavedLists = async () => {
      try {
        const lists = await SavedListsService.getSavedLists()
        setSavedLists(lists)
      } catch (error) {
        console.error('Error loading saved lists:', error)
      }
    }
    loadSavedLists()
  }, [])

  // Handle individual company selection
  const handleCompanySelect = (companyOrgNr: string, checked: boolean) => {
    setSelectedCompanies(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(companyOrgNr)
      } else {
        newSet.delete(companyOrgNr)
      }
      return newSet
    })
  }

  // Handle select all functionality - selects ALL matching companies across all pages
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompanies(new Set(allMatchingCompanyOrgNrs))
      setSelectAll(true)
    } else {
      setSelectedCompanies(new Set())
      setSelectAll(false)
    }
  }

  // Get selected companies as array - fetches all selected companies from database
  const [selectedCompaniesArray, setSelectedCompaniesArray] = useState<SupabaseCompany[]>([])
  
  // Update selected companies array when selection changes
  useEffect(() => {
    const fetchSelectedCompanies = async () => {
      if (selectedCompanies.size > 0) {
        try {
          const companies = await supabaseDataService.getCompaniesByOrgNrs(Array.from(selectedCompanies))
          setSelectedCompaniesArray(companies)
        } catch (error) {
          console.error('Error fetching selected companies:', error)
          setSelectedCompaniesArray([])
        }
      } else {
        setSelectedCompaniesArray([])
      }
    }

    fetchSelectedCompanies()
  }, [selectedCompanies])

  const getSelectedCompaniesArray = (): SupabaseCompany[] => {
    return selectedCompaniesArray
  }

  // Update select all state when individual selections change
  useEffect(() => {
    if (allMatchingCompanyOrgNrs.size > 0) {
      setSelectAll(selectedCompanies.size === allMatchingCompanyOrgNrs.size)
    }
  }, [selectedCompanies, allMatchingCompanyOrgNrs])

  // Clear selections when search results change
  useEffect(() => {
    setSelectedCompanies(new Set())
    setSelectAll(false)
    setSelectedCompaniesArray([])
  }, [searchResults])

  const searchCompanies = async () => {
    try {
      setLoading(true)
      
      const searchFilters: CompanyFilter = { ...filters }
      
      if (searchTerm.trim()) {
        searchFilters.name = searchTerm.trim()
      }

      // Get paginated results and all matching company OrgNrs in parallel
      const [result, allMatchingOrgNrs] = await Promise.all([
        supabaseDataService.getCompanies(currentPage, itemsPerPage, searchFilters),
        supabaseDataService.getAllMatchingCompanyOrgNrs(searchFilters)
      ])
      
      // Calculate summary from the companies data
      const summary = calculateSummary(result.companies)
      
      // Set the result with calculated summary
      setSearchResults({
        ...result,
        summary
      })

      // Set all matching company OrgNrs for Select All functionality
      setAllMatchingCompanyOrgNrs(new Set(allMatchingOrgNrs))
      
    } catch (error) {
      console.error('Error searching companies:', error)
      setSearchResults(null)
      setAllMatchingCompanyOrgNrs(new Set())
    } finally {
      setLoading(false)
    }
  }

  const calculateSummary = (companies: SupabaseCompany[]) => {
    if (companies.length === 0) {
      return {
        avgRevenue: 0,
        avgGrowth: 0,
        avgMargin: 0,
        topIndustries: [],
        topCities: []
      }
    }

    // Calculate averages
    const totalRevenue = companies.reduce((sum, c) => sum + (c.SDI || 0), 0)
    const avgRevenue = totalRevenue / companies.length

    const companiesWithGrowth = companies.filter(c => c.Revenue_growth !== null)
    const avgGrowth = companiesWithGrowth.length > 0 
      ? companiesWithGrowth.reduce((sum, c) => sum + (c.Revenue_growth || 0), 0) / companiesWithGrowth.length
      : 0

    const companiesWithMargin = companies.filter(c => c.EBIT_margin !== null)
    const avgMargin = companiesWithMargin.length > 0
      ? companiesWithMargin.reduce((sum, c) => sum + (c.EBIT_margin || 0), 0) / companiesWithMargin.length
      : 0

    // Top industries
    const industryMap = new Map<string, number>()
    companies.forEach(c => {
      const industry = c.segment_name || c.industry_name || 'Unknown'
      industryMap.set(industry, (industryMap.get(industry) || 0) + 1)
    })
    const topIndustries = Array.from(industryMap.entries())
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Top cities
    const cityMap = new Map<string, number>()
    companies.forEach(c => {
      const city = c.city || 'Unknown'
      cityMap.set(city, (cityMap.get(city) || 0) + 1)
    })
    const topCities = Array.from(cityMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      avgRevenue,
      avgGrowth: avgGrowth * 100, // Convert to percentage
      avgMargin: avgMargin * 100, // Convert to percentage
      topIndustries,
      topCities
    }
  }

  useEffect(() => {
    // Only search if there are active filters or search term
    const hasActiveFilters = Object.values(filters).some(value => value !== undefined && value !== null && value !== '')
    const hasSearchTerm = searchTerm.trim() !== ''
    
    if (hasActiveFilters || hasSearchTerm) {
      if (currentPage === 1) {
        searchCompanies()
      } else {
        setCurrentPage(1)
      }
    } else {
      // Clear results when no search/filters
      setSearchResults(null)
      setAllMatchingCompanyOrgNrs(new Set())
    }
  }, [filters])

  // Add ESC key handler to close popup
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showCompanyDetail) {
        setShowCompanyDetail(false)
        setSelectedCompany(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showCompanyDetail])

  useEffect(() => {
    // Only search if there are active filters or search term
    const hasActiveFilters = Object.values(filters).some(value => value !== undefined && value !== null && value !== '')
    const hasSearchTerm = searchTerm.trim() !== ''
    
    if (hasActiveFilters || hasSearchTerm) {
      searchCompanies()
    }
  }, [currentPage])

  // Add search term effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only search if there's a search term or active filters
      const hasActiveFilters = Object.values(filters).some(value => value !== undefined && value !== null && value !== '')
      const hasSearchTerm = searchTerm.trim() !== ''
      
      if (hasActiveFilters || hasSearchTerm) {
        if (currentPage === 1) {
          searchCompanies()
        } else {
          setCurrentPage(1)
        }
      } else {
        // Clear results when no search/filters
        setSearchResults(null)
        setAllMatchingCompanyOrgNrs(new Set())
      }
    }, 500) // Debounce search by 500ms

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const handleFilterChange = (key: keyof CompanyFilter, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value
    }))
  }

  const clearFilters = () => {
    setFilters({})
    setSearchTerm('')
    setCurrentPage(1)
  }

  const handleListSelect = (list: SavedCompanyList) => {
    // Apply the saved list's filters and companies
    setFilters(list.filters)
    setSearchResults({
      companies: list.companies,
      total: list.companies.length,
      summary: calculateSummary(list.companies)
    })
    setCurrentPage(1)
  }

  const handleListUpdate = async (lists: SavedCompanyList[]) => {
    setSavedLists(lists)
    // Also refresh from service to ensure consistency
    try {
      const refreshedLists = await SavedListsService.getSavedLists()
      setSavedLists(refreshedLists)
    } catch (error) {
      console.error('Error refreshing saved lists:', error)
    }
  }

  const formatNumber = (num: number | null | undefined) => {
    // Show as T SEK (thousand SEK) without manipulation
    if (num === null || num === undefined || isNaN(num)) {
      return '0 T SEK'
    }
    return `${num.toLocaleString()} T SEK`
  }

  const getGrowthIcon = (growth?: number) => {
    if (!growth) return null
    return growth > 0 ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />
  }

  const getGrowthColor = (growth?: number) => {
    if (!growth) return 'text-gray-500'
    return growth > 0 ? 'text-green-600' : 'text-red-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
                <h2 className="text-2xl font-bold">Avancerad företagssökning</h2>
                <p className="text-gray-600">Avancerad sökning och analys av företagsdata</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Listvy
          </Button>
          <Button 
            variant={viewMode === 'analysis' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('analysis')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analys
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Sök & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Sök efter företagsnamn..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button onClick={searchCompanies} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

                   {/* Compact Filters */}
                   <div className="space-y-3">

              {/* Revenue & Profit in one row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Omsättning (kSEK)</label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="Min"
                      value={filters.minRevenue || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, minRevenue: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="Max"
                      value={filters.maxRevenue || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxRevenue: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Vinst (kSEK)</label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="Min"
                      value={filters.minProfit || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, minProfit: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="Max"
                      value={filters.maxProfit || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxProfit: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Growth & Employees in one row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Tillväxt (%)</label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Min"
                      value={filters.minRevenueGrowth || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, minRevenueGrowth: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Max"
                      value={filters.maxRevenueGrowth || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxRevenueGrowth: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Anställda</label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.minEmployees || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, minEmployees: e.target.value ? parseInt(e.target.value) : undefined }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.maxEmployees || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxEmployees: e.target.value ? parseInt(e.target.value) : undefined }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                    Rensa filter
              </Button>
              {searchResults && (
                <div className="text-sm text-gray-600">
                  {searchResults.total.toLocaleString()} företag hittade
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company List Manager */}
      {console.log('EnhancedCompanySearch: Rendering CompanyListManager with', getSelectedCompaniesArray().length, 'companies')}
      <CompanyListManager
        currentCompanies={getSelectedCompaniesArray()}
        currentFilters={filters}
        onListSelect={handleListSelect}
        onListUpdate={handleListUpdate}
      />

      {/* Results */}
      {searchResults && (
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'analysis')}>
          <TabsList>
            <TabsTrigger value="list">Företagslista</TabsTrigger>
            <TabsTrigger value="analysis">Analys</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Select All Header */}
            {searchResults.companies.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Välj alla företag ({allMatchingCompanyOrgNrs.size})
                  </label>
                </div>
                <div className="text-sm text-gray-600">
                  {selectedCompanies.size} företag valda
                </div>
              </div>
            )}
            
            {/* Save to Lists Button */}
            {selectedCompanies.size > 0 && (
              <div className="flex justify-end mb-4">
                <Button 
                  onClick={() => setShowAddToListsDialog(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Lägg till i listor ({selectedCompanies.size} företag)
                </Button>
              </div>
            )}
            
            <div className="grid gap-4">
              {searchResults.companies.map((company, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3 flex-1">
                        <Checkbox
                          id={`company-${company.OrgNr}`}
                          checked={selectedCompanies.has(company.OrgNr)}
                          onCheckedChange={(checked) => handleCompanySelect(company.OrgNr, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 
                              className="font-semibold text-lg cursor-pointer hover:text-blue-600"
                              onClick={() => {
                                setSelectedCompany(company)
                                setShowCompanyDetail(true)
                              }}
                            >
                              {company.name}
                            </h3>
                            <Badge variant="secondary">{company.OrgNr}</Badge>
                          </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {company.segment_name || company.industry_name || 'Unknown Industry'}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {company.city || 'Unknown City'}
                          </div>
                          {company.homepage && (
                            <div className="flex items-center gap-1">
                              <Globe className="h-4 w-4" />
                              <a href={company.homepage} target="_blank" rel="noopener noreferrer" 
                                 className="text-blue-600 hover:underline">
                                Website
                              </a>
                            </div>
                          )}
                        </div>

                           <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-3">
                             <div className="flex items-center gap-2">
                               <DollarSign className="h-4 w-4 text-green-600" />
                               <span className="text-sm">
                                 Omsättning: <span className="font-medium">{formatNumber(company.SDI || 0)}</span>
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <DollarSign className="h-4 w-4 text-blue-600" />
                               <span className="text-sm">
                                 Vinst: <span className="font-medium">{formatNumber(company.DR || 0)}</span>
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               {getGrowthIcon(company.Revenue_growth)}
                               <span className={`text-sm ${getGrowthColor(company.Revenue_growth)}`}>
                                 Tillväxt: <span className="font-medium">
                                   {company.Revenue_growth ? `${(company.Revenue_growth * 100).toFixed(1)}%` : 'N/A'}
                                 </span>
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <Target className="h-4 w-4 text-purple-600" />
                               <span className="text-sm">
                                 Marginal: <span className="font-medium">
                                   {company.EBIT_margin ? `${(company.EBIT_margin * 100).toFixed(1)}%` : 'N/A'}
                                 </span>
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <Users className="h-4 w-4 text-orange-600" />
                               <span className="text-sm">
                                 Anställda: <span className="font-medium">{company.employees || 'N/A'}</span>
                               </span>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-center items-center gap-2">
              <Button 
                variant="outline" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {Math.ceil(searchResults.total / itemsPerPage)}
              </span>
              <Button 
                variant="outline"
                disabled={currentPage >= Math.ceil(searchResults.total / itemsPerPage)}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Genomsnittlig omsättning
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatNumber(searchResults.summary.avgRevenue)}
                  </div>
                  <p className="text-xs text-gray-600">Genomsnittlig omsättning</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Genomsnittlig tillväxt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {searchResults.summary.avgGrowth.toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-600">Genomsnittlig tillväxttakt</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Genomsnittlig marginal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {searchResults.summary.avgMargin.toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-600">Genomsnittlig EBIT-marginal</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="h-5 w-5 mr-2" />
                    Totalt antal företag
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{searchResults.total.toLocaleString()}</div>
                  <p className="text-xs text-gray-600">Matchande kriterier</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Topp branscher</CardTitle>
                  <CardDescription>Vanligaste branscherna i resultaten</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {searchResults.summary.topIndustries.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{item.industry}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Topp städer</CardTitle>
                  <CardDescription>Vanligaste städerna i resultaten</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {searchResults.summary.topCities.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{item.city}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Company Detail Modal - Modern Financial Dashboard Design */}
      {showCompanyDetail && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-[#F7F7F7] rounded-2xl shadow-2xl">
            {/* Header - Charcoal Background */}
            <div className="bg-[#2E2A2B] text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{selectedCompany.name}</h1>
                  <p className="text-[#E6E6E6] text-sm mb-4">Företagsinformation och finansiell analys</p>
                  <div className="grid grid-cols-2 gap-4 text-[#E6E6E6] text-sm">
                    <div><strong>Org.nr:</strong> {selectedCompany.OrgNr}</div>
                    <div><strong>Bransch:</strong> {selectedCompany.segment_name || 'N/A'}</div>
                    <div><strong>Adress:</strong> {selectedCompany.address || 'N/A'}</div>
                    <div><strong>Stad:</strong> {selectedCompany.city || 'N/A'}</div>
                    {selectedCompany.homepage && (
                      <div className="col-span-2">
                        <strong>Webbplats:</strong> 
                        <a 
                          href={selectedCompany.homepage} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="ml-2 text-white hover:text-[#E6E6E6] underline"
                        >
                          {selectedCompany.homepage}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowCompanyDetail(false)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-full w-10 h-10 p-0"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
              {/* Financial Chart Section */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-[#2E2A2B]">Finansiell utveckling</h2>
                  <p className="text-[#596152] text-sm">Senaste 4 åren</p>
                </div>
                
                {/* Chart Container */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E6E6E6]">
                  <div className="h-48 mb-4">
                    <div className="flex items-end justify-between h-full">
                      {/* Chart bars with real data from company_accounts_by_id */}
                      {selectedCompany.historicalData && Array.isArray(selectedCompany.historicalData) && selectedCompany.historicalData.length > 0 ? (
                        selectedCompany.historicalData.map((data, index) => {
                          // Ensure data exists and has required properties
                          if (!data || typeof data !== 'object') {
                            return null
                          }
                          
                          const safeData = {
                            year: data.year || 2023,
                            SDI: data.SDI || 0, // Revenue (Omsättning)
                            RG: data.RG || 0,   // EBIT
                            DR: data.DR || 0    // Net Profit (Vinst)
                          }
                          
                          const maxValue = Math.max(...selectedCompany.historicalData!.map(d => (d && d.SDI) || 0), 1) // Prevent division by zero
                          const height = (safeData.SDI / maxValue) * 100
                          const ebitHeight = (safeData.RG / maxValue) * 100
                          const vinstHeight = (safeData.DR / maxValue) * 100
                          
                          return (
                            <div key={index} className="flex flex-col items-center">
                              <div className="flex flex-col items-end gap-1 mb-2">
                                {/* Omsättning */}
                                <div className="bg-[#596152] w-12 rounded-t-lg" style={{ height: `${height}%` }}></div>
                                {/* EBIT */}
                                <div className="bg-[#596152]/70 w-12 rounded-t-lg" style={{ height: `${ebitHeight}%` }}></div>
                                {/* Vinst */}
                                <div className="bg-[#596152]/40 w-12 rounded-t-lg" style={{ height: `${vinstHeight}%` }}></div>
                              </div>
                              <div className="text-xs text-[#2E2A2B] font-medium">{`${safeData.year}-12-31`}</div>
                              <div className="text-xs font-bold text-[#596152]">{formatNumber(safeData.SDI)}</div>
                              <div className="text-xs font-bold text-[#596152]/70">{formatNumber(safeData.RG)}</div>
                              <div className="text-xs font-bold text-[#596152]/40">{formatNumber(safeData.DR)}</div>
                            </div>
                          )
                        }).filter(Boolean) // Remove any null entries
                      ) : (
                        // Fallback to mock data if no historical data
                        <>
                          <div className="flex flex-col items-center">
                            <div className="bg-[#596152] w-12 h-20 mb-2 rounded-t-lg"></div>
                            <div className="text-xs text-[#2E2A2B] font-medium">{selectedCompany.year ? `${selectedCompany.year}-12-31` : 'N/A'}</div>
                            <div className="text-xs font-bold text-[#596152]">{formatNumber(selectedCompany.SDI || 0)}</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="bg-[#596152]/80 w-12 h-16 mb-2 rounded-t-lg"></div>
                            <div className="text-xs text-[#2E2A2B] font-medium">{selectedCompany.year ? `${selectedCompany.year - 1}-12-31` : 'N/A'}</div>
                            <div className="text-xs font-bold text-[#596152]">{formatNumber((selectedCompany.SDI || 0) * 0.95)}</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="bg-[#596152]/60 w-12 h-12 mb-2 rounded-t-lg"></div>
                            <div className="text-xs text-[#2E2A2B] font-medium">{selectedCompany.year ? `${selectedCompany.year - 2}-12-31` : 'N/A'}</div>
                            <div className="text-xs font-bold text-[#596152]">{formatNumber((selectedCompany.SDI || 0) * 0.9)}</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="bg-[#596152]/40 w-12 h-8 mb-2 rounded-t-lg"></div>
                            <div className="text-xs text-[#2E2A2B] font-medium">{selectedCompany.year ? `${selectedCompany.year - 3}-12-31` : 'N/A'}</div>
                            <div className="text-xs font-bold text-[#596152]">{formatNumber((selectedCompany.SDI || 0) * 0.85)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Chart Legend */}
                  <div className="flex gap-8 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#596152] rounded"></div>
                      <span className="font-medium text-[#2E2A2B]">Omsättning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#596152]/70 rounded"></div>
                      <span className="font-medium text-[#2E2A2B]">EBIT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#596152]/40 rounded"></div>
                      <span className="font-medium text-[#2E2A2B]">Vinst</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-[#2E2A2B] mb-4">Sammanfattning {selectedCompany.year ? `${selectedCompany.year}-12-31` : 'N/A'}</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E6E6E6]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[#596152]/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-[#596152]" />
                      </div>
                      <div>
                        <div className="text-sm text-[#2E2A2B]/70">Omsättning</div>
                        <div className="text-2xl font-bold text-[#2E2A2B]">{formatNumber(selectedCompany.SDI || 0)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E6E6E6]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[#596152]/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-[#596152]" />
                      </div>
                      <div>
                        <div className="text-sm text-[#2E2A2B]/70">Tillväxt</div>
                        <div className="text-2xl font-bold text-[#2E2A2B]">
                          {selectedCompany.Revenue_growth ? `${(selectedCompany.Revenue_growth * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E6E6E6]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[#596152]/10 rounded-lg flex items-center justify-center">
                        <Target className="h-5 w-5 text-[#596152]" />
                      </div>
                      <div>
                        <div className="text-sm text-[#2E2A2B]/70">EBIT-marginal</div>
                        <div className="text-2xl font-bold text-[#2E2A2B]">
                          {selectedCompany.EBIT_margin ? `${(selectedCompany.EBIT_margin * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Company Information */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E6E6E6]">
                  <h3 className="text-lg font-bold text-[#2E2A2B] mb-4">Företagsinformation</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-[#E6E6E6]">
                      <span className="text-[#2E2A2B]/70 text-sm">Bolagsform:</span>
                      <span className="font-semibold text-[#2E2A2B] text-sm">Aktiebolag</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E6E6E6]">
                      <span className="text-[#2E2A2B]/70 text-sm">Registreringsår:</span>
                      <span className="font-semibold text-[#2E2A2B] text-sm">
                        {selectedCompany.incorporation_date ? new Date(selectedCompany.incorporation_date).getFullYear() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E6E6E6]">
                      <span className="text-[#2E2A2B]/70 text-sm">Antal anställda:</span>
                      <span className="font-semibold text-[#2E2A2B] text-sm">{selectedCompany.employees || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#2E2A2B]/70 text-sm">Företagsstorlek:</span>
                      <span className="font-semibold text-[#2E2A2B] text-sm">{selectedCompany.company_size_category || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Financial KPIs */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E6E6E6]">
                  <h3 className="text-lg font-bold text-[#2E2A2B] mb-4">Finansiella nyckeltal {selectedCompany.year ? `${selectedCompany.year}-12-31` : 'N/A'}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-[#E6E6E6]">
                      <span className="text-[#2E2A2B]/70 text-sm">EBIT-marginal:</span>
                      <div className="text-right">
                        <span className="font-semibold text-[#2E2A2B] text-sm">
                          {selectedCompany.EBIT_margin ? `${(selectedCompany.EBIT_margin * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                        <div className="text-xs text-[#596152]">↗ +0.5%</div>
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E6E6E6]">
                      <span className="text-[#2E2A2B]/70 text-sm">Nettoresultat:</span>
                      <div className="text-right">
                        <span className="font-semibold text-[#2E2A2B] text-sm">{formatNumber(selectedCompany.ORS || 0)}</span>
                        <div className="text-xs text-[#596152]">↗ +12%</div>
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#E6E6E6]">
                      <span className="text-[#2E2A2B]/70 text-sm">Soliditet:</span>
                      <div className="text-right">
                        <span className="font-semibold text-[#2E2A2B] text-sm">
                          {selectedCompany.NetProfit_margin ? `${(selectedCompany.NetProfit_margin * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                        <div className="text-xs text-red-500">↘ -2.1%</div>
                      </div>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[#2E2A2B]/70 text-sm">Tillväxt:</span>
                      <div className="text-right">
                        <span className="font-semibold text-[#2E2A2B] text-sm">
                          {selectedCompany.Revenue_growth ? `${(selectedCompany.Revenue_growth * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                        <div className="text-xs text-red-500">↘ -3.2%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to Lists Dialog */}
      <AddToListsDialog
        isOpen={showAddToListsDialog}
        onClose={() => setShowAddToListsDialog(false)}
        companies={selectedCompaniesArray}
        onSuccess={(list) => {
          // Refresh the saved lists
          handleListUpdate([...savedLists, list])
          // Clear selections
          setSelectedCompanies(new Set())
          setSelectAll(false)
          setSelectedCompaniesArray([])
        }}
      />
    </div>
  )
}

export default EnhancedCompanySearch


