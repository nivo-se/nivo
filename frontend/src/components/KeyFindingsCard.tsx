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
      return <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
    }
    
    if (lowerFinding.includes('risk') || lowerFinding.includes('negativ') || 
        lowerFinding.includes('problem') || lowerFinding.includes('låg') ||
        lowerFinding.includes('brist') || lowerFinding.includes('utmaning')) {
      return <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
    }
    
    if (lowerFinding.includes('trend') || lowerFinding.includes('förändring') ||
        lowerFinding.includes('utveckling') || lowerFinding.includes('möjlighet')) {
      return <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
    }
    
    return <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  }

  const getFindingColor = (finding: string) => {
    const lowerFinding = finding.toLowerCase()
    
    if (lowerFinding.includes('styrka') || lowerFinding.includes('positiv') || 
        lowerFinding.includes('bra') || lowerFinding.includes('hög') ||
        lowerFinding.includes('tillväxt') || lowerFinding.includes('förbättring')) {
      return 'border-l-green-500 bg-primary/10'
    }
    
    if (lowerFinding.includes('risk') || lowerFinding.includes('negativ') || 
        lowerFinding.includes('problem') || lowerFinding.includes('låg') ||
        lowerFinding.includes('brist') || lowerFinding.includes('utmaning')) {
      return 'border-l-red-500 bg-destructive/10'
    }
    
    return 'border-l-blue-500 bg-primary/10'
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
          <Info className="h-5 w-5 text-primary" />
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
              <p className="text-sm text-foreground leading-relaxed flex-1">
                {finding}
              </p>
            </div>
          ))}
        </div>
        
        {findings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm">Inga nyckelfynd tillgängliga</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
