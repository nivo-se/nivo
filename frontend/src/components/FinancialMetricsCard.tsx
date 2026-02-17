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
    if (!grade) return 'text-muted-foreground'
    switch (grade.toUpperCase()) {
      case 'A':
        return 'text-primary'
      case 'B':
        return 'text-primary'
      case 'C':
        return 'text-foreground'
      case 'D':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  const getGradeIcon = (grade?: string | null) => {
    if (!grade) return <Minus className="h-4 w-4 text-muted-foreground" />
    switch (grade.toUpperCase()) {
      case 'A':
        return <TrendingUp className="h-4 w-4 text-primary" />
      case 'B':
        return <TrendingUp className="h-4 w-4 text-primary" />
      case 'C':
        return <Minus className="h-4 w-4 text-foreground" />
      case 'D':
        return <TrendingDown className="h-4 w-4 text-destructive" />
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getRiskColor = (score?: number | null) => {
    if (!score) return 'text-muted-foreground'
    if (score <= 2) return 'text-primary'
    if (score <= 3) return 'text-foreground'
    return 'text-destructive'
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
        <TrendingDown className="h-4 w-4 text-destructive" /> : 
        <TrendingUp className="h-4 w-4 text-primary" />,
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
              className="p-4 border rounded-lg bg-muted/40 hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {metric.icon}
                  <span className="font-medium text-foreground">{metric.label}</span>
                </div>
                <span className={`font-semibold ${metric.color}`}>
                  {metric.value}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {metric.description}
              </p>
            </div>
          ))}
        </div>

        {/* Confidence Score */}
        {company.confidence && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Analyskvalitet</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(company.confidence / 5) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-primary">
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
