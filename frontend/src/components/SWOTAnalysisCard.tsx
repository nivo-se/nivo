import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react'

interface SWOTAnalysisCardProps {
  company: {
    companyName: string
    strengths?: string[] | null
    weaknesses?: string[] | null
    opportunities?: string[] | null
    risks?: string[] | null
  }
}

export const SWOTAnalysisCard: React.FC<SWOTAnalysisCardProps> = ({ company }) => {
  const swotSections = [
    {
      title: 'Styrkor',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      items: company.strengths || ['Inga styrkor identifierade ännu']
    },
    {
      title: 'Svagheter',
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      items: company.weaknesses || ['Inga svagheter identifierade ännu']
    },
    {
      title: 'Möjligheter',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      items: company.opportunities || ['Inga möjligheter identifierade ännu']
    },
    {
      title: 'Risker',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      items: company.risks || ['Inga risker identifierade ännu']
    }
  ]

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <XCircle className="h-4 w-4 text-red-600" />
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </div>
          SWOT-analys
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {swotSections.map((section, index) => {
            const IconComponent = section.icon
            return (
              <div
                key={index}
                className={`p-4 rounded-lg border ${section.bgColor} ${section.borderColor}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <IconComponent className={`h-4 w-4 ${section.color}`} />
                  <h4 className="font-semibold text-gray-800">{section.title}</h4>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {section.items.length}
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="text-sm text-gray-700 leading-relaxed flex items-start gap-2"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${section.color.replace('text-', 'bg-')}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
