import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { TrendingUp, TrendingDown, Target, Shield, Star } from 'lucide-react'

interface ExecutiveSummaryCardProps {
  company: {
    companyName: string
    executiveSummary?: string | null
    acquisitionInterest?: string | null
    financialHealth?: number | null
    growthPotential?: string | null
    marketPosition?: string | null
    targetPrice?: number | null
    confidence?: number | null
  }
}

export const ExecutiveSummaryCard: React.FC<ExecutiveSummaryCardProps> = ({ company }) => {
  const getAcquisitionInterestColor = (interest?: string | null) => {
    switch (interest?.toLowerCase()) {
      case 'hög':
      case 'high':
        return 'bg-primary/15 text-primary border-primary/40'
      case 'medel':
      case 'medium':
        return 'bg-accent text-foreground border-accent'
      case 'låg':
      case 'low':
        return 'bg-destructive/15 text-destructive border-destructive/40'
      default:
        return 'bg-muted text-foreground border-border'
    }
  }

  const getFinancialHealthColor = (score?: number | null) => {
    if (!score) return 'text-muted-foreground'
    if (score >= 8) return 'text-primary'
    if (score >= 6) return 'text-foreground'
    return 'text-destructive'
  }

  const getGrowthPotentialIcon = (potential?: string | null) => {
    switch (potential?.toLowerCase()) {
      case 'hög':
      case 'high':
        return <TrendingUp className="h-4 w-4 text-primary" />
      case 'medel':
      case 'medium':
        return <Target className="h-4 w-4 text-foreground" />
      case 'låg':
      case 'low':
        return <TrendingDown className="h-4 w-4 text-destructive" />
      default:
        return <Target className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getConfidenceStars = (confidence?: number | null) => {
    if (!confidence) return null
    const stars = Math.round((confidence / 5) * 5) // Convert 1-5 scale to stars
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < stars ? 'text-primary fill-current' : 'text-muted-foreground'
            }`}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">({confidence.toFixed(1)}/5)</span>
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Executive Summary
          </span>
          <Badge className={getAcquisitionInterestColor(company.acquisitionInterest)}>
            {company.acquisitionInterest || 'Ej bedömd'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Executive Summary Text */}
        <div className="prose prose-sm max-w-none">
          <p className="text-foreground leading-relaxed">
            {company.executiveSummary || 
              'Ingen executive summary tillgänglig för denna analys. Sammanfattningen kommer att visas här när djupanalysen är klar.'}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Finansiell Hälsa</span>
              <span className={`text-sm font-semibold ${getFinancialHealthColor(company.financialHealth)}`}>
                {company.financialHealth ? `${company.financialHealth}/10` : 'Ej bedömd'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Tillväxtpotential</span>
              <div className="flex items-center gap-1">
                {getGrowthPotentialIcon(company.growthPotential)}
                <span className="text-sm font-medium">
                  {company.growthPotential || 'Ej bedömd'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Marknadsposition</span>
              <span className="text-sm font-medium">
                {company.marketPosition || 'Ej bedömd'}
              </span>
            </div>
            
            {company.targetPrice && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Målpris</span>
                <span className="text-sm font-semibold text-primary">
                  {company.targetPrice.toLocaleString('sv-SE')} MSEK
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Confidence Rating */}
        {company.confidence && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm font-medium text-muted-foreground">Analyskvalitet</span>
            {getConfidenceStars(company.confidence)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
