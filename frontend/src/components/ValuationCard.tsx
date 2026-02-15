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

  const getGrowthPotentialColor = (potential?: string | null) => {
    switch (potential?.toLowerCase()) {
      case 'hög':
      case 'high':
        return 'text-green-600'
      case 'medel':
      case 'medium':
        return 'text-yellow-600'
      case 'låg':
      case 'low':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  const getFinancialHealthColor = (score?: number | null) => {
    if (!score) return 'text-gray-500'
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
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
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-green-600" />
          Värdering & Förvärvsintresse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Price */}
        {company.targetPrice && (
          <div className="text-center p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-6 w-6 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Målpris</span>
            </div>
            <div className="text-3xl font-bold text-green-600">
              {company.targetPrice.toLocaleString('sv-SE')} MSEK
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Baserat på finansiell analys och marknadsjämförelser
            </p>
          </div>
        )}

        {/* Acquisition Interest */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-700">Förvärvsintresse</span>
          </div>
          <Badge className={getAcquisitionInterestColor(company.acquisitionInterest)}>
            {company.acquisitionInterest || 'Ej bedömd'}
          </Badge>
        </div>

        {/* Supporting Factors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Tillväxtpotential</span>
            </div>
            <div className={`text-lg font-semibold ${getGrowthPotentialColor(company.growthPotential)}`}>
              {company.growthPotential || 'Ej bedömd'}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Finansiell Hälsa</span>
            </div>
            <div className={`text-lg font-semibold ${getFinancialHealthColor(company.financialHealth)}`}>
              {company.financialHealth ? `${company.financialHealth}/10` : 'Ej bedömd'}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Marknadsposition</span>
            </div>
            <div className="text-lg font-semibold text-gray-800">
              {company.marketPosition || 'Ej bedömd'}
            </div>
          </div>
        </div>

        {/* Confidence Rating */}
        {company.confidence && (
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm font-medium text-gray-700">Analyskvalitet</span>
            {getConfidenceStars(company.confidence)}
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">Sammanfattning</h4>
          <p className="text-sm text-gray-600">
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
