import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { FileText, Clock, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'

interface NarrativeCardProps {
  narrative: string
  executiveSummary?: string
}

export function NarrativeCard({ narrative, executiveSummary }: NarrativeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const estimateReadTime = (text: string) => {
    const wordsPerMinute = 200
    const wordCount = text.split(/\s+/).length
    const minutes = Math.ceil(wordCount / wordsPerMinute)
    return minutes
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(narrative)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const formatNarrative = (text: string) => {
    // Split into paragraphs and format
    return text.split('\n\n').map((paragraph, index) => (
      <p key={index} className="mb-4 last:mb-0 leading-relaxed">
        {paragraph.trim()}
      </p>
    ))
  }

  const shouldTruncate = narrative.length > 500
  const displayText = shouldTruncate && !isExpanded 
    ? `${narrative.substring(0, 500)}...` 
    : narrative

  const readTime = estimateReadTime(narrative)

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Djupanalys
              </CardTitle>
              <div className="flex items-center space-x-4 mt-1">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{readTime} min läsning</span>
                </div>
                <div className="text-sm text-gray-600">
                  {narrative.split(/\s+/).length} ord
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="h-8 px-3"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1 text-green-600" />
                  Kopierat
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Kopiera
                </>
              )}
            </Button>
            
            {shouldTruncate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 px-3"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Visa mindre
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Visa mer
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Executive Summary (if available and different from narrative) */}
        {executiveSummary && executiveSummary !== narrative && (
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              Sammanfattning
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              {executiveSummary}
            </p>
          </div>
        )}

        {/* Main Narrative */}
        <div className="prose prose-sm max-w-none">
          <div className="text-gray-800 leading-relaxed">
            {formatNarrative(displayText)}
          </div>
        </div>

        {/* Analysis Quality Indicators */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>AI-genererad analys</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Baserad på finansiell data</span>
              </div>
            </div>
            
            {shouldTruncate && (
              <div className="text-xs text-gray-500">
                {isExpanded ? 'Visa mindre' : `Visa resterande ${narrative.length - 500} tecken`}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
