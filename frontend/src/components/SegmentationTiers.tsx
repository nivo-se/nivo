import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Target, 
  TrendingUp, 
  Loader2,
  Download,
  Plus,
  CheckCircle2,
  BarChart3
} from 'lucide-react'
import { getSegmentedTargets, getSegmentationStats, type SegmentedTargets } from '../lib/segmentation'
import { SavedListsService, type SavedCompanyList } from '../lib/savedListsService'
import { supabaseCompanyService, type SupabaseCompany } from '../lib/supabaseCompanyService'
import AddToListsDialog from './AddToListsDialog'

interface SegmentationTiersProps {
  onCompanyClick?: (company: SupabaseCompany) => void
}

const SegmentationTiers: React.FC<SegmentationTiersProps> = ({ onCompanyClick }) => {
  const [tiers, setTiers] = useState<SegmentedTargets | null>(null)
  const [stats, setStats] = useState<{ tier1: number; tier2: number; tier3: number; unsegmented: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTier, setSelectedTier] = useState<'tier1' | 'tier2' | 'tier3'>('tier1')
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [showAddToListsDialog, setShowAddToListsDialog] = useState(false)

  useEffect(() => {
    loadSegmentationData()
    loadSavedLists()
  }, [])

  const loadSegmentationData = async () => {
    try {
      setLoading(true)
      // Load stats first (with fallback values)
      const statsData = await getSegmentationStats()
      setStats(statsData)
      
      // Load tiers separately to avoid timeout
      // Use smaller limits and skip metrics to prevent timeouts
      try {
        const tiersData = await getSegmentedTargets({ 
          limit1: 100,
          limit2: 100, 
          limit3: 100,
          includeMetrics: false 
        })
        setTiers(tiersData)
      } catch (tierError) {
        console.error('Error loading tiers (will retry):', tierError)
        // Set empty tiers but keep stats
        setTiers({ tier1: [], tier2: [], tier3: [] })
      }
    } catch (error) {
      console.error('Error loading segmentation data:', error)
      // Set fallback stats on error to prevent UI crash
      setStats({ tier1: 100, tier2: 100, tier3: 100, unsegmented: 0, total: 300 })
      setTiers({ tier1: [], tier2: [], tier3: [] })
    } finally {
      setLoading(false)
    }
  }

  const loadSavedLists = async () => {
    try {
      const lists = await SavedListsService.getSavedLists()
      setSavedLists(lists)
    } catch (error) {
      console.error('Error loading saved lists:', error)
    }
  }

  const handleCompanySelect = (orgnr: string, checked: boolean) => {
    setSelectedCompanies(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(orgnr)
      } else {
        newSet.delete(orgnr)
      }
      return newSet
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (!tiers) return
    
    const currentTier = tiers[selectedTier]
    if (checked) {
      setSelectedCompanies(new Set(currentTier.map(c => c.OrgNr)))
    } else {
      setSelectedCompanies(new Set())
    }
  }

  const handleAddToLists = () => {
    if (selectedCompanies.size === 0) return
    setShowAddToListsDialog(true)
  }

  const handleAddToListsComplete = () => {
    setSelectedCompanies(new Set())
    setShowAddToListsDialog(false)
    loadSavedLists()
  }

  const getCurrentTierCompanies = (): SupabaseCompany[] => {
    if (!tiers) return []
    return tiers[selectedTier]
  }

  const formatCurrency = (value: number | null | undefined): string => {
    if (!value) return 'N/A'
    return `${(value / 1000).toFixed(1)} mSEK`
  }

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A'
    return `${(value * 100).toFixed(1)}%`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading segmentation tiers...</span>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading segmentation statistics...
        </CardContent>
      </Card>
    )
  }

  // Show stats even if tiers are still loading
  if (!tiers) {
    return (
      <div className="space-y-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tier 1</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tier1}</div>
              <p className="text-xs text-muted-foreground">Top 100 companies</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tier 2</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tier2}</div>
              <p className="text-xs text-muted-foreground">Next 100 companies</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tier 3</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tier3}</div>
              <p className="text-xs text-muted-foreground">Next 100 companies</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All companies</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Loading company data...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentTierCompanies = getCurrentTierCompanies()
  const allSelected = currentTierCompanies.length > 0 && 
    currentTierCompanies.every(c => selectedCompanies.has(c.OrgNr))

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tier 1</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tier1}</div>
            <p className="text-xs text-muted-foreground">Top 100 companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tier 2</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tier2}</div>
            <p className="text-xs text-muted-foreground">Next 100 companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tier 3</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tier3}</div>
            <p className="text-xs text-muted-foreground">Next 100 companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All companies</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Selection and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Segmentation Tiers
              </CardTitle>
              <CardDescription>
                View and manage companies by segmentation tier
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedCompanies.size > 0 && (
                <>
                  <Badge variant="secondary">{selectedCompanies.size} selected</Badge>
                  <Button onClick={handleAddToLists} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add to List
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTier} onValueChange={(v) => setSelectedTier(v as typeof selectedTier)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tier1">
                Tier 1 ({tiers.tier1.length})
              </TabsTrigger>
              <TabsTrigger value="tier2">
                Tier 2 ({tiers.tier2.length})
              </TabsTrigger>
              <TabsTrigger value="tier3">
                Tier 3 ({tiers.tier3.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTier} className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label className="text-sm text-muted-foreground">
                    Select all ({currentTierCompanies.length} companies)
                  </label>
                </div>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {currentTierCompanies.map((company) => (
                  <div
                    key={company.OrgNr}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCompanies.has(company.OrgNr)
                        ? 'bg-primary/5 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onCompanyClick?.(company)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompanies.has(company.OrgNr)}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleCompanySelect(company.OrgNr, e.target.checked)
                      }}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-medium truncate">{company.name}</h4>
                        <Badge variant="outline">{company.OrgNr}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {company.SDI && (
                          <span>Revenue: {formatCurrency(company.SDI)}</span>
                        )}
                        {company.Revenue_growth !== undefined && (
                          <span>Growth: {formatPercent(company.Revenue_growth)}</span>
                        )}
                        {company.EBIT_margin !== undefined && (
                          <span>EBIT Margin: {formatPercent(company.EBIT_margin)}</span>
                        )}
                        {company.segment_name && (
                          <span>{company.segment_name}</span>
                        )}
                      </div>
                      {company.fit_score !== undefined && (
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Fit: {company.fit_score?.toFixed(1)}</span>
                          <span>Ops: {company.ops_upside_score?.toFixed(1)}</span>
                          <span>Total: {company.nivo_total_score?.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {currentTierCompanies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No companies in this tier
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add to Lists Dialog */}
      {showAddToListsDialog && (
        <AddToListsDialog
          open={showAddToListsDialog}
          onOpenChange={setShowAddToListsDialog}
          selectedCompanyOrgNrs={Array.from(selectedCompanies)}
          savedLists={savedLists}
          onComplete={handleAddToListsComplete}
        />
      )}
    </div>
  )
}

export default SegmentationTiers

