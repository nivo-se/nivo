import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { FileText, Search, Filter, Eye, Trash2, RefreshCw, Calendar, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { AnalysisDetailView } from '../components/AnalysisDetailView'
import { analysisService, AnalyzedCompany } from '../lib/analysisService'

const AnalyzedCompanies: React.FC = () => {
  const [companies, setCompanies] = useState<AnalyzedCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRecommendation, setFilterRecommendation] = useState<string>('all')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalyzedCompany | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadAnalyzedCompanies()
  }, [currentPage, searchTerm, filterRecommendation, filterRisk, sortBy, sortOrder])

  const loadAnalyzedCompanies = async () => {
    try {
      setLoading(true)
      const filters = {
        search: searchTerm,
        recommendation: filterRecommendation !== 'all' ? filterRecommendation : undefined,
        riskLevel: filterRisk !== 'all' ? filterRisk : undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: itemsPerPage
      }
      
      const result = await analysisService.getAnalyzedCompanies(filters)
      setCompanies(result.companies)
      setTotalPages(Math.ceil(result.total / itemsPerPage))
    } catch (error) {
      console.error('Error loading analyzed companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAnalysis = async (runId: string) => {
    if (window.confirm('Är du säker på att du vill ta bort denna analys?')) {
      try {
        await analysisService.deleteAnalysis(runId)
        loadAnalyzedCompanies()
      } catch (error) {
        console.error('Error deleting analysis:', error)
      }
    }
  }

  const handleReAnalyze = async (company: AnalyzedCompany) => {
    // Navigate to AI-Insikter page with pre-selected company
    window.location.href = '/dashboard?page=ai-insights&company=' + encodeURIComponent(company.orgnr)
  }

  const getRecommendationBadge = (recommendation: string) => {
    const variants = {
      'Köp': 'default',
      'Håll': 'secondary', 
      'Sälj': 'destructive'
    } as const
    
    return (
      <Badge variant={variants[recommendation as keyof typeof variants] || 'secondary'}>
        {recommendation}
      </Badge>
    )
  }

  const getRiskBadge = (riskLevel: string) => {
    const variants = {
      'Low risk': 'default',
      'Medium risk': 'secondary',
      'High risk': 'destructive'
    } as const
    
    return (
      <Badge variant={variants[riskLevel as keyof typeof variants] || 'secondary'}>
        {riskLevel}
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

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.orgnr.includes(searchTerm)
    const matchesRecommendation = filterRecommendation === 'all' || company.recommendation === filterRecommendation
    const matchesRisk = filterRisk === 'all' || company.riskLevel === filterRisk
    
    return matchesSearch && matchesRecommendation && matchesRisk
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Analyserade Företag</h1>
          <p className="text-gray-400 mt-1">
            Översikt över alla genomförda AI-analyser och deras resultat
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

      {/* Filters */}
      <Card className="bg-[#2E2A2B] border-[#4A4A4A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filter och Sök
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Sök företag eller organisationsnummer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-[#1A1A1A] border-[#4A4A4A] text-white"
              />
            </div>
            
            <Select value={filterRecommendation} onValueChange={setFilterRecommendation}>
              <SelectTrigger className="bg-[#1A1A1A] border-[#4A4A4A] text-white">
                <SelectValue placeholder="Rekommendation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla rekommendationer</SelectItem>
                <SelectItem value="Köp">Köp</SelectItem>
                <SelectItem value="Håll">Håll</SelectItem>
                <SelectItem value="Sälj">Sälj</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="bg-[#1A1A1A] border-[#4A4A4A] text-white">
                <SelectValue placeholder="Risknivå" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla risknivåer</SelectItem>
                <SelectItem value="Low risk">Låg risk</SelectItem>
                <SelectItem value="Medium risk">Medium risk</SelectItem>
                <SelectItem value="High risk">Hög risk</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [field, order] = value.split('-')
              setSortBy(field)
              setSortOrder(order as 'asc' | 'desc')
            }}>
              <SelectTrigger className="bg-[#1A1A1A] border-[#4A4A4A] text-white">
                <SelectValue placeholder="Sortera efter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Datum (nyast först)</SelectItem>
                <SelectItem value="date-asc">Datum (äldst först)</SelectItem>
                <SelectItem value="score-desc">Poäng (högst först)</SelectItem>
                <SelectItem value="score-asc">Poäng (lägst först)</SelectItem>
                <SelectItem value="company-asc">Företagsnamn (A-Ö)</SelectItem>
                <SelectItem value="company-desc">Företagsnamn (Ö-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="bg-[#2E2A2B] border-[#4A4A4A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>Analysresultat ({filteredCompanies.length})</span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAnalyzedCompanies}
              disabled={loading}
              className="border-[#4A4A4A] text-gray-300 hover:bg-[#4A4A4A]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4A9B8E]"></div>
              <span className="ml-2 text-gray-400">Laddar analyser...</span>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">Inga analyser hittades</h3>
              <p className="text-gray-400 mb-4">
                {searchTerm || filterRecommendation !== 'all' || filterRisk !== 'all' 
                  ? 'Inga analyser matchar dina filter. Prova att ändra söktermerna.'
                  : 'Du har inte genomfört några analyser än. Kom igång med din första analys!'
                }
              </p>
              {!searchTerm && filterRecommendation === 'all' && filterRisk === 'all' && (
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
                  <TableRow className="border-[#4A4A4A]">
                    <TableHead className="text-gray-300">Företag</TableHead>
                    <TableHead className="text-gray-300">Analysdatum</TableHead>
                    <TableHead className="text-gray-300">Rekommendation</TableHead>
                    <TableHead className="text-gray-300">Poäng</TableHead>
                    <TableHead className="text-gray-300">Risk</TableHead>
                    <TableHead className="text-gray-300">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.runId} className="border-[#4A4A4A] hover:bg-[#3A3A3A]">
                      <TableCell className="text-white">
                        <div>
                          <div className="font-medium">{company.companyName}</div>
                          <div className="text-sm text-gray-400">{company.orgnr}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          {formatDate(company.analysisDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRecommendationBadge(company.recommendation)}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center">
                          <TrendingUp className="w-4 h-4 mr-2" />
                          {company.screeningScore}/100
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRiskBadge(company.riskLevel)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedAnalysis(company)}
                            className="border-[#4A4A4A] text-gray-300 hover:bg-[#4A4A4A]"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReAnalyze(company)}
                            className="border-[#4A4A4A] text-gray-300 hover:bg-[#4A4A4A]"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAnalysis(company.runId)}
                            className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
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
            className="border-[#4A4A4A] text-gray-300 hover:bg-[#4A4A4A]"
          >
            Föregående
          </Button>
          <span className="text-gray-300 px-4">
            Sida {currentPage} av {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="border-[#4A4A4A] text-gray-300 hover:bg-[#4A4A4A]"
          >
            Nästa
          </Button>
        </div>
      )}

      {/* Analysis Detail Modal */}
      {selectedAnalysis && (
        <AnalysisDetailView
          analysis={selectedAnalysis}
          onClose={() => setSelectedAnalysis(null)}
          onReAnalyze={() => {
            setSelectedAnalysis(null)
            handleReAnalyze(selectedAnalysis)
          }}
        />
      )}
    </div>
  )
}

export default AnalyzedCompanies
