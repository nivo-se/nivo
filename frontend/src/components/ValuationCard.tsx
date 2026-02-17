import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Target, TrendingUp, Shield, Star, DollarSign } from 'lucide-react'

interface ValuationCardProps {
  company: {
    companyName: string
    targetPrice?: number | null
    acquisitionInterest?: string | null
    financialHealth?: number | null
    growthPotential?: string | null
    marketPosition?: string | null
    confidence?: number | null
  }
}

export const ValuationCard: React.FC<ValuationCardProps> = ({ company }) => {
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

  const getGrowthPotentialColor = (potential?: string | null) => {
    switch (potential?.toLowerCase()) {
      case 'hög':
      case 'high':
        return 'text-primary'
      case 'medel':
      case 'medium':
        return 'text-foreground'
      case 'låg':
      case 'low':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  const getFinancialHealthColor = (score?: number | null) => {
    if (!score) return 'text-muted-foreground'
    if (score >= 8) return 'text-primary'
    if (score >= 6) return 'text-foreground'
    return 'text-destructive'
  }

  const getConfidenceStars = (confidence?: number | null) => {
    if (!confidence) return null
    const stars = Math.round((confidence / 5) * 5)
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
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Värdering & Förvärvsintresse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Price */}
        {company.targetPrice && (
          <div className="text-center p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-primary/40">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Målpris</span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {company.targetPrice.toLocaleString('sv-SE')} MSEK
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Baserat på finansiell analys och marknadsjämförelser
            </p>
          </div>
        )}

        {/* Acquisition Interest */}
        <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-medium text-foreground">Förvärvsintresse</span>
          </div>
          <Badge className={getAcquisitionInterestColor(company.acquisitionInterest)}>
            {company.acquisitionInterest || 'Ej bedömd'}
          </Badge>
        </div>

        {/* Supporting Factors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Tillväxtpotential</span>
            </div>
            <div className={`text-lg font-semibold ${getGrowthPotentialColor(company.growthPotential)}`}>
              {company.growthPotential || 'Ej bedömd'}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Finansiell Hälsa</span>
            </div>
            <div className={`text-lg font-semibold ${getFinancialHealthColor(company.financialHealth)}`}>
              {company.financialHealth ? `${company.financialHealth}/10` : 'Ej bedömd'}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Marknadsposition</span>
            </div>
            <div className="text-lg font-semibold text-foreground">
              {company.marketPosition || 'Ej bedömd'}
            </div>
          </div>
        </div>

        {/* Confidence Rating */}
        {company.confidence && (
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/40">
            <span className="text-sm font-medium text-foreground">Analyskvalitet</span>
            {getConfidenceStars(company.confidence)}
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-muted/40 rounded-lg">
          <h4 className="font-medium text-foreground mb-2">Sammanfattning</h4>
          <p className="text-sm text-muted-foreground">
            {company.targetPrice ? 
              `Företaget har ett beräknat målpris på ${company.targetPrice.toLocaleString('sv-SE')} MSEK med ${company.acquisitionInterest?.toLowerCase() || 'medel'} förvärvsintresse.` :
              'Värderingsanalys pågår. Målpris och förvärvsintresse kommer att visas när analysen är klar.'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
