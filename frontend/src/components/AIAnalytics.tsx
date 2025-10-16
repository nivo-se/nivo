import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  BarChart3, 
  Star,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Users,
  Building2,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Activity,
  Globe,
  Award,
  TrendingUp as TrendUp,
  Calculator,
  FileText,
  Lightbulb,
  Shield,
  Clock,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Calendar
} from 'lucide-react'
import { SupabaseCompany } from '../lib/supabaseDataService'
import AIAnalysisWorkflow from './AIAnalysisWorkflow'

interface SavedCompanyList {
  id: string
  name: string
  description?: string
  companies: SupabaseCompany[]
  filters: any
  createdAt: string
  updatedAt: string
}

interface CompanyAnalysis {
  company: SupabaseCompany
  financialScore: number
  marketScore: number
  growthScore: number
  efficiencyScore: number
  overallScore: number
  recommendations: string[]
  riskFactors: string[]
  opportunities: string[]
  primeTargetScore: number
}

interface MarketBenchmark {
  industry: string
  avgRevenue: number
  avgGrowth: number
  avgMargin: number
  topPerformers: number
}

interface FinancialMetrics {
  // Profitability Ratios
  grossProfitMargin: number
  operatingMargin: number
  netProfitMargin: number
  returnOnAssets: number
  returnOnEquity: number
  
  // Liquidity Ratios
  currentRatio: number
  quickRatio: number
  cashRatio: number
  
  // Efficiency Ratios
  assetTurnover: number
  inventoryTurnover: number
  receivablesTurnover: number
  
  // Leverage Ratios
  debtToEquity: number
  debtToAssets: number
  interestCoverage: number
  
  // Growth Metrics
  revenueGrowth3Y: number
  profitGrowth3Y: number
  assetGrowth3Y: number
  
  // Valuation Metrics
  priceToEarnings: number
  priceToSales: number
  priceToBook: number
  enterpriseValue: number
}

interface SoftFactors {
  marketPosition: 'leader' | 'challenger' | 'follower' | 'niche'
  competitiveAdvantage: string[]
  digitalMaturity: number
  innovationScore: number
  brandStrength: number
  customerSatisfaction: number
  employeeEngagement: number
  sustainabilityScore: number
  governanceQuality: number
  riskManagement: number
}

interface AIInalysis {
  executiveSummary: string
  investmentThesis: string
  keyStrengths: string[]
  keyWeaknesses: string[]
  strategicOpportunities: string[]
  majorRisks: string[]
  financialHealth: 'excellent' | 'good' | 'fair' | 'poor'
  growthPotential: 'high' | 'medium' | 'low'
  marketOutlook: 'bullish' | 'neutral' | 'bearish'
  recommendation: 'Prioritera förvärv' | 'Fördjupa due diligence' | 'Övervaka' | 'Avstå'
  confidence: number
  analysisDate: string
}

interface AIAnalyticsProps {
  onExportData?: (data: any) => void
}

const AIAnalytics: React.FC<AIAnalyticsProps> = ({ onExportData }) => {
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [selectedList, setSelectedList] = useState<SavedCompanyList | null>(null)
  const [analysisResults, setAnalysisResults] = useState<CompanyAnalysis[]>([])
  const [marketBenchmarks, setMarketBenchmarks] = useState<MarketBenchmark[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyAnalysis | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Add ESC key handler to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDetailModalOpen) {
        setIsDetailModalOpen(false)
        setSelectedCompany(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDetailModalOpen])

  // Load saved lists from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedCompanyLists')
    if (saved) {
      try {
        const lists = JSON.parse(saved)
        setSavedLists(lists)
        if (lists.length > 0 && !selectedList) {
          setSelectedList(lists[0])
        }
      } catch (error) {
        console.error('Error loading saved lists:', error)
      }
    }
  }, [])

  // Run AI analysis when selected list changes
  useEffect(() => {
    if (selectedList) {
      runAIAnalysis(selectedList.companies)
    }
  }, [selectedList])

  const runAIAnalysis = async (companies: SupabaseCompany[]) => {
    setLoading(true)
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const analyses: CompanyAnalysis[] = companies.map(company => {
      const financialScore = calculateFinancialScore(company)
      const marketScore = calculateMarketScore(company, companies)
      const growthScore = calculateGrowthScore(company)
      const efficiencyScore = calculateEfficiencyScore(company)
      
      const overallScore = (financialScore + marketScore + growthScore + efficiencyScore) / 4
      const primeTargetScore = calculatePrimeTargetScore(company, financialScore, marketScore, growthScore)
      
      return {
        company,
        financialScore,
        marketScore,
        growthScore,
        efficiencyScore,
        overallScore,
        recommendations: generateRecommendations(company, financialScore, marketScore, growthScore),
        riskFactors: identifyRiskFactors(company),
        opportunities: identifyOpportunities(company, marketScore),
        primeTargetScore
      }
    })

    // Sort by prime target score (highest first)
    analyses.sort((a, b) => b.primeTargetScore - a.primeTargetScore)
    
    setAnalysisResults(analyses)
    setMarketBenchmarks(generateMarketBenchmarks(companies))
    setLoading(false)
  }

  const calculateFinancialScore = (company: SupabaseCompany): number => {
    const revenue = company.SDI || 0
    const growth = (company.Revenue_growth || 0) * 100
    const ebitMargin = (typeof company.EBIT_margin === 'number' ? company.EBIT_margin : 0) * 100
    const profitMargin = (typeof company.NetProfit_margin === 'number' ? company.NetProfit_margin : 0) * 100
    
    // Score based on profitability and stability
    let score = 0
    if (ebitMargin > 10) score += 30
    else if (ebitMargin > 5) score += 20
    else if (ebitMargin > 0) score += 10
    
    if (profitMargin > 5) score += 25
    else if (profitMargin > 0) score += 15
    
    if (growth > 20) score += 25
    else if (growth > 10) score += 20
    else if (growth > 0) score += 10
    
    // Revenue size factor
    if (revenue > 50000) score += 20
    else if (revenue > 20000) score += 15
    else if (revenue > 10000) score += 10
    
    return Math.min(score, 100)
  }

  const calculateMarketScore = (company: SupabaseCompany, allCompanies: SupabaseCompany[]): number => {
    const industry = company.segment_name || 'Unknown'
    const industryCompanies = allCompanies.filter(c => c.segment_name === industry)
    
    if (industryCompanies.length === 0) return 50
    
    const avgIndustryRevenue = industryCompanies.reduce((sum, c) => sum + (c.SDI || 0), 0) / industryCompanies.length
    const avgIndustryGrowth = industryCompanies.reduce((sum, c) => sum + ((typeof c.Revenue_growth === 'number' ? c.Revenue_growth : 0) * 100), 0) / industryCompanies.length
    
    const companyRevenue = company.SDI || 0
    const companyGrowth = (company.Revenue_growth || 0) * 100
    
    let score = 50
    
    // Market position scoring
    if (companyRevenue > avgIndustryRevenue * 1.5) score += 25
    else if (companyRevenue > avgIndustryRevenue) score += 15
    else if (companyRevenue > avgIndustryRevenue * 0.5) score += 5
    
    if (companyGrowth > avgIndustryGrowth * 1.5) score += 25
    else if (companyGrowth > avgIndustryGrowth) score += 15
    else if (companyGrowth > 0) score += 5
    
    return Math.min(score, 100)
  }

  const calculateGrowthScore = (company: SupabaseCompany): number => {
    const growth = (company.Revenue_growth || 0) * 100
    const digitalPresence = company.digital_presence || 0
    
    let score = 0
    if (growth > 30) score += 40
    else if (growth > 20) score += 30
    else if (growth > 10) score += 20
    else if (growth > 0) score += 10
    
    // Digital presence bonus
    if (typeof digitalPresence === 'number' && digitalPresence > 0.8) score += 30
    else if (typeof digitalPresence === 'number' && digitalPresence > 0.5) score += 20
    else if (typeof digitalPresence === 'number' && digitalPresence > 0.2) score += 10
    
    // Employee growth potential
    const employees = parseInt(company.employees || '0')
    if (employees < 10 && growth > 15) score += 30 // High growth potential for small companies
    else if (employees < 50 && growth > 10) score += 20
    else if (growth > 5) score += 10
    
    return Math.min(score, 100)
  }

  const calculateEfficiencyScore = (company: SupabaseCompany): number => {
    const revenue = company.SDI || 0
    const employees = parseInt(company.employees || '0')
    const ebitMargin = (typeof company.EBIT_margin === 'number' ? company.EBIT_margin : 0) * 100
    
    let score = 0
    
    // Revenue per employee efficiency
    if (employees > 0) {
      const revenuePerEmployee = revenue / employees
      if (revenuePerEmployee > 2000) score += 35
      else if (revenuePerEmployee > 1000) score += 25
      else if (revenuePerEmployee > 500) score += 15
    }
    
    // Margin efficiency
    if (ebitMargin > 15) score += 35
    else if (ebitMargin > 10) score += 25
    else if (ebitMargin > 5) score += 15
    else if (ebitMargin > 0) score += 5
    
    // Digital efficiency
    const digitalPresence = company.digital_presence || 0
    if (typeof digitalPresence === 'number' && digitalPresence > 0.7) score += 30
    else if (typeof digitalPresence === 'number' && digitalPresence > 0.4) score += 20
    else if (typeof digitalPresence === 'number' && digitalPresence > 0.1) score += 10
    
    return Math.min(score, 100)
  }

  const calculatePrimeTargetScore = (
    company: SupabaseCompany, 
    financialScore: number, 
    marketScore: number, 
    growthScore: number
  ): number => {
    // Prime targets are companies with:
    // 1. Decent fundamentals (financial score > 40)
    // 2. Room for improvement (not already top performers)
    // 3. Growth potential (growth score > 50)
    // 4. Market opportunity (market score > 30)
    
    let score = 0
    
    // Base requirement: decent fundamentals
    if (financialScore > 40) {
      score += 30
    } else {
      return 0 // Not a viable target
    }
    
    // Growth potential is crucial
    if (growthScore > 70) score += 30
    else if (growthScore > 50) score += 20
    else if (growthScore > 30) score += 10
    
    // Market opportunity
    if (marketScore > 60) score += 20
    else if (marketScore > 40) score += 15
    else if (marketScore > 30) score += 10
    
    // Size factor (prefer mid-size companies for maximum impact)
    const employees = parseInt(company.employees || '0')
    if (employees >= 10 && employees <= 100) score += 20 // Sweet spot
    else if (employees >= 5 && employees <= 200) score += 10
    
    return Math.min(score, 100)
  }

  const generateRecommendations = (
    company: SupabaseCompany, 
    financialScore: number, 
    marketScore: number, 
    growthScore: number
  ): string[] => {
    const recommendations: string[] = []
    
    if (financialScore < 60) {
      recommendations.push("Förbättra lönsamhet genom kostnadsoptimering")
      recommendations.push("Analysera och förbättra pricing-strategi")
    }
    
    if (growthScore < 50) {
      recommendations.push("Investera i digital transformation")
      recommendations.push("Utveckla nya produktlinjer eller marknader")
    }
    
    if (marketScore < 50) {
      recommendations.push("Förbättra marknadsföring och kundanskaffning")
      recommendations.push("Konkurrenskraftig analys och positionering")
    }
    
    const digitalPresence = company.digital_presence || 0
    if (typeof digitalPresence === 'number' && digitalPresence < 0.5) {
      recommendations.push("Stärk digital närvaro och online-försäljning")
    }
    
    return recommendations
  }

  const identifyRiskFactors = (company: SupabaseCompany): string[] => {
    const risks: string[] = []
    
    const growth = (typeof company.Revenue_growth === 'number' ? company.Revenue_growth : 0) * 100
    const ebitMargin = (typeof company.EBIT_margin === 'number' ? company.EBIT_margin : 0) * 100
    
    if (growth < 0) {
      risks.push("Negativ tillväxt - risk för fortsatt nedgång")
    }
    
    if (ebitMargin < 0) {
      risks.push("Negativ lönsamhet - akut kostnadsoptimering behövs")
    }
    
    if (ebitMargin < 2) {
      risks.push("Mycket låg lönsamhet - sårbar för ekonomiska nedgångar")
    }
    
    const digitalPresence = company.digital_presence || 0
    if (typeof digitalPresence === 'number' && digitalPresence < 0.2) {
      risks.push("Begränsad digital närvaro - risk att hamna efter")
    }
    
    return risks
  }

  const identifyOpportunities = (company: SupabaseCompany, marketScore: number): string[] => {
    const opportunities: string[] = []
    
    const employees = parseInt(company.employees || '0')
    const revenue = company.SDI || 0
    
    if (employees < 20 && revenue > 10000) {
      opportunities.push("Hög produktivitet - skalningspotential")
    }
    
    if (marketScore > 60) {
      opportunities.push("Stark marknadsposition - expansionsmöjligheter")
    }
    
    const digitalPresence = company.digital_presence || 0
    if (typeof digitalPresence === 'number' && digitalPresence > 0.7) {
      opportunities.push("Stark digital bas - AI och automatisering")
    }
    
    const growth = (company.Revenue_growth || 0) * 100
    if (growth > 15) {
      opportunities.push("Hög tillväxt - investeringsmöjligheter")
    }
    
    return opportunities
  }

  const generateMarketBenchmarks = (companies: SupabaseCompany[]): MarketBenchmark[] => {
    const industryMap = new Map<string, SupabaseCompany[]>()
    
    companies.forEach(company => {
      const industry = company.segment_name || 'Unknown'
      if (!industryMap.has(industry)) {
        industryMap.set(industry, [])
      }
      industryMap.get(industry)!.push(company)
    })
    
    return Array.from(industryMap.entries()).map(([industry, industryCompanies]) => {
      const avgRevenue = industryCompanies.reduce((sum, c) => sum + (c.SDI || 0), 0) / industryCompanies.length
      const avgGrowth = industryCompanies.reduce((sum, c) => sum + ((c.Revenue_growth || 0) * 100), 0) / industryCompanies.length
      const avgMargin = industryCompanies.reduce((sum, c) => sum + ((typeof c.EBIT_margin === 'number' ? c.EBIT_margin : 0) * 100), 0) / industryCompanies.length
      
      const topPerformers = industryCompanies.filter(c => 
        (typeof c.Revenue_growth === 'number' ? c.Revenue_growth : 0) * 100 > avgGrowth && 
        (typeof c.EBIT_margin === 'number' ? c.EBIT_margin : 0) * 100 > avgMargin
      ).length
      
      return {
        industry,
        avgRevenue,
        avgGrowth,
        avgMargin,
        topPerformers
      }
    }).sort((a, b) => b.topPerformers - a.topPerformers)
  }

  // Generate comprehensive financial metrics
  const generateFinancialMetrics = (company: SupabaseCompany): FinancialMetrics => {
    const revenue = company.SDI || 0
    const ebitMargin = (typeof company.EBIT_margin === 'number' ? company.EBIT_margin : 0) * 100
    const netMargin = (typeof company.NetProfit_margin === 'number' ? company.NetProfit_margin : 0) * 100
    const growth = (company.Revenue_growth || 0) * 100
    const employees = parseInt(company.employees || '0')
    
    // Simulated financial data (in real implementation, this would come from detailed financial statements)
    const grossProfit = revenue * 0.6 // Assume 60% gross margin
    const operatingIncome = revenue * (ebitMargin / 100)
    const netIncome = revenue * (netMargin / 100)
    const totalAssets = revenue * 2.5 // Assume 2.5x asset turnover
    const totalEquity = totalAssets * 0.6 // Assume 60% equity ratio
    const currentAssets = totalAssets * 0.4
    const inventory = currentAssets * 0.3
    const receivables = currentAssets * 0.4
    const cash = currentAssets * 0.3
    const totalDebt = totalAssets * 0.4
    const currentLiabilities = totalAssets * 0.2
    const interestExpense = totalDebt * 0.05 // Assume 5% interest rate
    
    return {
      // Profitability Ratios
      grossProfitMargin: (grossProfit / revenue) * 100,
      operatingMargin: ebitMargin,
      netProfitMargin: netMargin,
      returnOnAssets: (netIncome / totalAssets) * 100,
      returnOnEquity: (netIncome / totalEquity) * 100,
      
      // Liquidity Ratios
      currentRatio: currentAssets / currentLiabilities,
      quickRatio: (currentAssets - inventory) / currentLiabilities,
      cashRatio: cash / currentLiabilities,
      
      // Efficiency Ratios
      assetTurnover: revenue / totalAssets,
      inventoryTurnover: revenue / inventory,
      receivablesTurnover: revenue / receivables,
      
      // Leverage Ratios
      debtToEquity: totalDebt / totalEquity,
      debtToAssets: totalDebt / totalAssets,
      interestCoverage: operatingIncome / interestExpense,
      
      // Growth Metrics
      revenueGrowth3Y: growth,
      profitGrowth3Y: growth * 0.8, // Assume profit grows slower than revenue
      assetGrowth3Y: growth * 0.6,
      
      // Valuation Metrics (simulated)
      priceToEarnings: 15 + (Math.random() * 10), // Random PE between 15-25
      priceToSales: 2 + (Math.random() * 2), // Random PS between 2-4
      priceToBook: 1.5 + (Math.random() * 1), // Random PB between 1.5-2.5
      enterpriseValue: revenue * (3 + Math.random() * 2) // EV between 3-5x revenue
    }
  }

  // Generate soft factors analysis
  const generateSoftFactors = (company: SupabaseCompany, financialScore: number): SoftFactors => {
    const revenue = company.SDI || 0
    const growth = (company.Revenue_growth || 0) * 100
    const digitalPresence = company.digital_presence || 0
    const employees = parseInt(company.employees || '0')
    
    // Determine market position based on size and growth
    let marketPosition: 'leader' | 'challenger' | 'follower' | 'niche'
    if (revenue > 50000 && growth > 10) marketPosition = 'leader'
    else if (revenue > 20000 && growth > 15) marketPosition = 'challenger'
    else if (revenue > 10000) marketPosition = 'follower'
    else marketPosition = 'niche'
    
    // Generate competitive advantages
    const competitiveAdvantage: string[] = []
    if (growth > 20) competitiveAdvantage.push('Hög tillväxt')
    if (typeof digitalPresence === 'number' && digitalPresence > 0.7) competitiveAdvantage.push('Stark digital närvaro')
    if (employees < 50 && revenue > 20000) competitiveAdvantage.push('Hög produktivitet')
    if (financialScore > 70) competitiveAdvantage.push('Finansiell stabilitet')
    
    return {
      marketPosition,
      competitiveAdvantage,
      digitalMaturity: typeof digitalPresence === 'number' ? digitalPresence * 100 : 30,
      innovationScore: Math.min(100, 40 + (growth * 2) + (typeof digitalPresence === 'number' ? digitalPresence * 100 * 0.3 : 0)),
      brandStrength: Math.min(100, 50 + (revenue / 1000) + (growth / 2)),
      customerSatisfaction: Math.min(100, 70 + (growth / 5) + Math.random() * 20),
      employeeEngagement: Math.min(100, 65 + (financialScore / 4) + Math.random() * 15),
      sustainabilityScore: Math.min(100, 60 + (typeof digitalPresence === 'number' ? digitalPresence * 100 * 0.4 : 0) + Math.random() * 20),
      governanceQuality: Math.min(100, 70 + (financialScore / 5) + Math.random() * 15),
      riskManagement: Math.min(100, 60 + (financialScore / 3) + Math.random() * 20)
    }
  }

  // Generate comprehensive AI analysis
  const generateAIAnalysis = (company: SupabaseCompany, financialMetrics: FinancialMetrics, softFactors: SoftFactors): AIInalysis => {
    const revenue = company.SDI || 0
    const growth = (company.Revenue_growth || 0) * 100
    const ebitMargin = (typeof company.EBIT_margin === 'number' ? company.EBIT_margin : 0) * 100
    
    // Determine financial health
    let financialHealth: 'excellent' | 'good' | 'fair' | 'poor'
    if (ebitMargin > 15 && growth > 10 && financialMetrics.currentRatio > 2) financialHealth = 'excellent'
    else if (ebitMargin > 8 && growth > 5 && financialMetrics.currentRatio > 1.5) financialHealth = 'good'
    else if (ebitMargin > 0 && growth > 0 && financialMetrics.currentRatio > 1) financialHealth = 'fair'
    else financialHealth = 'poor'
    
    // Determine growth potential
    let growthPotential: 'high' | 'medium' | 'low'
    if (growth > 20 && softFactors.digitalMaturity > 70 && softFactors.innovationScore > 75) growthPotential = 'high'
    else if (growth > 10 && softFactors.digitalMaturity > 50) growthPotential = 'medium'
    else growthPotential = 'low'
    
    // Determine market outlook
    let marketOutlook: 'bullish' | 'neutral' | 'bearish'
    if (softFactors.marketPosition === 'leader' && growth > 15) marketOutlook = 'bullish'
    else if (softFactors.marketPosition === 'challenger' && growth > 10) marketOutlook = 'neutral'
    else marketOutlook = 'bearish'
    
    // Generate recommendation
    let recommendation: 'Prioritera förvärv' | 'Fördjupa due diligence' | 'Övervaka' | 'Avstå'
    const overallScore = (company.SDI || 0) / 10000 + growth + ebitMargin + softFactors.digitalMaturity / 10
    if (overallScore > 80) recommendation = 'Prioritera förvärv'
    else if (overallScore > 60) recommendation = 'Fördjupa due diligence'
    else if (overallScore > 40) recommendation = 'Övervaka'
    else recommendation = 'Avstå'
    
    return {
      executiveSummary: `${company.name} är en ${company.segment_name} med ${revenue.toLocaleString()} TSEK i omsättning och ${growth.toFixed(1)}% tillväxt. Företaget visar ${financialHealth === 'excellent' ? 'utmärkta' : financialHealth === 'good' ? 'god' : 'begränsade'} finansiella resultat och har ${growthPotential} tillväxtpotential.`,
      investmentThesis: `Företaget representerar en ${recommendation.includes('buy') ? 'attraktiv investeringsmöjlighet' : 'försiktig investering'} baserat på dess ${softFactors.marketPosition} position på marknaden och ${financialHealth} finansiella hälsa.`,
      keyStrengths: [
        `${growth.toFixed(1)}% omsättningstillväxt`,
        `${ebitMargin.toFixed(1)}% EBIT-marginal`,
        `${softFactors.digitalMaturity.toFixed(0)}% digital mognad`,
        ...softFactors.competitiveAdvantage
      ],
      keyWeaknesses: [
        financialMetrics.currentRatio < 1.5 ? 'Begränsad likviditet' : '',
        financialMetrics.debtToEquity > 1 ? 'Hög skuldsättning' : '',
        softFactors.digitalMaturity < 50 ? 'Begränsad digital närvaro' : ''
      ].filter(Boolean),
      strategicOpportunities: [
        'Digital transformation',
        'Marknadsutvidgning',
        'Produktinnovation',
        'Operativ effektivisering'
      ],
      majorRisks: [
        'Konjunkturell volatilitet',
        'Teknologisk disruption',
        'Konkurrensintensifiering',
        'Regulatoriska förändringar'
      ],
      financialHealth,
      growthPotential,
      marketOutlook,
      recommendation,
      confidence: Math.min(100, 70 + Math.random() * 15),
      analysisDate: new Date().toISOString().split('T')[0]
    }
  }

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString('sv-SE', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })} TSEK`
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-blue-600 bg-blue-100'
    if (score >= 40) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getPrimeTargetBadge = (score: number) => {
    if (score >= 80) return { text: 'TOP TARGET', color: 'bg-red-500 text-white' }
    if (score >= 60) return { text: 'HÖG POTENTIAL', color: 'bg-orange-500 text-white' }
    if (score >= 40) return { text: 'INTEGRATION', color: 'bg-blue-500 text-white' }
    return { text: 'LÅG PRIORITET', color: 'bg-gray-500 text-white' }
  }

  if (savedLists.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Inga sparade listor hittades</h3>
            <p className="text-gray-600 mb-4">
              Skapa en sparad företagslista i "Företagssökning" för att köra AI-analys
            </p>
            <Button onClick={() => window.location.href = '/companies'}>
              Gå till Företagssökning
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI-insikter</h2>
          <p className="text-gray-600">Avancerad analys för att identifiera prime targets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Brain className="h-4 w-4 mr-2" />
            Generera insikter
          </Button>
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Exportera rapport
          </Button>
        </div>
      </div>

      {/* Tabs for different analysis modes */}
      <Tabs defaultValue="ai-workflow" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai-workflow">AI Workflow (OpenAI)</TabsTrigger>
          <TabsTrigger value="simulated">Simulerad Analys</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ai-workflow" className="mt-6">
          <AIAnalysisWorkflow 
            onAnalysisComplete={(results) => {
              console.log('AI Analysis Complete:', results)
              // Convert AI analysis results to our format and display them
              if (results && results.length > 0) {
                const convertedResults = results.map(result => {
                  // Ensure all required fields exist with fallbacks
                  const safeResult = {
                    orgNr: result?.orgNr || result?.OrgNr || 'Unknown',
                    name: result?.name || 'Unknown Company',
                    executiveSummary: result?.executiveSummary || 'No summary available',
                    financialHealth: result?.financialHealth || 0,
                    growthPotential: result?.growthPotential || 'Unknown',
                    marketPosition: result?.marketPosition || 'Unknown',
                    strengths: Array.isArray(result?.strengths) ? result.strengths : [],
                    weaknesses: Array.isArray(result?.weaknesses) ? result.weaknesses : [],
                    opportunities: Array.isArray(result?.opportunities) ? result.opportunities : [],
                    risks: Array.isArray(result?.risks) ? result.risks : [],
                    recommendation: result?.recommendation || 'Övervaka',
                    confidence: result?.confidence || 0
                  }

                  return {
                    company: {
                      OrgNr: safeResult.orgNr,
                      name: safeResult.name,
                      SDI: 0, // These would need to be fetched from the original data
                      Revenue_growth: 0,
                      EBIT_margin: 0,
                      NetProfit_margin: 0,
                      segment_name: '',
                      city: '',
                      employees: '',
                      homepage: '',
                      address: '',
                      incorporation_date: ''
                    },
                    financialScore: safeResult.financialHealth,
                    marketScore: 0,
                    growthScore: 0,
                    efficiencyScore: 0,
                    overallScore: safeResult.confidence,
                    primeTargetScore: safeResult.confidence,
                    aiAnalysis: {
                      executiveSummary: safeResult.executiveSummary,
                      strengths: safeResult.strengths,
                      weaknesses: safeResult.weaknesses,
                      opportunities: safeResult.opportunities,
                      risks: safeResult.risks,
                      recommendation: safeResult.recommendation,
                      confidence: safeResult.confidence
                    },
                    financialMetrics: {
                      revenue: 0,
                      growth: 0,
                      margin: 0,
                      efficiency: 0
                    },
                    softFactors: {
                      marketPosition: safeResult.marketPosition,
                      growthPotential: safeResult.growthPotential,
                      riskFactors: safeResult.risks,
                      opportunities: safeResult.opportunities
                    }
                  }
                })
                setAnalysisResults(convertedResults)
                setLoading(false)
              }
            }}
          />
          
          {/* AI Analysis Results will appear here after successful analysis */}
        </TabsContent>
        
        <TabsContent value="simulated" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Simulated Analysis (Removed)</CardTitle>
              <CardDescription>
                This section has been removed. Use the AI Workflow tab for real analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
          <Select 
            value={selectedList?.id || ''} 
            onValueChange={(value) => {
              const list = savedLists.find(l => l.id === value)
              setSelectedList(list || null)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Välj en sparad lista..." />
            </SelectTrigger>
            <SelectContent>
              {savedLists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{list.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {list.companies.length} företag
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto text-blue-600 mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-2">Kör AI-analys...</h3>
            <p className="text-gray-600 mb-4">Analyserar företagsdata och genererar insikter</p>
            <Progress value={66} className="w-full max-w-xs mx-auto" />
          </CardContent>
        </Card>
      )}

      {!loading && analysisResults.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Analyserade företag</p>
                    <p className="text-2xl font-bold">{analysisResults.length}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Prime targets</p>
                    <p className="text-2xl font-bold text-red-600">
                      {analysisResults.filter(r => r.primeTargetScore >= 70).length}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Genomsnittlig score</p>
                    <p className="text-2xl font-bold">
                      {Math.round(analysisResults.reduce((sum, r) => sum + r.overallScore, 0) / analysisResults.length)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Högsta potential</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.round(Math.max(...analysisResults.map(r => r.primeTargetScore)))}
                    </p>
                  </div>
                  <Zap className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Prime Targets Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2 text-red-600" />
                Prime Targets - Rankade efter potential
              </CardTitle>
              <CardDescription>
                Företag med högst potential för förbättring och tillväxt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisResults.slice(0, 20).map((analysis, index) => {
                  const primeBadge = getPrimeTargetBadge(analysis.primeTargetScore)
                  return (
                    <div 
                      key={analysis.company.OrgNr}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedCompany(analysis)
                        setIsDetailModalOpen(true)
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold">{analysis.company.name}</h4>
                            <p className="text-sm text-gray-600">
                              {analysis.company.segment_name} • {formatCurrency(analysis.company.SDI || 0)} • {(analysis.company.Revenue_growth || 0) * 100}% tillväxt
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 mb-2">
                          <Badge className={getScoreColor(analysis.financialScore)}>
                            Finansiell: {Math.round(analysis.financialScore)}
                          </Badge>
                          <Badge className={getScoreColor(analysis.growthScore)}>
                            Tillväxt: {Math.round(analysis.growthScore)}
                          </Badge>
                          <Badge className={getScoreColor(analysis.efficiencyScore)}>
                            Effektivitet: {Math.round(analysis.efficiencyScore)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge className={primeBadge.color}>
                            {primeBadge.text}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            Prime Target Score: {Math.round(analysis.primeTargetScore)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">
                            {Math.round(analysis.primeTargetScore)}
                          </div>
                          <div className="text-xs text-gray-500">Prime Score</div>
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Market Benchmarks */}
          <Card>
            <CardHeader>
              <CardTitle>Marknadsbenchmarks per bransch</CardTitle>
              <CardDescription>
                Jämförelse av genomsnittlig prestanda inom varje bransch
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketBenchmarks.map((benchmark, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">{benchmark.industry}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Genomsnittlig omsättning:</span>
                        <span className="font-medium">{formatCurrency(benchmark.avgRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Genomsnittlig tillväxt:</span>
                        <span className="font-medium">{benchmark.avgGrowth.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Genomsnittlig marginal:</span>
                        <span className="font-medium">{benchmark.avgMargin.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Top performers:</span>
                        <span className="font-medium text-green-600">{benchmark.topPerformers}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Comprehensive Financial Analysis Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              {selectedCompany?.company.name} - Omfattande Finansiell Analys
            </DialogTitle>
            <DialogDescription>
              Detaljerad AI-driven finansiell analys, soft factors och investeringsrekommendation
            </DialogDescription>
          </DialogHeader>
          
          {selectedCompany && (() => {
            const financialMetrics = generateFinancialMetrics(selectedCompany.company)
            const softFactors = generateSoftFactors(selectedCompany.company, selectedCompany.financialScore)
            const aiAnalysis = generateAIAnalysis(selectedCompany.company, financialMetrics, softFactors)
            
            // Ensure aiAnalysis is not undefined
            if (!aiAnalysis) {
              return <div className="p-4 text-center text-gray-500">No analysis available</div>
            }
            
            return (
              <div className="space-y-8">
                {/* Executive Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Executive Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">AI-analys sammanfattning</h4>
                          <p className="text-sm text-gray-600">{aiAnalysis?.executiveSummary || 'No summary available'}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Investeringsargument</h4>
                          <p className="text-sm text-gray-600">{aiAnalysis?.investmentThesis || 'No investment thesis available'}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-lg font-bold text-blue-600">
                              {(aiAnalysis?.financialHealth || 'unknown').toUpperCase()}
                            </div>
                            <div className="text-xs text-blue-800">Finansiell Hälsa</div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-lg font-bold text-green-600">
                              {(aiAnalysis?.growthPotential || 'unknown').toUpperCase()}
                            </div>
                            <div className="text-xs text-green-800">Tillväxtpotential</div>
                          </div>
                        </div>
                        
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-xl font-bold text-purple-600 mb-1">
                            {(aiAnalysis?.recommendation || 'hold').replace('_', ' ').toUpperCase()}
                          </div>
                          <div className="text-xs text-purple-800">AI Rekommendation</div>
                          <div className="text-xs text-gray-600 mt-1">
                            Confidence: {Math.round(aiAnalysis?.confidence || 0)}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-lg font-bold text-orange-600">
                            {(aiAnalysis?.marketOutlook || 'neutral').toUpperCase()}
                          </div>
                          <div className="text-xs text-orange-800">Marknadsutsikt</div>
                        </div>
                        
                        <div className="text-center p-2 bg-gray-100 rounded text-xs text-gray-600">
                          Analysdatum: {aiAnalysis?.analysisDate || new Date().toISOString().split('T')[0]}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Calculator className="h-5 w-5 mr-2" />
                      Finansiella Nyckeltal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Profitability Ratios */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                          Lönsamhet
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Bruttomarginal:</span>
                            <span className="font-medium">{financialMetrics.grossProfitMargin.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>EBIT-marginal:</span>
                            <span className="font-medium">{financialMetrics.operatingMargin.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Nettomarginal:</span>
                            <span className="font-medium">{financialMetrics.netProfitMargin.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ROA:</span>
                            <span className="font-medium">{financialMetrics.returnOnAssets.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ROE:</span>
                            <span className="font-medium">{financialMetrics.returnOnEquity.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Liquidity Ratios */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 flex items-center">
                          <Activity className="h-4 w-4 mr-2 text-blue-600" />
                          Likviditet
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Likviditet 1:</span>
                            <span className="font-medium">{financialMetrics.currentRatio.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Likviditet 2:</span>
                            <span className="font-medium">{financialMetrics.quickRatio.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Kassakvot:</span>
                            <span className="font-medium">{financialMetrics.cashRatio.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Räntetäckning:</span>
                            <span className="font-medium">{financialMetrics.interestCoverage.toFixed(1)}x</span>
                          </div>
                        </div>
                      </div>

                      {/* Efficiency Ratios */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 flex items-center">
                          <Zap className="h-4 w-4 mr-2 text-purple-600" />
                          Effektivitet
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Kapitalomsättning:</span>
                            <span className="font-medium">{financialMetrics.assetTurnover.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Lageromsättning:</span>
                            <span className="font-medium">{financialMetrics.inventoryTurnover.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Kundfordringar:</span>
                            <span className="font-medium">{financialMetrics.receivablesTurnover.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Skuldsättning:</span>
                            <span className="font-medium">{financialMetrics.debtToEquity.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Valuation Metrics */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 flex items-center">
                          <DollarSign className="h-4 w-4 mr-2 text-orange-600" />
                          Värdering
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>P/E-tal:</span>
                            <span className="font-medium">{financialMetrics.priceToEarnings.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>P/S-tal:</span>
                            <span className="font-medium">{financialMetrics.priceToSales.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>P/B-tal:</span>
                            <span className="font-medium">{financialMetrics.priceToBook.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Enterprise Value:</span>
                            <span className="font-medium">{formatCurrency(financialMetrics.enterpriseValue)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Soft Factors Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Brain className="h-5 w-5 mr-2" />
                      Soft Factors & Konkurrensposition
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Marknadsposition</h4>
                          <Badge className={`${
                            softFactors.marketPosition === 'leader' ? 'bg-green-500' :
                            softFactors.marketPosition === 'challenger' ? 'bg-blue-500' :
                            softFactors.marketPosition === 'follower' ? 'bg-yellow-500' : 'bg-gray-500'
                          } text-white`}>
                            {softFactors.marketPosition.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Konkurrensfördelar</h4>
                          <div className="space-y-1">
                            {softFactors.competitiveAdvantage.map((advantage, index) => (
                              <Badge key={index} variant="outline" className="mr-1 mb-1">
                                {advantage}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-lg font-bold text-blue-600">
                              {Math.round(softFactors.digitalMaturity)}%
                            </div>
                            <div className="text-xs text-blue-800">Digital Mognad</div>
                          </div>
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-lg font-bold text-purple-600">
                              {Math.round(softFactors.innovationScore)}%
                            </div>
                            <div className="text-xs text-purple-800">Innovation</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-lg font-bold text-green-600">
                              {Math.round(softFactors.brandStrength)}%
                            </div>
                            <div className="text-xs text-green-800">Varumärke</div>
                          </div>
                          <div className="text-center p-3 bg-orange-50 rounded-lg">
                            <div className="text-lg font-bold text-orange-600">
                              {Math.round(softFactors.customerSatisfaction)}%
                            </div>
                            <div className="text-xs text-orange-800">Kundnöjdhet</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-indigo-50 rounded-lg">
                            <div className="text-lg font-bold text-indigo-600">
                              {Math.round(softFactors.employeeEngagement)}%
                            </div>
                            <div className="text-xs text-indigo-800">Anställda</div>
                          </div>
                          <div className="text-center p-3 bg-teal-50 rounded-lg">
                            <div className="text-lg font-bold text-teal-600">
                              {Math.round(softFactors.sustainabilityScore)}%
                            </div>
                            <div className="text-xs text-teal-800">Hållbarhet</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-bold text-gray-600">
                              {Math.round(softFactors.governanceQuality)}%
                            </div>
                            <div className="text-xs text-gray-800">Styrning</div>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <div className="text-lg font-bold text-red-600">
                              {Math.round(softFactors.riskManagement)}%
                            </div>
                            <div className="text-xs text-red-800">Riskhantering</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Strategic Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths & Opportunities */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-green-700">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Styrkor & Möjligheter
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Nyckelfördelar</h4>
                          <div className="space-y-2">
                            {(aiAnalysis?.keyStrengths || []).map((strength, index) => (
                              <div key={index} className="flex items-start space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{strength}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Strategiska Möjligheter</h4>
                          <div className="space-y-2">
                            {(aiAnalysis?.strategicOpportunities || []).map((opportunity, index) => (
                              <div key={index} className="flex items-start space-x-2">
                                <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{opportunity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Weaknesses & Risks */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-red-700">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Utmaningar & Risker
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Svagheter</h4>
                          <div className="space-y-2">
                            {(aiAnalysis?.keyWeaknesses || []).length > 0 ? (
                              (aiAnalysis?.keyWeaknesses || []).map((weakness, index) => (
                                <div key={index} className="flex items-start space-x-2">
                                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm text-gray-700">{weakness}</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500 italic">Inga betydande svagheter identifierade</span>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Stora Risker</h4>
                          <div className="space-y-2">
                            {(aiAnalysis?.majorRisks || []).map((risk, index) => (
                              <div key={index} className="flex items-start space-x-2">
                                <Shield className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{risk}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Company Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building2 className="h-5 w-5 mr-2" />
                      Företagsinformation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">Adress:</span>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">{selectedCompany.company.address || 'Ej tillgänglig'}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">Stad:</span>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">{selectedCompany.company.city || 'Ej tillgänglig'}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">Anställda:</span>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">{selectedCompany.company.employees || 'Ej tillgänglig'}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">Grundat:</span>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">{selectedCompany.company.incorporation_date || 'Ej tillgänglig'}</p>
                      </div>
                    </div>
                    
                    {selectedCompany.company.homepage && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center space-x-2">
                          <ExternalLink className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">Webbplats:</span>
                          <a 
                            href={selectedCompany.company.homepage} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            {selectedCompany.company.homepage}
                          </a>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AIAnalytics
