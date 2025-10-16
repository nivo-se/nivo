import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { CheckCircle, AlertTriangle, Lightbulb, Shield, Plus, Minus } from 'lucide-react'

interface SWOTAnalysisCardProps {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  risks: string[]
}

export function SWOTAnalysisCard({ 
  strengths, 
  weaknesses, 
  opportunities, 
  risks 
}: SWOTAnalysisCardProps) {
  const SWOTItem = ({ 
    item, 
    type, 
    index 
  }: { 
    item: string
    type: 'strength' | 'weakness' | 'opportunity' | 'risk'
    index: number 
  }) => {
    const getIcon = () => {
      switch (type) {
        case 'strength': return <CheckCircle className="h-4 w-4 text-green-600" />
        case 'weakness': return <Minus className="h-4 w-4 text-red-600" />
        case 'opportunity': return <Lightbulb className="h-4 w-4 text-blue-600" />
        case 'risk': return <Shield className="h-4 w-4 text-orange-600" />
      }
    }

    return (
      <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-gray-50 transition-colors">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <span className="text-sm text-gray-700 leading-relaxed">{item}</span>
      </div>
    )
  }

  const SWOTQuadrant = ({ 
    title, 
    items, 
    type, 
    color, 
    icon 
  }: { 
    title: string
    items: string[]
    type: 'strength' | 'weakness' | 'opportunity' | 'risk'
    color: string
    icon: React.ReactNode
  }) => (
    <div className={`${color} rounded-lg p-4 h-full`}>
      <div className="flex items-center space-x-2 mb-3">
        {icon}
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <Badge variant="secondary" className="ml-auto">
          {items.length}
        </Badge>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {items.length > 0 ? (
          items.map((item, index) => (
            <SWOTItem key={index} item={item} type={type} index={index} />
          ))
        ) : (
          <p className="text-sm text-gray-500 italic">Inga {title.toLowerCase()} identifierade</p>
        )}
      </div>
    </div>
  )

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <span>SWOT-analys</span>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Styrkor, svagheter, möjligheter och risker för företaget
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          {/* Top Row */}
          <div className="space-y-4">
            {/* Strengths - Top Left */}
            <SWOTQuadrant
              title="Styrkor"
              items={strengths}
              type="strength"
              color="bg-green-50 border border-green-200"
              icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            />
            
            {/* Weaknesses - Top Right */}
            <SWOTQuadrant
              title="Svagheter"
              items={weaknesses}
              type="weakness"
              color="bg-red-50 border border-red-200"
              icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            />
          </div>
          
          {/* Bottom Row */}
          <div className="space-y-4">
            {/* Opportunities - Bottom Left */}
            <SWOTQuadrant
              title="Möjligheter"
              items={opportunities}
              type="opportunity"
              color="bg-blue-50 border border-blue-200"
              icon={<Lightbulb className="h-5 w-5 text-blue-600" />}
            />
            
            {/* Risks - Bottom Right */}
            <SWOTQuadrant
              title="Risker"
              items={risks}
              type="risk"
              color="bg-orange-50 border border-orange-200"
              icon={<Shield className="h-5 w-5 text-orange-600" />}
            />
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">{strengths.length}</div>
              <div className="text-xs text-gray-600">Styrkor</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600">{weaknesses.length}</div>
              <div className="text-xs text-gray-600">Svagheter</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">{opportunities.length}</div>
              <div className="text-xs text-gray-600">Möjligheter</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-orange-600">{risks.length}</div>
              <div className="text-xs text-gray-600">Risker</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
