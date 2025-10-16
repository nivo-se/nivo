import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { TrendingUp, Minus, Target, Building2, BarChart3, Compass } from 'lucide-react'

interface ExecutiveSummaryCardProps {
  companyName: string
  orgnr: string
  executiveSummary: string
  financialHealth: number
  acquisitionInterest: string
  marketPosition: string
  recommendation: string
  confidence: number
}

export function ExecutiveSummaryCard({
  companyName,
  orgnr,
  executiveSummary,
  financialHealth,
  acquisitionInterest,
  marketPosition,
  recommendation,
  confidence
}: ExecutiveSummaryCardProps) {
  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'Prioritera förvärv': return 'bg-green-100 text-green-800 border-green-200'
      case 'Fördjupa due diligence': return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'Övervaka': return 'bg-yellow-50 text-yellow-700 border-yellow-100'
      case 'Avstå': return 'bg-red-50 text-red-700 border-red-100'
      default: return 'bg-gray-50 text-gray-700 border-gray-100'
    }
  }

  const getAcquisitionInterestColor = (interest: string) => {
    switch (interest) {
      case 'Hög': return 'bg-green-100 text-green-800'
      case 'Medel': return 'bg-yellow-100 text-yellow-800'
      case 'Låg': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getFinancialHealthColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    if (score >= 4) return 'text-orange-600'
    return 'text-red-600'
  }

  const getMarketPositionIcon = (position: string) => {
    switch (position) {
      case 'Marknadsledare': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'Utmanare': return <TrendingUp className="h-4 w-4 text-blue-600" />
      case 'Följare': return <Minus className="h-4 w-4 text-yellow-600" />
      case 'Nischaktör': return <Target className="h-4 w-4 text-purple-600" />
      default: return <Building2 className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">
              {companyName}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">Org.nr: {orgnr}</p>
          </div>
          <Badge className={`px-3 py-1 text-sm font-medium border ${getRecommendationColor(recommendation)}`}>
            {recommendation}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Executive Summary */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Sammanfattning</h3>
          <p className="text-gray-700 leading-relaxed">{executiveSummary}</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Financial Health */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-500">Finansiell hälsa</span>
            </div>
            <div className={`text-2xl font-bold ${getFinancialHealthColor(financialHealth)}`}>
              {financialHealth}/10
            </div>
          </div>

          {/* Acquisition Interest */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-500">Förvärvsintresse</span>
            </div>
            <Badge className={getAcquisitionInterestColor(acquisitionInterest)}>
              {acquisitionInterest}
            </Badge>
          </div>

          {/* Market Position */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              {getMarketPositionIcon(marketPosition)}
              <span className="text-xs text-gray-500">Marknadsposition</span>
            </div>
            <div className="text-sm font-medium text-gray-900">
              {marketPosition}
            </div>
          </div>

          {/* Strategic Focus */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Compass className="h-5 w-5 text-gray-600" />
              <span className="text-xs text-gray-500">Strategiskt fokus</span>
            </div>
            <p className="text-sm text-gray-700 leading-snug">
              {recommendation === 'Prioritera förvärv'
                ? 'Rekommenderad att prioriteras för nästa förvärvsetapp.'
                : recommendation === 'Fördjupa due diligence'
                ? 'Behöver fördjupad analys och fortsatta dialoger.'
                : recommendation === 'Övervaka'
                ? 'Behåll på bevakningslistan för framtida möjligheter.'
                : 'Rekommenderas att avstå i nuläget.'}
            </p>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">Analysens tillförlitlighet</span>
          <div className="flex items-center space-x-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-900">{confidence}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
