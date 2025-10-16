import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Activity, BarChart2, Target, ShieldAlert, Compass } from 'lucide-react'

interface ValuationCardProps {
  financialHealth: number
  growthPotential: string
  marketPosition: string
  acquisitionInterest: string
  confidence: number
  recommendation: string
}

export function ValuationCard({
  financialHealth,
  growthPotential,
  marketPosition,
  acquisitionInterest,
  confidence,
  recommendation,
}: ValuationCardProps) {
  const readinessScore = Math.round(
    (financialHealth * 0.4) +
    (normalizePotential(growthPotential) * 0.25) +
    (normalizeInterest(acquisitionInterest) * 0.2) +
    (normalizePosition(marketPosition) * 0.15)
  )

  const focusAreas = deriveFocusAreas(financialHealth, growthPotential, marketPosition, confidence)

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Compass className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Förvärvsläge
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Helhetsbedömning av bolagets lämplighet för nästa steg i förvärvsprocessen
              </p>
            </div>
          </div>
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">
            {recommendation}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Readiness summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryTile
            icon={<Activity className="h-5 w-5 text-green-600" />}
            label="Finansiell hälsa"
            value={`${financialHealth}/10`}
            description={financialHealth >= 8 ? 'Stark balans och lönsamhet' : financialHealth >= 6 ? 'Stabil men bör följas upp' : 'Behöver stärkt lönsamhet'}
          />
          <SummaryTile
            icon={<BarChart2 className="h-5 w-5 text-purple-600" />}
            label="Tillväxtpotential"
            value={growthPotential}
            description={growthPotential === 'Hög' ? 'God skalbarhet och marknadsdriv' : growthPotential === 'Medel' ? 'Balanserad utvecklingsmöjlighet' : 'Begränsad tillväxt – kräver plan'}
          />
          <SummaryTile
            icon={<Target className="h-5 w-5 text-amber-600" />}
            label="Förvärvsintresse"
            value={acquisitionInterest}
            description={acquisitionInterest === 'Hög' ? 'Bör prioriteras i pipen' : acquisitionInterest === 'Medel' ? 'Fortsätt dialog och uppföljning' : 'Låg prioritet i nuläget'}
          />
        </div>

        {/* Confidence indicator */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Analysens tillförlitlighet</span>
            </div>
            <Badge className={`${confidence >= 75 ? 'bg-green-100 text-green-700' : confidence >= 55 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {confidence}%
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            {confidence >= 75
              ? 'Underlaget är välförankrat i datapunkter och kan användas för nästa beslutssteg.'
              : confidence >= 55
              ? 'Underlaget är delvis komplett. Rekommenderas att komplettera data innan beslut.'
              : 'Underlaget är svagt. Säkerställ uppdaterade siffror och kvalitativa insikter.'}
          </p>
        </div>

        {/* Focus areas */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Prioriterade åtgärder</h4>
          <ul className="space-y-2">
            {focusAreas.map((item, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Readiness score */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-100">
          <p className="text-sm font-medium text-gray-700 mb-2">Sammanvägd förvärvsberedskap</p>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-blue-600">{readinessScore}/100</div>
            <p className="text-sm text-gray-600 max-w-xs">
              Sammansatt score baserat på finansiell styrka, marknadsposition och signaler om förvärvsintresse.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode
  label: string
  value: string
  description: string
}) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        {icon}
        <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
      </div>
      <div className="text-xl font-semibold text-gray-900">{value}</div>
      <p className="text-sm text-gray-600 mt-2 leading-snug">{description}</p>
    </div>
  )
}

function normalizePotential(potential: string) {
  if (potential === 'Hög') return 10
  if (potential === 'Medel') return 7
  return 4
}

function normalizeInterest(interest: string) {
  if (interest === 'Hög') return 10
  if (interest === 'Medel') return 7
  return 3
}

function normalizePosition(position: string) {
  switch (position) {
    case 'Marknadsledare': return 10
    case 'Utmanare': return 8
    case 'Nischaktör': return 6
    case 'Följare':
    default: return 5
  }
}

function deriveFocusAreas(
  financialHealth: number,
  growthPotential: string,
  marketPosition: string,
  confidence: number
) {
  const actions: string[] = []

  if (financialHealth < 6) {
    actions.push('Genomför en detaljerad balans- och kassaflödesanalys för att säkerställa finansiell stabilitet.')
  } else {
    actions.push('Bekräfta finansiella nyckeltal mot senaste bokslut och forecasting.')
  }

  if (growthPotential === 'Hög') {
    actions.push('Kartlägg de mest attraktiva expansionssegmenten och möjliga synergier efter förvärv.')
  } else if (growthPotential === 'Medel') {
    actions.push('Identifiera accelerationsinitiativ (sälj, marknad, produkt) för att öka tillväxttakten.')
  } else {
    actions.push('Utvärdera hur bolaget kan stärkas via integration och effektivisering.')
  }

  if (marketPosition === 'Följare') {
    actions.push('Analysera konkurrenslandskapet för att bedöma krav på differentiering post-förvärv.')
  } else if (marketPosition === 'Nischaktör') {
    actions.push('Bedöm nischens storlek och lönsamhet samt möjliga cross-sell-effekter.')
  }

  if (confidence < 60) {
    actions.push('Komplettera datainsamling (kundkoncentration, pipeline, leverantörsberoende) innan beslut.')
  }

  return actions.slice(0, 4)
}
