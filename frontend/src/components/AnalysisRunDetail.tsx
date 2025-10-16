import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Separator } from './ui/separator'
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  Trash2,
  Eye,
  BarChart3,
  Target,
  Brain
} from 'lucide-react'
import { AnalysisRun } from '../lib/analysisRunsService'

interface AnalysisRunDetailProps {
  analysis: AnalysisRun & { selectedCompany?: any }
  onClose: () => void
  onReAnalyze: () => void
}

export const AnalysisRunDetail: React.FC<AnalysisRunDetailProps> = ({
  analysis,
  onClose,
  onReAnalyze
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      'completed': { 
        variant: 'default' as const, 
        icon: CheckCircle, 
        text: 'Slutförd',
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      },
      'running': { 
        variant: 'secondary' as const, 
        icon: Play, 
        text: 'Pågår',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      },
      'failed': { 
        variant: 'destructive' as const, 
        icon: XCircle, 
        text: 'Misslyckad',
        color: 'text-red-600',
        bgColor: 'bg-red-50'
      }
    }
    
    return configs[status as keyof typeof configs] || configs.completed
  }

  const getAnalysisModeConfig = (mode: string) => {
    const configs = {
      'screening': { 
        variant: 'outline' as const, 
        text: 'Screening',
        icon: Target,
        description: 'Snabb översikt av företag för att identifiera intressanta kandidater'
      },
      'deep': { 
        variant: 'default' as const, 
        text: 'Djupanalys',
        icon: Brain,
        description: 'Omfattande analys med detaljerade insikter och rekommendationer'
      }
    }
    
    return configs[mode as keyof typeof configs] || configs.screening
  }

  const statusConfig = getStatusConfig(analysis.status)
  const modeConfig = getAnalysisModeConfig(analysis.analysisMode)
  const StatusIcon = statusConfig.icon
  const ModeIcon = modeConfig.icon

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusConfig.bgColor}`}>
              <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
            </div>
            <div>
              <div className="text-xl font-semibold">Analysdetaljer</div>
              <div className="text-sm font-normal text-gray-500">
                {formatDate(analysis.startedAt)}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ModeIcon className="w-5 h-5" />
                  Analysinformation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Typ:</span>
                  <Badge variant={modeConfig.variant}>{modeConfig.text}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.text}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Modell:</span>
                  <span className="text-sm text-gray-900">{analysis.modelVersion}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Antal företag:</span>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{analysis.companyCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Tidsinformation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Startad:</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{formatDate(analysis.startedAt)}</span>
                  </div>
                </div>
                {analysis.completedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Slutförd:</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-900">{formatDate(analysis.completedAt)}</span>
                    </div>
                  </div>
                )}
                {analysis.completedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Varaktighet:</span>
                    <span className="text-sm text-gray-900">
                      {Math.round((new Date(analysis.completedAt).getTime() - new Date(analysis.startedAt).getTime()) / 1000 / 60)} min
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Initierad av:</span>
                  <span className="text-sm text-gray-900">{analysis.initiatedBy || 'Okänd'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Focus */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Analysfokus
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.templateName ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default">Mall</Badge>
                    <span className="font-medium text-gray-900">{analysis.templateName}</span>
                  </div>
                  <p className="text-sm text-gray-600">{modeConfig.description}</p>
                </div>
              ) : analysis.customInstructions ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Anpassad</Badge>
                    <span className="font-medium text-gray-900">Anpassade instruktioner</span>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                    {analysis.customInstructions}
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">Ingen specifik analysfokus angiven</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Companies List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Analyserade företag ({analysis.companyCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {analysis.companies.map((company) => (
                  <div 
                    key={company.orgnr} 
                    className={`p-3 rounded-lg border transition-colors ${
                      analysis.selectedCompany?.orgnr === company.orgnr 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{company.name}</h4>
                        <p className="text-sm text-gray-500">{company.orgnr}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 p-1"
                        onClick={() => {
                          // Navigate to individual company analysis
                          window.location.href = `/dashboard?page=ai-insights&company=${encodeURIComponent(company.orgnr)}`
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Statistics */}
          {analysis.status === 'completed' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Sammanfattning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{analysis.companyCount}</div>
                    <div className="text-sm text-gray-600">Företag analyserade</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {analysis.analysisMode === 'screening' ? 'Screening' : 'Djupanalys'}
                    </div>
                    <div className="text-sm text-gray-600">Analystyp</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{analysis.modelVersion}</div>
                    <div className="text-sm text-gray-600">AI-modell</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {analysis.completedAt ? 
                        Math.round((new Date(analysis.completedAt).getTime() - new Date(analysis.startedAt).getTime()) / 1000 / 60) 
                        : 'N/A'
                      }
                    </div>
                    <div className="text-sm text-gray-600">Minuter</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onReAnalyze}
                disabled={analysis.status === 'running'}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {analysis.status === 'running' ? 'Pågår...' : 'Kör om analys'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Export functionality could be added here
                  alert('Exportfunktion kommer snart')
                }}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Exportera
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (window.confirm('Är du säker på att du vill ta bort denna analys?')) {
                    // Delete functionality would be implemented here
                    alert('Borttagning kommer snart')
                  }
                }}
                className="flex items-center gap-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
              >
                <Trash2 className="w-4 h-4" />
                Ta bort
              </Button>
              <Button onClick={onClose}>
                Stäng
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
