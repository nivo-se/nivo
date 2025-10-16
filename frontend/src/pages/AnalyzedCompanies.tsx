import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { 
  FileText, 
  Search, 
  Filter, 
  Eye, 
  Trash2, 
  RefreshCw, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Users,
  Clock,
  Play,
  XCircle
} from 'lucide-react'
import { AnalysisDetailView } from '../components/AnalysisDetailView'
import { AnalysisRunsService, AnalysisRun, AnalysisRunFilters } from '../lib/analysisRunsService'
import { AIAnalysisService } from '../lib/aiAnalysisService'

const AnalyzedCompanies: React.FC = () => {
  // State for analysis runs view
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRuns, setTotalRuns] = useState(0)
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set())
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [analysisMode, setAnalysisMode] = useState<string>('all')
  const [templateFilter, setTemplateFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // View mode state
  const [viewMode, setViewMode] = useState<'runs' | 'companies'>('runs')
  
  // Selected analysis for detail view
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null)
  
  const itemsPerPage = 20
  const templates = AIAnalysisService.getAnalysisTemplates()

  useEffect(() => {
    loadAnalysisRuns()
  }, [currentPage, searchTerm, analysisMode, templateFilter, dateFrom, dateTo, statusFilter, sortBy, sortOrder])

  const loadAnalysisRuns = async () => {
    try {
      setLoading(true)
      const filters: AnalysisRunFilters = {
        search: searchTerm || undefined,
        analysisMode: analysisMode !== 'all' ? analysisMode as 'screening' | 'deep' : undefined,
        templateId: templateFilter !== 'all' ? templateFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sortBy: sortBy as 'date' | 'companies' | 'template',
        sortOrder,
        page: currentPage,
        limit: itemsPerPage
      }
      
      const result = await AnalysisRunsService.getAnalysisRuns(filters)
      setRuns(result.runs)
      setTotalPages(result.totalPages)
      setTotalRuns(result.total)
    } catch (error) {
      console.error('Error loading analysis runs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRun = async (runId: string) => {
    if (window.confirm('Är du säker på att du vill ta bort denna analysomgång?')) {
      try {
        const success = await AnalysisRunsService.deleteRun(runId)
        if (success) {
          loadAnalysisRuns()
        } else {
          alert('Kunde inte ta bort analysen. Försök igen.')
        }
      } catch (error) {
        console.error('Error deleting run:', error)
        alert('Ett fel uppstod vid borttagning av analysen.')
      }
    }
  }

  const handleReRunAnalysis = async (run: AnalysisRun) => {
    try {
      const result = await AnalysisRunsService.reRunAnalysis(run.id)
      if (result.success) {
        alert('Analysen har startats om. Du kan följa framstegen i AI-Insikter.')
        loadAnalysisRuns()
      } else {
        alert(result.error || 'Kunde inte starta om analysen.')
      }
    } catch (error) {
      console.error('Error re-running analysis:', error)
      alert('Ett fel uppstod vid omstart av analysen.')
    }
  }

  const toggleRunExpansion = (runId: string) => {
    const newExpanded = new Set(expandedRuns)
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId)
    } else {
      newExpanded.add(runId)
    }
    setExpandedRuns(newExpanded)
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      'completed': { variant: 'default' as const, icon: CheckCircle, text: 'Slutförd' },
      'running': { variant: 'secondary' as const, icon: Play, text: 'Pågår' },
      'failed': { variant: 'destructive' as const, icon: XCircle, text: 'Misslyckad' }
    }
    
    const config = variants[status as keyof typeof variants] || variants.completed
    const Icon = config.icon
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    )
  }

  const getAnalysisModeBadge = (mode: string) => {
    const variants = {
      'screening': { variant: 'outline' as const, text: 'Screening' },
      'deep': { variant: 'default' as const, text: 'Djupanalys' }
    }
    
    const config = variants[mode as keyof typeof variants] || variants.screening
    
    return (
      <Badge variant={config.variant}>
        {config.text}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analyser</h1>
          <p className="text-gray-600 mt-1">
            Översikt över alla genomförda AI-analyser, sorterade per analysomgång
          </p>
        </div>
        <Button 
          onClick={() => window.location.href = '/dashboard?page=ai-insights'}
          className="bg-[#4A9B8E] hover:bg-[#3d8277] text-white"
        >
          <FileText className="w-4 h-4 mr-2" />
          Ny Analys
        </Button>
      </div>

      {/* View Mode Toggle */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'runs' | 'companies')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="runs">Analysomgångar</TabsTrigger>
          <TabsTrigger value="companies">Företag</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-6">
          {/* Enhanced Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filter och Sök
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Sök företag, run ID, eller analysfokus..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Analysis Type */}
                <Select value={analysisMode} onValueChange={setAnalysisMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Analystyp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla analystyper</SelectItem>
                    <SelectItem value="screening">Screening</SelectItem>
                    <SelectItem value="deep">Djupanalys</SelectItem>
                  </SelectContent>
                </Select>

                {/* Template Filter */}
                <Select value={templateFilter} onValueChange={setTemplateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Analysfokus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla mallar</SelectItem>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Anpassad fokus</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla statusar</SelectItem>
                    <SelectItem value="completed">Slutförd</SelectItem>
                    <SelectItem value="running">Pågår</SelectItem>
                    <SelectItem value="failed">Misslyckad</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date Range */}
                <div className="flex gap-2">
                  <Input 
                    type="date" 
                    placeholder="Från datum" 
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <Input 
                    type="date" 
                    placeholder="Till datum" 
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                
                {/* Sort Options */}
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split('-')
                  setSortBy(field)
                  setSortOrder(order as 'asc' | 'desc')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sortera efter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Datum (nyast först)</SelectItem>
                    <SelectItem value="date-asc">Datum (äldst först)</SelectItem>
                    <SelectItem value="companies-desc">Antal företag (flest först)</SelectItem>
                    <SelectItem value="companies-asc">Antal företag (minst först)</SelectItem>
                    <SelectItem value="template-asc">Analysfokus (A-Ö)</SelectItem>
                    <SelectItem value="template-desc">Analysfokus (Ö-A)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Refresh Button */}
                <Button
                  variant="outline"
                  onClick={loadAnalysisRuns}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Uppdatera
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Analysomgångar ({totalRuns})</span>
                <div className="text-sm text-gray-500">
                  Sida {currentPage} av {totalPages}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4A9B8E]"></div>
                  <span className="ml-2 text-gray-600">Laddar analyser...</span>
                </div>
              ) : runs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Inga analyser hittades</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {searchTerm || analysisMode !== 'all' || templateFilter !== 'all' || statusFilter !== 'all'
                      ? 'Inga analyser matchar dina filter. Prova att ändra söktermerna.'
                      : 'Du har inte genomfört några analyser än. Kom igång med din första analys!'
                    }
                  </p>
                  {!searchTerm && analysisMode === 'all' && templateFilter === 'all' && statusFilter === 'all' && (
                    <Button 
                      onClick={() => window.location.href = '/dashboard?page=ai-insights'}
                      className="bg-[#4A9B8E] hover:bg-[#3d8277] text-white"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Starta första analysen
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Analysdatum</TableHead>
                        <TableHead>Analystyp</TableHead>
                        <TableHead>Analysfokus</TableHead>
                        <TableHead>Företag</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Åtgärder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => (
                        <React.Fragment key={run.id}>
                          <TableRow className="hover:bg-gray-50">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRunExpansion(run.id)}
                                className="p-1"
                              >
                                {expandedRuns.has(run.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                <span className="text-gray-700">{formatDate(run.startedAt)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getAnalysisModeBadge(run.analysisMode)}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                {run.templateName ? (
                                  <span className="font-medium text-gray-900">
                                    {truncateText(run.templateName)}
                                  </span>
                                ) : run.customInstructions ? (
                                  <span className="italic text-gray-600">
                                    {truncateText(run.customInstructions)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Ingen fokus</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {run.companyCount}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(run.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedAnalysis(run)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {run.status === 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReRunAnalysis(run)}
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteRun(run.id)}
                                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {/* Expanded Row Details */}
                          {expandedRuns.has(run.id) && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-gray-50 p-4">
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Analyserade företag</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {run.companies.map((company) => (
                                        <div key={company.orgnr} className="flex items-center justify-between p-2 bg-white rounded border">
                                          <div>
                                            <div className="font-medium text-sm">{company.name}</div>
                                            <div className="text-xs text-gray-500">{company.orgnr}</div>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedAnalysis({ ...run, selectedCompany: company })}
                                          >
                                            <Eye className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {run.customInstructions && (
                                    <div>
                                      <h4 className="font-medium text-gray-900 mb-2">Anpassade instruktioner</h4>
                                      <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                                        {run.customInstructions}
                                      </p>
                                    </div>
                                  )}
                                  
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-gray-900">Modell:</span>
                                      <div className="text-gray-600">{run.modelVersion}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-900">Startad:</span>
                                      <div className="text-gray-600">{formatDate(run.startedAt)}</div>
                                    </div>
                                    {run.completedAt && (
                                      <div>
                                        <span className="font-medium text-gray-900">Slutförd:</span>
                                        <div className="text-gray-600">{formatDate(run.completedAt)}</div>
                                      </div>
                                    )}
                                    <div>
                                      <span className="font-medium text-gray-900">Initierad av:</span>
                                      <div className="text-gray-600">{run.initiatedBy || 'Okänd'}</div>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Föregående
              </Button>
              <span className="text-gray-700 px-4">
                Sida {currentPage} av {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Nästa
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="companies">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-12">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Företagsvy kommer snart</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Denna vy kommer att visa alla analyserade företag individuellt, sorterade efter analysdatum och rekommendation.
                </p>
                <p className="text-sm text-gray-500">
                  Använd "Analysomgångar"-vyn för att se analyser grupperade per körning.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Analysis Detail Modal */}
      {selectedAnalysis && (
        <AnalysisDetailView
          analysis={selectedAnalysis}
          onClose={() => setSelectedAnalysis(null)}
          onReAnalyze={() => {
            setSelectedAnalysis(null)
            if (selectedAnalysis.selectedCompany) {
              window.location.href = '/dashboard?page=ai-insights&company=' + encodeURIComponent(selectedAnalysis.selectedCompany.orgnr)
            } else {
              handleReRunAnalysis(selectedAnalysis)
            }
          }}
        />
      )}
    </div>
  )
}

export default AnalyzedCompanies