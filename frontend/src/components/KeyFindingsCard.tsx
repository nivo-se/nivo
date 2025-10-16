import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle, Info, TrendingUp, TrendingDown } from 'lucide-react'

interface KeyFindingsCardProps {
  keyFindings: string[]
}

export function KeyFindingsCard({ keyFindings }: KeyFindingsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  const getFindingIcon = (finding: string, index: number) => {
    const text = finding.toLowerCase()
    
    // Positive indicators
    if (text.includes('tillväxt') || text.includes('stark') || text.includes('hög') || 
        text.includes('förbättring') || text.includes('positiv') || text.includes('bra')) {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    }
    
    // Negative indicators
    if (text.includes('risk') || text.includes('låg') || text.includes('svag') || 
        text.includes('negativ') || text.includes('problem') || text.includes('utmaning')) {
      return <TrendingDown className="h-4 w-4 text-red-600" />
    }
    
    // Warning indicators
    if (text.includes('varning') || text.includes('uppmärksamhet') || text.includes('försiktig')) {
      return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
    
    // Default info icon
    return <Info className="h-4 w-4 text-blue-600" />
  }

  const getFindingColor = (finding: string) => {
    const text = finding.toLowerCase()
    
    if (text.includes('tillväxt') || text.includes('stark') || text.includes('hög') || 
        text.includes('förbättring') || text.includes('positiv') || text.includes('bra')) {
      return 'border-l-green-500 bg-green-50'
    }
    
    if (text.includes('risk') || text.includes('låg') || text.includes('svag') || 
        text.includes('negativ') || text.includes('problem') || text.includes('utmaning')) {
      return 'border-l-red-500 bg-red-50'
    }
    
    if (text.includes('varning') || text.includes('uppmärksamhet') || text.includes('försiktig')) {
      return 'border-l-yellow-500 bg-yellow-50'
    }
    
    return 'border-l-blue-500 bg-blue-50'
  }

  const toggleItemExpansion = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  const displayedFindings = isExpanded ? keyFindings : keyFindings.slice(0, 3)
  const hasMoreFindings = keyFindings.length > 3

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Nyckelobservationer
          </CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {keyFindings.length} observationer
            </span>
            {hasMoreFindings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 px-2"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Visa färre
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Visa alla
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {displayedFindings.map((finding, index) => {
          const isItemExpanded = expandedItems.has(index)
          const shouldTruncate = finding.length > 120 && !isItemExpanded
          const displayText = shouldTruncate ? `${finding.substring(0, 120)}...` : finding
          
          return (
            <div
              key={index}
              className={`border-l-4 rounded-r-lg p-4 transition-all duration-200 hover:shadow-sm ${getFindingColor(finding)}`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getFindingIcon(finding, index)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {displayText}
                  </p>
                  {finding.length > 120 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleItemExpansion(index)}
                      className="mt-2 h-6 px-2 text-xs text-gray-600 hover:text-gray-800"
                    >
                      {isItemExpanded ? 'Visa mindre' : 'Visa mer'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        
        {keyFindings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>Inga nyckelobservationer tillgängliga</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
