import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Clock, FileText } from 'lucide-react'

interface NarrativeCardProps {
  company: {
    companyName: string
    narrative?: string | null
  }
}

export const NarrativeCard: React.FC<NarrativeCardProps> = ({ company }) => {
  const estimateReadTime = (text: string) => {
    const wordsPerMinute = 200
    const wordCount = text.split(/\s+/).length
    const minutes = Math.ceil(wordCount / wordsPerMinute)
    return minutes
  }

  const narrative = company.narrative || 
    'Ingen detaljerad analys tillgänglig för denna analys. Den fullständiga narrativa analysen kommer att visas här när djupanalysen är klar. Denna analys inkluderar en djupgående bedömning av företagets finansiella hälsa, marknadsposition, tillväxtpotential och förvärvsattraktivitet.'

  const readTime = estimateReadTime(narrative)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Detaljerad Analys
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            {readTime} min läsning
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none">
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {narrative}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
