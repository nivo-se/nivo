import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Loader2, RefreshCw, AlertCircle, TrendingUp, Target, MessageSquare, Sparkles } from 'lucide-react'
import { intelligenceService, type AIReport } from '../lib/intelligenceService'

interface AIDeepDivePanelProps {
  orgnr: string
  companyName?: string
}

export const AIDeepDivePanel: React.FC<AIDeepDivePanelProps> = ({ orgnr, companyName }) => {
  const queryClient = useQueryClient()
  const [isGenerating, setIsGenerating] = useState(false)

  // Fetch AI report
  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-report', orgnr],
    queryFn: () => intelligenceService.getAIReport(orgnr),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Generate report mutation - backend returns full report directly (cache-first)
  const generateMutation = useMutation({
    mutationFn: (forceRegenerate: boolean) => intelligenceService.generateAIReport(orgnr, forceRegenerate),
    onSuccess: (response) => {
      // Backend returns full report; update cache immediately, no polling needed
      if (response?.business_model != null || (response?.weaknesses?.length ?? 0) > 0 || (response?.uplift_ops?.length ?? 0) > 0) {
        queryClient.setQueryData(['ai-report', orgnr], response)
        setIsGenerating(false)
        return
      }
      // Fallback: poll if backend returned status-only (legacy)
      setIsGenerating(true)
      const pollInterval = setInterval(() => {
        refetch().then((result) => {
          if (result.data && result.data.business_model) {
            setIsGenerating(false)
            clearInterval(pollInterval)
            queryClient.invalidateQueries({ queryKey: ['ai-report', orgnr] })
          }
        })
      }, 2000)
      setTimeout(() => {
        clearInterval(pollInterval)
        setIsGenerating(false)
      }, 60000)
    },
  })

  const handleGenerate = (forceRegenerate: boolean = false) => {
    generateMutation.mutate(forceRegenerate)
  }

  const getImpactColor = (range: string | null | undefined) => {
    switch (range) {
      case 'High':
        return 'bg-primary/15 text-primary border-primary/50'
      case 'Medium':
        return 'bg-accent text-foreground border-accent'
      case 'Low':
        return 'bg-primary/15 text-primary border-primary/50'
      default:
        return 'bg-muted text-foreground border-border'
    }
  }

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'Low':
        return 'bg-primary/15 text-primary'
      case 'Medium':
        return 'bg-accent text-foreground'
      case 'High':
        return 'bg-destructive/15 text-destructive'
      default:
        return 'bg-muted text-foreground'
    }
  }

  if (isLoading || isGenerating) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">
              {isGenerating ? 'Generating AI report...' : 'Loading AI report...'}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">
            Error loading AI report: {error.message}
          </div>
          <div className="mt-4 text-center">
            <Button onClick={() => handleGenerate(false)} variant="outline">
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!report || !report.business_model) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Deep Dive Analysis</CardTitle>
          <CardDescription>
            Generate comprehensive AI analysis for {companyName || 'this company'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              No AI report available yet. Generate one to see business model analysis, weaknesses, and uplift opportunities.
            </p>
            <Button onClick={() => handleGenerate(false)} size="lg">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate AI Report
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Deep Dive Analysis</CardTitle>
              <CardDescription>
                Comprehensive analysis for {companyName || 'company'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(true)}
              disabled={generateMutation.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Business Model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Business Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.business_model}</p>
        </CardContent>
      </Card>

      {/* Weaknesses */}
      {report.weaknesses && report.weaknesses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-foreground" />
              Key Weaknesses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.weaknesses.map((weakness, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-foreground mt-1">•</span>
                  <span className="text-sm">{weakness}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Uplift Opportunities */}
      {report.uplift_ops && report.uplift_ops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Operational Uplift Opportunities
            </CardTitle>
            {report.impact_range && (
              <CardDescription>
                Overall Impact Range:{' '}
                <Badge className={getImpactColor(report.impact_range)}>
                  {report.impact_range}
                </Badge>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.uplift_ops.map((lever, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{lever.name}</h4>
                    <div className="flex gap-2">
                      {lever.effort && (
                        <Badge variant="outline" className={getEffortColor(lever.effort)}>
                          {lever.effort} Effort
                        </Badge>
                      )}
                      {lever.category && (
                        <Badge variant="outline">{lever.category}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{lever.impact}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outreach Angle */}
      {report.outreach_angle && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Founder Outreach Angle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap italic border-l-4 border-primary pl-4">
              {report.outreach_angle}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

