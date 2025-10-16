import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'

interface FinancialMetricsCardProps {
  company: {
    companyName: string
    financialGrade?: string | null
    commercialGrade?: string | null
    operationalGrade?: string | null
    riskScore?: number | null
    confidence?: number | null
  }
}

export const FinancialMetricsCard: React.FC<FinancialMetricsCardProps> = ({ company }) => {
  const getGradeColor = (grade?: string | null) => {
    if (!grade) return 'text-gray-500'
    switch (grade.toUpperCase()) {
      case 'A':
        return 'text-green-600'
      case 'B':
        return 'text-blue-600'
      case 'C':
        return 'text-yellow-600'
      case 'D':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  const getGradeIcon = (grade?: string | null) => {
    if (!grade) return <Minus className="h-4 w-4 text-gray-400" />
    switch (grade.toUpperCase()) {
      case 'A':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'B':
        return <TrendingUp className="h-4 w-4 text-blue-600" />
      case 'C':
        return <Minus className="h-4 w-4 text-yellow-600" />
      case 'D':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getRiskColor = (score?: number | null) => {
    if (!score) return 'text-gray-500'
    if (score <= 2) return 'text-green-600'
    if (score <= 3) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRiskLabel = (score?: number | null) => {
    if (!score) return 'Ej bedömd'
    if (score <= 2) return 'Låg risk'
    if (score <= 3) return 'Medel risk'
    return 'Hög risk'
  }

  const metrics = [
    {
      label: 'Finansiell Betyg',
      value: company.financialGrade || 'Ej bedömd',
      icon: getGradeIcon(company.financialGrade),
      color: getGradeColor(company.financialGrade),
      description: 'Bedömning av finansiell stabilitet och lönsamhet'
    },
    {
      label: 'Kommersiell Betyg',
      value: company.commercialGrade || 'Ej bedömd',
      icon: getGradeIcon(company.commercialGrade),
      color: getGradeColor(company.commercialGrade),
      description: 'Bedömning av marknadsposition och konkurrenskraft'
    },
    {
      label: 'Operativ Betyg',
      value: company.operationalGrade || 'Ej bedömd',
      icon: getGradeIcon(company.operationalGrade),
      color: getGradeColor(company.operationalGrade),
      description: 'Bedömning av operativ effektivitet och processer'
    },
    {
      label: 'Riskbedömning',
      value: company.riskScore ? `${company.riskScore}/5` : 'Ej bedömd',
      icon: company.riskScore && company.riskScore > 3 ? 
        <TrendingDown className="h-4 w-4 text-red-600" /> : 
        <TrendingUp className="h-4 w-4 text-green-600" />,
      color: getRiskColor(company.riskScore),
      description: getRiskLabel(company.riskScore)
    }
  ]

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Finansiella Nyckeltal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {metric.icon}
                  <span className="font-medium text-gray-700">{metric.label}</span>
                </div>
                <span className={`font-semibold ${metric.color}`}>
                  {metric.value}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {metric.description}
              </p>
            </div>
          ))}
        </div>

        {/* Confidence Score */}
        {company.confidence && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Analyskvalitet</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(company.confidence / 5) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-blue-600">
                  {(company.confidence / 5 * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
