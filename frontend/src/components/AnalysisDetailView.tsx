import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { ChevronDown, ChevronRight, Download, RefreshCw, X, FileText, TrendingUp, AlertTriangle, CheckCircle, BarChart3, Building2, Users } from 'lucide-react'
import { AnalyzedCompany } from '../lib/analysisService'
import ValuationModelsCard from './ValuationModelsCard'

interface AnalysisDetailViewProps {
  analysis: AnalyzedCompany
  onClose: () => void
  onReAnalyze: () => void
}

export const AnalysisDetailView: React.FC<AnalysisDetailViewProps> = ({
  analysis,
  onClose,
  onReAnalyze
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['financial_analysis']))

  const toggleSection = (sectionType: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionType)) {
      newExpanded.delete(sectionType)
    } else {
      newExpanded.add(sectionType)
    }
    setExpandedSections(newExpanded)
  }

  const getRecommendationBadge = (recommendation: string) => {
    const variants = {
      'Prioritera förvärv': 'default',
      'Fördjupa due diligence': 'secondary', 
      'Övervaka': 'outline',
      'Avstå': 'destructive'
    } as const
    
    return (
      <Badge variant={variants[recommendation as keyof typeof variants] || 'secondary'} className="text-sm">
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
      <Badge variant={variants[riskLevel as keyof typeof variants] || 'secondary'} className="text-sm">
        {riskLevel}
      </Badge>
    )
  }

  const getGradeBadge = (grade: string) => {
    const variants = {
      'A': 'default',
      'B': 'secondary',
      'C': 'outline',
      'D': 'destructive'
    } as const
    
    return (
      <Badge variant={variants[grade as keyof typeof variants] || 'secondary'} className="text-lg px-3 py-1">
        {grade}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log('Export PDF for analysis:', analysis.runId)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#2E2A2B] border-[#4A4A4A] text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center justify-between">
            <span>Analys: {analysis.companyName}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Detaljerad analys och värdering för {analysis.companyName}
          </DialogDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Company Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{analysis.companyName}</CardTitle>
                  <CardDescription>
                    Organisationsnummer: {analysis.orgnr}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  {getRiskBadge(analysis.riskLevel)}
                  {getRecommendationBadge(analysis.recommendation)}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Economic Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Ekonomisk sammanfattning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">
                {analysis.summary}
              </p>
            </CardContent>
          </Card>

          {/* Performance Grades */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-sm">FINANCIAL GRADE</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                {getGradeBadge(analysis.financialGrade)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-sm">COMMERCIAL GRADE</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                {getGradeBadge(analysis.commercialGrade)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-sm">OPERATIONAL GRADE</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                {getGradeBadge(analysis.operationalGrade)}
              </CardContent>
            </Card>
          </div>

          {/* Recommended Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Rekommenderade nästa steg</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysis.nextSteps?.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Narrative Sections */}
          <Card>
            <CardHeader>
              <CardTitle>Narrativa sektioner</CardTitle>
              <CardDescription>
                Expandera för SWOT, finansiell utsikt, integrationsmöjligheter och mer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.sections?.map((section, index) => (
                <div key={index} className="border border-gray-200 rounded-lg">
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 text-left hover:bg-gray-50"
                    onClick={() => toggleSection(section.section_type)}
                  >
                    <div className="flex items-center">
                      {expandedSections.has(section.section_type) ? (
                        <ChevronDown className="w-4 h-4 mr-2" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mr-2" />
                      )}
                      <span className="font-medium">{section.title}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        Förtroende {section.confidence}/5
                      </Badge>
                    </div>
                  </Button>
                  
                  {expandedSections.has(section.section_type) && (
                    <div className="px-4 pb-4 border-t border-gray-200">
                      <div className="pt-4">
                        <div className="text-gray-700 whitespace-pre-wrap mb-4">
                          {section.content_md}
                        </div>
                        
                        {section.supporting_metrics && section.supporting_metrics.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {section.supporting_metrics.map((metric, metricIndex) => (
                              <div key={metricIndex} className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-sm text-gray-600">{metric.metric_name}</div>
                                <div className="text-lg font-semibold text-gray-900">
                                  {metric.metric_value} {metric.metric_unit}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Nyckeltal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left text-gray-600 py-2">METRIK</th>
                      <th className="text-left text-gray-600 py-2">VÄRDE</th>
                      <th className="text-left text-gray-600 py-2">ÅR</th>
                      <th className="text-left text-gray-600 py-2">KÄLLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.metrics?.map((metric, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="text-gray-900 py-2">{metric.metric_name}</td>
                        <td className="text-gray-900 py-2">{metric.metric_value}</td>
                        <td className="text-gray-500 py-2">N/A</td>
                        <td className="text-gray-500 py-2">Analys</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Valuation Models */}
          <ValuationModelsCard 
            runId={analysis.runId}
            orgnr={analysis.orgnr}
            onModelSelect={(modelKey, valueType) => {
              console.log('Selected valuation model:', modelKey, valueType)
            }}
          />

          {/* Analysis Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Analysinformation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Analysdatum:</span>
                  <span className="text-gray-900 ml-2">{formatDate(analysis.analysisDate)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Modell:</span>
                  <span className="text-gray-900 ml-2">{analysis.modelVersion}</span>
                </div>
                <div>
                  <span className="text-gray-600">Screening Score:</span>
                  <span className="text-gray-900 ml-2">{analysis.screeningScore}/100</span>
                </div>
                <div>
                  <span className="text-gray-600">Förtroende:</span>
                  <span className="text-gray-900 ml-2">{analysis.confidence}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handleExportPDF}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportera PDF
            </Button>
            <Button
              variant="outline"
              onClick={onReAnalyze}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Analysera igen
            </Button>
            <Button
              onClick={onClose}
            >
              Stäng
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
