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
  RotateCcw,
  ChevronUp
} from 'lucide-react'
import { supabase, supabaseConfig } from '../lib/supabase'
import { getLocalIndustrySummaries } from '../lib/sampleData'

interface Industry {
  code: string
  name: string
  category: string
  companyCount?: number
}

interface CollapsibleIndustryFilterProps {
  selectedIndustries: string[]
  onIndustriesChange: (industries: string[], mode: 'include' | 'exclude') => void
  filterMode: 'include' | 'exclude'
  onModeChange: (mode: 'include' | 'exclude') => void
}

const CollapsibleIndustryFilter: React.FC<CollapsibleIndustryFilterProps> = ({
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
  const [isExpanded, setIsExpanded] = useState(false)
  const supabaseEnabled = supabaseConfig.isConfigured

  // Load industries from our new classification system
  useEffect(() => {
    const loadIndustries = async () => {
      try {
        setLoading(true)

        if (!supabaseEnabled) {
          const fallbackIndustries = getLocalIndustrySummaries().map(summary => ({
            code: summary.code,
            name: summary.name,
            category: summary.category,
            companyCount: summary.companyCount
          }))

          setIndustries(fallbackIndustries)
          setFilteredIndustries(fallbackIndustries)
          return
        }

        // Get industry categories from our new classification
        const { data: industryData, error: industryError } = await supabase
          .from('industry_classification')
          .select('industry_category')
          .not('industry_category', 'is', null)

        if (industryError) {
          console.error('Error loading industries:', industryError)
          return
        }

        // Count companies per industry category
        const industryCounts = new Map<string, number>()
        industryData?.forEach(item => {
          const category = item.industry_category
          if (category) {
            industryCounts.set(category, (industryCounts.get(category) || 0) + 1)
          }
        })

        // Create industry objects
        const industriesWithCounts = Array.from(industryCounts.entries()).map(([name, companyCount]) => ({
          code: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name,
          category: 'Business Categories',
          companyCount
        }))

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
        industry.code.includes(searchTerm.toLowerCase())
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

  const hasActiveFilters = selectedIndustries.length > 0

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Industry Filter</CardTitle>
            {hasActiveFilters && (
              <Badge variant="default" className="ml-2">
                {selectedIndustries.length} selected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <CardDescription>
          {filterMode === 'include' 
            ? 'Select industries to include in search results' 
            : 'Select industries to exclude from search results'
          }
        </CardDescription>
      </CardHeader>

      {/* Collapsible Content */}
      {isExpanded && (
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
            {Object.keys(groupedIndustries).map(category => {
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
        </CardContent>
      )}
    </Card>
  )
}

export default CollapsibleIndustryFilter










