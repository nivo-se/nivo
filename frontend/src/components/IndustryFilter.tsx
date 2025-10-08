import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import { Separator } from './ui/separator'
import { 
  Search, 
  Filter, 
  X, 
  Building2, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Minus,
  RotateCcw
} from 'lucide-react'
import { supabase, supabaseConfig } from '../lib/supabase'
import { getLocalIndustrySummaries } from '../lib/sampleData'

interface Industry {
  code: string
  name: string
  category: string
  companyCount?: number
}

interface IndustryFilterProps {
  selectedIndustries: string[]
  onIndustriesChange: (industries: string[], mode: 'include' | 'exclude') => void
  filterMode: 'include' | 'exclude'
  onModeChange: (mode: 'include' | 'exclude') => void
}

const IndustryFilter: React.FC<IndustryFilterProps> = ({
  selectedIndustries,
  onIndustriesChange,
  filterMode,
  onModeChange
}) => {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [filteredIndustries, setFilteredIndustries] = useState<Industry[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const supabaseEnabled = supabaseConfig.isConfigured

  // Load industries from Supabase
  useEffect(() => {
    const loadIndustries = async () => {
      try {
        setLoading(true)

        if (!supabaseEnabled) {
          const fallbackIndustries = getLocalIndustrySummaries()
            .map(summary => ({
              code: summary.code,
              name: summary.name,
              category: summary.category,
              companyCount: summary.companyCount
            }))
            .filter(industry => industry.companyCount > 0)

          setIndustries(fallbackIndustries)
          setFilteredIndustries(fallbackIndustries)
          return
        }

        // Get industry codes with company counts
        const { data: industryData, error: industryError } = await supabase
          .from('industry_codes')
          .select('code, name, category')
          .order('name')

        if (industryError) {
          console.error('Error loading industries:', industryError)
          return
        }

        // Get company counts for each industry
        const { data: companyCounts, error: countError } = await supabase
          .from('master_analytics')
          .select('segment')
          .not('segment', 'is', null)

        if (countError) {
          console.error('Error loading company counts:', countError)
        }

        // Count companies per industry
        const industryCounts = new Map<string, number>()
        companyCounts?.forEach(company => {
          if (company.segment) {
            industryCounts.set(company.segment, (industryCounts.get(company.segment) || 0) + 1)
          }
        })

        // Combine industry data with counts
        const industriesWithCounts = industryData?.map(industry => ({
          ...industry,
          companyCount: industryCounts.get(industry.code) || 0
        })).filter(industry => industry.companyCount > 0) || []

        setIndustries(industriesWithCounts)
        setFilteredIndustries(industriesWithCounts)
      } catch (error) {
        console.error('Error loading industries:', error)
      } finally {
        setLoading(false)
      }
    }

    loadIndustries()
  }, [supabaseEnabled])

  // Filter industries based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredIndustries(industries)
    } else {
      const filtered = industries.filter(industry =>
        industry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        industry.code.includes(searchTerm) ||
        industry.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredIndustries(filtered)
    }
  }, [searchTerm, industries])

  // Group industries by category
  const groupedIndustries = filteredIndustries.reduce((groups, industry) => {
    const category = industry.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(industry)
    return groups
  }, {} as Record<string, Industry[]>)

  // Sort categories by total company count
  const sortedCategories = Object.keys(groupedIndustries).sort((a, b) => {
    const countA = groupedIndustries[a].reduce((sum, industry) => sum + (industry.companyCount || 0), 0)
    const countB = groupedIndustries[b].reduce((sum, industry) => sum + (industry.companyCount || 0), 0)
    return countB - countA
  })

  const toggleIndustry = (industryCode: string) => {
    if (selectedIndustries.includes(industryCode)) {
      onIndustriesChange(
        selectedIndustries.filter(code => code !== industryCode),
        filterMode
      )
    } else {
      onIndustriesChange([...selectedIndustries, industryCode], filterMode)
    }
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const selectAllInCategory = (category: string) => {
    const categoryIndustries = groupedIndustries[category]
    const categoryCodes = categoryIndustries.map(industry => industry.code)
    const newSelected = [...new Set([...selectedIndustries, ...categoryCodes])]
    onIndustriesChange(newSelected, filterMode)
  }

  const deselectAllInCategory = (category: string) => {
    const categoryIndustries = groupedIndustries[category]
    const categoryCodes = categoryIndustries.map(industry => industry.code)
    const newSelected = selectedIndustries.filter(code => !categoryCodes.includes(code))
    onIndustriesChange(newSelected, filterMode)
  }

  const clearAll = () => {
    onIndustriesChange([], filterMode)
  }

  const getSelectedIndustryNames = () => {
    return selectedIndustries
      .map(code => industries.find(industry => industry.code === code)?.name)
      .filter(Boolean)
  }

  const totalCompanies = industries.reduce((sum, industry) => sum + (industry.companyCount || 0), 0)
  const selectedCompanies = selectedIndustries.reduce((sum, code) => {
    const industry = industries.find(i => i.code === code)
    return sum + (industry?.companyCount || 0)
  }, 0)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Industry Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading industries...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Industry Filter
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filterMode === 'include' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('include')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Include
            </Button>
            <Button
              variant={filterMode === 'exclude' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('exclude')}
            >
              <Minus className="h-4 w-4 mr-1" />
              Exclude
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          {filterMode === 'include' 
            ? 'Select industries to include in search results' 
            : 'Select industries to exclude from search results'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search industries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span>
              {selectedIndustries.length} industries selected
            </span>
            <span className="text-gray-500">
              {selectedCompanies.toLocaleString()} companies
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={clearAll}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>

        {/* Selected Industries */}
        {selectedIndustries.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2">
              Selected Industries ({selectedIndustries.length}):
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {getSelectedIndustryNames().map((name, index) => (
                <Badge key={index} variant="default" className="flex items-center gap-1">
                  {name}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => toggleIndustry(selectedIndustries[index])}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Industry Categories */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedCategories.map(category => {
            const categoryIndustries = groupedIndustries[category]
            const categoryCompanyCount = categoryIndustries.reduce((sum, industry) => sum + (industry.companyCount || 0), 0)
            const isExpanded = expandedCategories.has(category)
            const selectedInCategory = categoryIndustries.filter(industry => selectedIndustries.includes(industry.code)).length

            return (
              <div key={category} className="border rounded-lg">
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    <Building2 className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="font-medium">{category}</span>
                    <Badge variant="outline" className="ml-2">
                      {categoryCompanyCount.toLocaleString()} companies
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedInCategory > 0 && (
                      <Badge variant="default">
                        {selectedInCategory}/{categoryIndustries.length} selected
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          selectAllInCategory(category)
                        }}
                        disabled={selectedInCategory === categoryIndustries.length}
                      >
                        All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deselectAllInCategory(category)
                        }}
                        disabled={selectedInCategory === 0}
                      >
                        None
                      </Button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-3">
                    <div className="space-y-2">
                      {categoryIndustries
                        .sort((a, b) => (b.companyCount || 0) - (a.companyCount || 0))
                        .map(industry => (
                        <div 
                          key={industry.code}
                          className="flex items-center justify-between p-2 rounded hover:bg-white cursor-pointer"
                          onClick={() => toggleIndustry(industry.code)}
                        >
                          <div className="flex items-center">
                            <Checkbox
                              checked={selectedIndustries.includes(industry.code)}
                              onChange={() => toggleIndustry(industry.code)}
                              className="mr-3"
                            />
                            <div>
                              <div className="font-medium">{industry.name}</div>
                              <div className="text-sm text-gray-500">{industry.code}</div>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {industry.companyCount?.toLocaleString()} companies
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Show All Toggle */}
        {!showAll && filteredIndustries.length > 20 && (
          <Button 
            variant="outline" 
            onClick={() => setShowAll(true)}
            className="w-full"
          >
            Show All Industries ({filteredIndustries.length})
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default IndustryFilter










