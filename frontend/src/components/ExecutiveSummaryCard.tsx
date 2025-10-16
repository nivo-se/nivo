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
        return 'bg-green-100 text-green-800 border-green-200'
      case 'medel':
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'låg':
      case 'low':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getFinancialHealthColor = (score?: number | null) => {
    if (!score) return 'text-gray-500'
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getGrowthPotentialIcon = (potential?: string | null) => {
    switch (potential?.toLowerCase()) {
      case 'hög':
      case 'high':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'medel':
      case 'medium':
        return <Target className="h-4 w-4 text-yellow-600" />
      case 'låg':
      case 'low':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Target className="h-4 w-4 text-gray-500" />
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
              i < stars ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-xs text-gray-600 ml-1">({confidence.toFixed(1)}/5)</span>
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
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
          <p className="text-gray-700 leading-relaxed">
            {company.executiveSummary || 
              'Ingen executive summary tillgänglig för denna analys. Sammanfattningen kommer att visas här när djupanalysen är klar.'}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Finansiell Hälsa</span>
              <span className={`text-sm font-semibold ${getFinancialHealthColor(company.financialHealth)}`}>
                {company.financialHealth ? `${company.financialHealth}/10` : 'Ej bedömd'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Tillväxtpotential</span>
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
              <span className="text-sm font-medium text-gray-600">Marknadsposition</span>
              <span className="text-sm font-medium">
                {company.marketPosition || 'Ej bedömd'}
              </span>
            </div>
            
            {company.targetPrice && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Målpris</span>
                <span className="text-sm font-semibold text-blue-600">
                  {company.targetPrice.toLocaleString('sv-SE')} MSEK
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Confidence Rating */}
        {company.confidence && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm font-medium text-gray-600">Analyskvalitet</span>
            {getConfidenceStars(company.confidence)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
