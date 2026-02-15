import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { CheckCircle, AlertCircle, Info, TrendingUp, TrendingDown } from 'lucide-react'

interface KeyFindingsCardProps {
  company: {
    companyName: string
    keyFindings?: string[] | null
  }
}

export const KeyFindingsCard: React.FC<KeyFindingsCardProps> = ({ company }) => {
  const getFindingIcon = (finding: string) => {
    const lowerFinding = finding.toLowerCase()
    
    if (lowerFinding.includes('styrka') || lowerFinding.includes('positiv') || 
        lowerFinding.includes('bra') || lowerFinding.includes('hög') ||
        lowerFinding.includes('tillväxt') || lowerFinding.includes('förbättring')) {
      return <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
    }
    
    if (lowerFinding.includes('risk') || lowerFinding.includes('negativ') || 
        lowerFinding.includes('problem') || lowerFinding.includes('låg') ||
        lowerFinding.includes('brist') || lowerFinding.includes('utmaning')) {
      return <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
    }
    
    if (lowerFinding.includes('trend') || lowerFinding.includes('förändring') ||
        lowerFinding.includes('utveckling') || lowerFinding.includes('möjlighet')) {
      return <TrendingUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
    }
    
    return <Info className="h-4 w-4 text-gray-600 flex-shrink-0" />
  }

  const getFindingColor = (finding: string) => {
    const lowerFinding = finding.toLowerCase()
    
    if (lowerFinding.includes('styrka') || lowerFinding.includes('positiv') || 
        lowerFinding.includes('bra') || lowerFinding.includes('hög') ||
        lowerFinding.includes('tillväxt') || lowerFinding.includes('förbättring')) {
      return 'border-l-green-500 bg-green-50'
    }
    
    if (lowerFinding.includes('risk') || lowerFinding.includes('negativ') || 
        lowerFinding.includes('problem') || lowerFinding.includes('låg') ||
        lowerFinding.includes('brist') || lowerFinding.includes('utmaning')) {
      return 'border-l-red-500 bg-red-50'
    }
    
    return 'border-l-blue-500 bg-blue-50'
  }

  const findings = company.keyFindings || [
    'Inga nyckelfynd tillgängliga för denna analys.',
    'Detaljerade fynd kommer att visas här när djupanalysen är klar.',
    'Analysen inkluderar finansiell hälsa, marknadsposition och tillväxtpotential.'
  ]

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600" />
          Nyckelfynd
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {findings.map((finding, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${getFindingColor(finding)}`}
            >
              {getFindingIcon(finding)}
              <p className="text-sm text-gray-700 leading-relaxed flex-1">
                {finding}
              </p>
            </div>
          ))}
        </div>
        
        {findings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Inga nyckelfynd tillgängliga</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
