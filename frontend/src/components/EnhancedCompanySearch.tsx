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
import { supabaseCompanyService, SupabaseCompany, CompanyFilter } from '../lib/supabaseCompanyService'
import { SavedListsService, SavedCompanyList } from '../lib/savedListsService'
import CompanyListManager from './CompanyListManager'
import AddToListsDialog from './AddToListsDialog'
import { AIDeepDivePanel } from './AIDeepDivePanel'

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
          const companies = await supabaseCompanyService.getCompaniesByOrgNrs(Array.from(selectedCompanies))
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
      
      // Convert MSEK to thousands (database format)
      if (searchFilters.minRevenue !== undefined) {
        searchFilters.minRevenue = searchFilters.minRevenue * 1000
      }
      if (searchFilters.maxRevenue !== undefined) {
        searchFilters.maxRevenue = searchFilters.maxRevenue * 1000
      }
      if (searchFilters.minProfit !== undefined) {
        searchFilters.minProfit = searchFilters.minProfit * 1000
      }
      if (searchFilters.maxProfit !== undefined) {
        searchFilters.maxProfit = searchFilters.maxProfit * 1000
      }
      
      if (searchTerm.trim()) {
        searchFilters.name = searchTerm.trim()
      }

      // Get paginated results and all matching company OrgNrs in parallel
      const [result, allMatchingOrgNrs] = await Promise.all([
        supabaseCompanyService.getCompanies(currentPage, itemsPerPage, searchFilters),
        supabaseCompanyService.getAllMatchingCompanyOrgNrs(searchFilters)
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
    const appliedFilters = list.filters || {}

    setFilters(appliedFilters)
    setSearchTerm(appliedFilters.name || '')

    const companyOrgNrs = list.companies.map(company => company.OrgNr)
    const orgNrSet = new Set(companyOrgNrs)

    setAllMatchingCompanyOrgNrs(orgNrSet)
    setSelectedCompanies(orgNrSet)
    setSelectedCompaniesArray(list.companies)
    setSelectAll(list.companies.length > 0)

    setSearchResults({
      companies: list.companies,
      total: list.companies.length,
      summary: calculateSummary(list.companies)
    })

    setCurrentPage(1)
    setViewMode('list')
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

  // Database now stores values in actual SEK (multiplied by 1000 from Allabolag)
  // Raw: 100,000 tSEK → DB: 100,000,000 SEK → Display: 100 mSEK
  const formatCurrency = (value: number | null | undefined, decimals = 1) => {
    if (value === null || value === undefined) return 'N/A'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (typeof numValue !== 'number' || !Number.isFinite(numValue)) return 'N/A'
    
    // Convert from SEK to mSEK for display
    const valueInMSEK = numValue / 1_000_000
    return `${valueInMSEK.toFixed(decimals)} mSEK`
  }

  // Database now stores all values in actual SEK (multiplied by 1000 from Allabolag)
  const formatEBIT = (value: number | null | undefined, decimals = 1) => {
    if (value === null || value === undefined) return 'N/A'
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (typeof numValue !== 'number' || !Number.isFinite(numValue)) return 'N/A'
    
    // All values are now in actual SEK, convert to mSEK for display
    const valueInMSEK = numValue / 1_000_000
    return `${valueInMSEK.toFixed(decimals)} mSEK`
  }

  const getGrowthIcon = (growth?: number) => {
    if (!growth) return null
    return growth > 0 ? 
      <TrendingUp className="h-4 w-4 text-primary" /> : 
      <TrendingDown className="h-4 w-4 text-destructive" />
  }

  const getGrowthColor = (growth?: number) => {
    if (!growth) return 'text-muted-foreground'
    return growth > 0 ? 'text-primary' : 'text-destructive'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
                <h2 className="text-2xl font-bold">Avancerad företagssökning</h2>
                <p className="text-muted-foreground">Avancerad sökning och analys av företagsdata</p>
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
                  <label className="text-sm font-medium mb-1 block">Omsättning (MSEK)</label>
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
                  <label className="text-sm font-medium mb-1 block">Vinst (MSEK)</label>
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
                <div className="text-sm text-muted-foreground">
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
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border">
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
                <div className="text-sm text-muted-foreground">
                  {selectedCompanies.size} företag valda
                </div>
              </div>
            )}
            
            {/* Save to Lists Button */}
            {selectedCompanies.size > 0 && (
              <div className="flex justify-end mb-4">
                <Button 
                  onClick={() => setShowAddToListsDialog(true)}
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
                              className="font-semibold text-lg cursor-pointer hover:text-primary"
                              onClick={async () => {
                                // Fetch full company data with historicalData
                                try {
                                  const fullCompany = await supabaseCompanyService.getCompany(company.OrgNr)
                                  if (fullCompany) {
                                    setSelectedCompany(fullCompany)
                                    setShowCompanyDetail(true)
                                  } else {
                                    // Fallback to company from list if fetch fails
                                    setSelectedCompany(company)
                                    setShowCompanyDetail(true)
                                  }
                                } catch (error) {
                                  console.error('Error fetching company details:', error)
                                  // Fallback to company from list
                                  setSelectedCompany(company)
                                  setShowCompanyDetail(true)
                                }
                              }}
                            >
                              {company.name}
                            </h3>
                            <Badge variant="secondary">{company.OrgNr}</Badge>
                          </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Building2 className="h-4 w-4" />
                            {(() => {
                              // Parse segment_name if it's a JSON string array
                              let industries: string[] = []
                              if (company.segment_name) {
                                try {
                                  const parsed = typeof company.segment_name === 'string' 
                                    ? JSON.parse(company.segment_name) 
                                    : company.segment_name
                                  industries = Array.isArray(parsed) ? parsed : [parsed]
                                } catch {
                                  industries = [company.segment_name]
                                }
                              } else if (company.industry_name) {
                                industries = [company.industry_name]
                              }
                              
                              if (industries.length === 0) {
                                return <span className="text-muted-foreground">Okänd bransch</span>
                              }
                              
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {industries.map((industry, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {industry}
                                    </Badge>
                                  ))}
                                </div>
                              )
                            })()}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {company.city || 'Okänd stad'}
                          </div>
                          {company.homepage && (
                            <div className="flex items-center gap-1">
                              <Globe className="h-4 w-4" />
                              <a href={company.homepage} target="_blank" rel="noopener noreferrer" 
                                 className="text-primary hover:underline">
                                Website
                              </a>
                            </div>
                          )}
                        </div>

                           <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-3">
                             <div className="flex items-center gap-2">
                               <DollarSign className="h-4 w-4 text-primary" />
                               <span className="text-sm">
                                 Omsättning:{' '}
                                 <span className="font-medium">{formatCurrency(company.SDI)}</span>
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <DollarSign className="h-4 w-4 text-primary" />
                               <span className="text-sm">
                                 Vinst:{' '}
                                 <span className="font-medium">{formatCurrency(company.DR)}</span>
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               {getGrowthIcon(company.Revenue_growth)}
                               <span className={`text-sm ${getGrowthColor(company.Revenue_growth)}`}>
                                 Tillväxt: <span className="font-medium">
                                   {company.Revenue_growth != null ? `${company.Revenue_growth.toFixed(1)}%` : 'N/A'}
                                 </span>
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <Target className="h-4 w-4 text-primary" />
                               <span className="text-sm">
                                 Marginal: <span className="font-medium">
                                   {company.EBIT_margin ? `${(company.EBIT_margin * 100).toFixed(1)}%` : 'N/A'}
                                 </span>
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <Users className="h-4 w-4 text-foreground" />
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
              <span className="text-sm text-muted-foreground">
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
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(searchResults.summary.avgRevenue)}
                  </div>
                  <p className="text-xs text-muted-foreground">Genomsnittlig omsättning</p>
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
                  <div className="text-2xl font-bold text-primary">
                    {searchResults.summary.avgGrowth.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Genomsnittlig tillväxttakt</p>
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
                  <div className="text-2xl font-bold text-primary">
                    {searchResults.summary.avgMargin.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Genomsnittlig EBIT-marginal</p>
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
                  <p className="text-xs text-muted-foreground">Matchande kriterier</p>
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
        <div className="fixed inset-0 bg-card bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl shadow-2xl">
            {/* Header - Charcoal Background */}
            <div className="bg-card text-primary-foreground p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{selectedCompany.name}</h1>
                  <p className="text-muted-foreground text-sm mb-4">Företagsinformation och finansiell analys</p>
                  <div className="grid grid-cols-2 gap-4 text-muted-foreground text-sm">
                    <div><strong>Org.nr:</strong> {selectedCompany.OrgNr}</div>
                    <div>
                      <strong>Bransch:</strong>{' '}
                      {(() => {
                        // Parse segment_name if it's a JSON string array
                        let industries: string[] = []
                        if (selectedCompany.segment_name) {
                          try {
                            const parsed = typeof selectedCompany.segment_name === 'string' 
                              ? JSON.parse(selectedCompany.segment_name) 
                              : selectedCompany.segment_name
                            industries = Array.isArray(parsed) ? parsed : [parsed]
                          } catch {
                            industries = [selectedCompany.segment_name]
                          }
                        } else if (selectedCompany.industry_name) {
                          industries = [selectedCompany.industry_name]
                        }
                        
                        if (industries.length === 0) {
                          return <span>N/A</span>
                        }
                        
                        return (
                          <span className="flex flex-wrap gap-1 mt-1">
                            {industries.map((industry, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs bg-card/20 text-primary-foreground border-border/30">
                                {industry}
                              </Badge>
                            ))}
                          </span>
                        )
                      })()}
                    </div>
                    <div><strong>Adress:</strong> {selectedCompany.address || 'N/A'}</div>
                    <div><strong>Stad:</strong> {selectedCompany.city || 'N/A'}</div>
                    {selectedCompany.homepage && (
                      <div className="col-span-2">
                        <strong>Webbplats:</strong> 
                        <a 
                          href={selectedCompany.homepage} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="ml-2 text-primary-foreground hover:text-muted-foreground underline"
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
                  className="rounded-full w-10 h-10 p-0"
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
                  <h2 className="text-2xl font-bold text-foreground">Finansiell utveckling</h2>
                  <p className="text-primary text-sm">Senaste 4 åren</p>
                </div>
                
                {/* Chart Container */}
                <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                  <div className="h-48 mb-4">
                    <div className="flex items-end justify-between h-full">
                      {/* Chart bars with real data from company_accounts_by_id */}
                      {selectedCompany.historicalData && Array.isArray(selectedCompany.historicalData) && selectedCompany.historicalData.length > 0 ? (
                        (() => {
                          // Calculate max Revenue (SDI) across all years for proper scaling
                          // Bar height represents Revenue, with EBIT and Profit stacked proportionally
                          const allRevenues = selectedCompany.historicalData.map(d => {
                            const sdi = (d && (d.SDI !== null && d.SDI !== undefined)) ? d.SDI : 0
                            return sdi
                          })
                          const maxRevenue = Math.max(...allRevenues, 1) // Prevent division by zero
                          
                          return selectedCompany.historicalData.map((data, index) => {
                            // Ensure data exists and has required properties
                            if (!data || typeof data !== 'object') {
                              return null
                            }
                            
                            const safeData = {
                              year: data.year || 2023,
                              SDI: (data.SDI !== null && data.SDI !== undefined) ? data.SDI : 0, // Revenue (Omsättning)
                              RG: (data.RG !== null && data.RG !== undefined) ? data.RG : 0,   // EBIT
                              DR: (data.DR !== null && data.DR !== undefined) ? data.DR : 0    // Net Profit (Vinst)
                            }
                            
                            // Calculate heights as percentages of max Revenue for proper scaling
                            // Bar height represents Revenue, with EBIT and Profit stacked proportionally
                            const sdiHeight = (safeData.SDI / maxRevenue) * 100
                            const rgHeight = safeData.RG > 0 ? (safeData.RG / maxRevenue) * 100 : 0
                            const drHeight = safeData.DR > 0 ? (safeData.DR / maxRevenue) * 100 : 0
                            
                            // Total bar height is Revenue (since it's the largest and represents the full bar)
                            const totalBarHeight = sdiHeight
                            
                            return (
                              <div key={index} className="flex flex-col items-center flex-1">
                                <div className="flex flex-col items-end justify-end gap-0 mb-2 w-full" style={{ height: '100%' }}>
                                  {/* Stacked bars - Revenue (bottom), EBIT (middle), Profit (top) */}
                                  {totalBarHeight > 0 && (
                                    <div 
                                      className="w-full relative"
                                      style={{ height: `${Math.max(totalBarHeight, 2)}%`, minHeight: totalBarHeight > 0 ? '4px' : '0' }}
                                    >
                                      {/* Revenue (SDI) - full bar height (bottom segment) */}
                                      <div 
                                        className="bg-primary w-full absolute bottom-0 rounded-t"
                                        style={{ 
                                          height: '100%',
                                          minHeight: '4px'
                                        }}
                                        title={`Omsättning: ${formatCurrency(safeData.SDI, 1)}`}
                                      ></div>
                                      {/* EBIT (RG) - middle segment, visible as overlay on Revenue */}
                                      {rgHeight > 0 && safeData.RG > 0 && (
                                        <div 
                                          className="bg-chart-2 w-full absolute bottom-0 rounded"
                                          style={{ 
                                            height: `${Math.max(rgHeight, 3)}%`,
                                            minHeight: '4px',
                                            zIndex: 1,
                                            opacity: 0.9
                                          }}
                                          title={`EBIT: ${formatEBIT(safeData.RG, 1)}`}
                                        ></div>
                                      )}
                                      {/* Profit (DR) - top segment, visible as overlay */}
                                      {drHeight > 0 && safeData.DR > 0 && (
                                        <div 
                                          className="bg-chart-3 w-full absolute bottom-0 rounded-t"
                                          style={{ 
                                            height: `${Math.max(drHeight, 3)}%`,
                                            minHeight: '4px',
                                            zIndex: 2,
                                            opacity: 0.9
                                          }}
                                          title={`Vinst: ${formatCurrency(safeData.DR, 1)}`}
                                        ></div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-foreground font-medium mt-1">{safeData.year ? `${safeData.year}-12-31` : 'N/A'}</div>
                                <div className="text-xs font-bold text-primary mt-0.5">{formatCurrency(safeData.SDI, 1)}</div>
                                {(safeData.RG !== null && safeData.RG !== undefined && safeData.RG !== 0) && (
                                  <div className="text-xs font-bold text-chart-2">{formatEBIT(safeData.RG, 1)}</div>
                                )}
                                {(safeData.DR !== null && safeData.DR !== undefined && safeData.DR !== 0) && (
                                  <div className="text-xs font-bold text-chart-3">{formatCurrency(safeData.DR, 1)}</div>
                                )}
                              </div>
                            )
                          }).filter(Boolean) // Remove any null entries
                        })()
                      ) : (
                        // Fallback to mock data if no historical data
                        <>
                          <div className="flex flex-col items-center">
                            <div className="bg-primary w-12 h-20 mb-2 rounded-t-lg"></div>
                            <div className="text-xs text-foreground font-medium">{selectedCompany.year ? `${selectedCompany.year}-12-31` : 'N/A'}</div>
                            <div className="text-xs font-bold text-primary">{formatCurrency(selectedCompany.SDI, 1)}</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="bg-primary/80 w-12 h-16 mb-2 rounded-t-lg"></div>
                            <div className="text-xs text-foreground font-medium">{selectedCompany.year ? `${selectedCompany.year - 1}-12-31` : 'N/A'}</div>
                            <div className="text-xs font-bold text-primary">{formatCurrency((selectedCompany.SDI || 0) * 0.95, 1)}</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="bg-primary/60 w-12 h-12 mb-2 rounded-t-lg"></div>
                            <div className="text-xs text-foreground font-medium">{selectedCompany.year ? `${selectedCompany.year - 2}-12-31` : 'N/A'}</div>
                            <div className="text-xs font-bold text-primary">{formatCurrency((selectedCompany.SDI || 0) * 0.9, 1)}</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="bg-primary/40 w-12 h-8 mb-2 rounded-t-lg"></div>
                            <div className="text-xs text-foreground font-medium">{selectedCompany.year ? `${selectedCompany.year - 3}-12-31` : 'N/A'}</div>
                            <div className="text-xs font-bold text-primary">{formatCurrency((selectedCompany.SDI || 0) * 0.85, 1)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Chart Legend */}
                  <div className="flex gap-8 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-primary rounded"></div>
                      <span className="font-medium text-foreground">Omsättning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-chart-2 rounded"></div>
                      <span className="font-medium text-foreground">EBIT</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-chart-3 rounded"></div>
                      <span className="font-medium text-foreground">Vinst</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-foreground mb-4">Sammanfattning {selectedCompany.year ? `${selectedCompany.year}-12-31` : 'N/A'}</h3>
                <div className="grid grid-cols-5 gap-4">
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Omsättning</div>
                        <div className="text-2xl font-bold text-foreground">{formatCurrency(selectedCompany.SDI, 1)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">EBIT</div>
                        <div className="text-2xl font-bold text-foreground">
                          {selectedCompany.ORS ? formatEBIT(selectedCompany.ORS, 1) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Vinst</div>
                        <div className="text-2xl font-bold text-foreground">
                          {selectedCompany.DR ? formatCurrency(selectedCompany.DR, 1) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Tillväxt</div>
                        <div className="text-2xl font-bold text-foreground">
                          {(() => {
                            // Calculate year-over-year growth from historical data
                            // Use the same data points as shown in the chart (historicalData array)
                            let currentNum: number | null = null
                            let previousNum: number | null = null
                            
                            if (selectedCompany.historicalData && Array.isArray(selectedCompany.historicalData) && selectedCompany.historicalData.length >= 2) {
                              // historicalData is sorted descending (newest first): [2024, 2023, 2022, 2021]
                              const currentYearData = selectedCompany.historicalData[0]
                              const previousYearData = selectedCompany.historicalData[1]
                              
                              if (currentYearData && previousYearData) {
                                // Get SDI (Revenue) values - these are in thousands, same as chart displays
                                const current = currentYearData.SDI
                                const previous = previousYearData.SDI
                                
                                // Convert to numbers if needed
                                currentNum = typeof current === 'number' ? current : (current != null && current !== '' ? Number(current) : null)
                                previousNum = typeof previous === 'number' ? previous : (previous != null && previous !== '' ? Number(previous) : null)
                              }
                            }
                            
                            // Fallback: try to get from the chart data if historicalData didn't work
                            if ((currentNum == null || previousNum == null) && selectedCompany.historicalData && Array.isArray(selectedCompany.historicalData)) {
                              // Try to find valid values in the array
                              const validData = selectedCompany.historicalData.filter(d => d && d.SDI != null && d.SDI !== '' && Number(d.SDI) > 0)
                              if (validData.length >= 2) {
                                currentNum = typeof validData[0].SDI === 'number' ? validData[0].SDI : Number(validData[0].SDI)
                                previousNum = typeof validData[1].SDI === 'number' ? validData[1].SDI : Number(validData[1].SDI)
                              }
                            }
                            
                            // Calculate growth if we have valid numbers
                            if (currentNum != null && previousNum != null && 
                                !isNaN(currentNum) && !isNaN(previousNum) && 
                                isFinite(currentNum) && isFinite(previousNum) &&
                                previousNum > 0) {
                              const growth = ((currentNum / previousNum) - 1) * 100
                              return `${growth.toFixed(1)}%`
                            }
                            
                            return 'N/A'
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">EBIT-marginal</div>
                        <div className="text-2xl font-bold text-foreground">
                          {selectedCompany.EBIT_margin != null 
                            ? `${(selectedCompany.EBIT_margin * 100).toFixed(1)}%`
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Company Information */}
                <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                  <h3 className="text-lg font-bold text-foreground mb-4">Företagsinformation</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Bolagsform:</span>
                      <span className="font-semibold text-foreground text-sm">Aktiebolag</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Registreringsår:</span>
                      <span className="font-semibold text-foreground text-sm">
                        {selectedCompany.incorporation_date ? new Date(selectedCompany.incorporation_date).getFullYear() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Antal anställda:</span>
                      <span className="font-semibold text-foreground text-sm">{selectedCompany.employees || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground text-sm">Företagsstorlek:</span>
                      <span className="font-semibold text-foreground text-sm">{selectedCompany.company_size_category || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Financial KPIs */}
                <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
                  <h3 className="text-lg font-bold text-foreground mb-4">Finansiella nyckeltal {selectedCompany.year ? `${selectedCompany.year}-12-31` : 'N/A'}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">EBIT:</span>
                      <div className="text-right">
                        <span className="font-semibold text-foreground text-sm">
                          {selectedCompany.ORS ? formatEBIT(selectedCompany.ORS, 1) : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">EBIT-marginal:</span>
                      <div className="text-right">
                        <span className="font-semibold text-foreground text-sm">
                          {selectedCompany.EBIT_margin != null 
                            ? `${(selectedCompany.EBIT_margin * 100).toFixed(1)}%`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Vinst (Nettoresultat):</span>
                      <div className="text-right">
                        <span className="font-semibold text-foreground text-sm">
                          {selectedCompany.DR ? formatCurrency(selectedCompany.DR, 1) : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground text-sm">Vinstmarginal:</span>
                      <div className="text-right">
                        <span className="font-semibold text-foreground text-sm">
                          {selectedCompany.NetProfit_margin ? `${(selectedCompany.NetProfit_margin * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground text-sm">Tillväxt:</span>
                      <div className="text-right">
                        <span className="font-semibold text-foreground text-sm">
                          {(() => {
                            // Calculate year-over-year growth from historical data
                            // Use the same data points as shown in the chart (historicalData array)
                            let currentNum: number | null = null
                            let previousNum: number | null = null
                            
                            if (selectedCompany.historicalData && Array.isArray(selectedCompany.historicalData) && selectedCompany.historicalData.length >= 2) {
                              // historicalData is sorted descending (newest first): [2024, 2023, 2022, 2021]
                              const currentYearData = selectedCompany.historicalData[0]
                              const previousYearData = selectedCompany.historicalData[1]
                              
                              if (currentYearData && previousYearData) {
                                // Get SDI (Revenue) values - these are in thousands, same as chart displays
                                const current = currentYearData.SDI
                                const previous = previousYearData.SDI
                                
                                // Convert to numbers if needed
                                currentNum = typeof current === 'number' ? current : (current != null && current !== '' ? Number(current) : null)
                                previousNum = typeof previous === 'number' ? previous : (previous != null && previous !== '' ? Number(previous) : null)
                              }
                            }
                            
                            // Fallback: try to get from the chart data if historicalData didn't work
                            if ((currentNum == null || previousNum == null) && selectedCompany.historicalData && Array.isArray(selectedCompany.historicalData)) {
                              // Try to find valid values in the array
                              const validData = selectedCompany.historicalData.filter(d => d && d.SDI != null && d.SDI !== '' && Number(d.SDI) > 0)
                              if (validData.length >= 2) {
                                currentNum = typeof validData[0].SDI === 'number' ? validData[0].SDI : Number(validData[0].SDI)
                                previousNum = typeof validData[1].SDI === 'number' ? validData[1].SDI : Number(validData[1].SDI)
                              }
                            }
                            
                            // Calculate growth if we have valid numbers
                            if (currentNum != null && previousNum != null && 
                                !isNaN(currentNum) && !isNaN(previousNum) && 
                                isFinite(currentNum) && isFinite(previousNum) &&
                                previousNum > 0) {
                              const growth = ((currentNum / previousNum) - 1) * 100
                              return `${growth.toFixed(1)}%`
                            }
                            
                            return 'N/A'
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Deep Dive Section */}
              <div className="mb-8">
                <AIDeepDivePanel 
                  orgnr={selectedCompany.OrgNr} 
                  companyName={selectedCompany.name}
                />
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
