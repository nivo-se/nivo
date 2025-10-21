/**
 * Multi-Model Valuation Engine
 * Implements 5 deterministic valuation models with EV vs Equity handling
 */

export interface ValuationModel {
  key: string
  name: string
  compute(profile: CompanyProfile, assumptions: ValuationAssumptions): ValuationOutput
}

export interface CompanyProfile {
  orgnr: string
  name: string
  industry: string
  sizeBucket: 'small' | 'medium' | 'large'
  growthBucket: 'low' | 'medium' | 'high'
  
  // Financial data (in SEK)
  revenue: number // SDI
  netProfit: number // DR
  ebitda?: number // ORS as proxy
  revenueGrowth: number // Revenue_growth
  ebitMargin: number // EBIT_margin
  netProfitMargin: number // NetProfit_margin
  employees: number
  
  // Historical data (optional)
  historicalRevenue?: number[]
  historicalProfit?: number[]
}

export interface ValuationAssumptions {
  modelKey: string
  revenueMultiple?: number
  ebitdaMultiple?: number
  earningsMultiple?: number
  discountRate?: number
  terminalMultiple?: number
  netDebtMethod: 'direct' | 'ratio_revenue' | 'ratio_ebitda' | 'zero'
  netDebtK?: number
  netDebtDirect?: number
}

export interface ValuationOutput {
  modelKey: string
  modelName: string
  valueEv: number | null // Enterprise Value in SEK
  valueEquity: number | null // Equity Value in SEK
  basis: string
  multipleUsed: number | null
  confidence: number // 0-100
  inputs: {
    revenue?: number
    netProfit?: number
    ebitda?: number
    multiple?: number
    netDebt?: number
    netDebtMethod?: string
    reason?: string
    [key: string]: any
  }
}

export interface NetDebtCalculation {
  netDebt: number
  method: string
  source: string
}

/**
 * Calculate Net Debt using various methods
 */
export function calculateNetDebt(
  profile: CompanyProfile, 
  assumptions: ValuationAssumptions
): NetDebtCalculation {
  switch (assumptions.netDebtMethod) {
    case 'direct':
      return {
        netDebt: assumptions.netDebtDirect || 0,
        method: 'direct',
        source: 'user_provided'
      }
    
    case 'ratio_revenue':
      const revenueNetDebt = profile.revenue * (assumptions.netDebtK || 0.2)
      return {
        netDebt: revenueNetDebt,
        method: 'ratio_revenue',
        source: `revenue × ${assumptions.netDebtK || 0.2}`
      }
    
    case 'ratio_ebitda':
      const ebitdaNetDebt = (profile.ebitda || profile.revenue * profile.ebitMargin) * (assumptions.netDebtK || 0.5)
      return {
        netDebt: ebitdaNetDebt,
        method: 'ratio_ebitda',
        source: `ebitda × ${assumptions.netDebtK || 0.5}`
      }
    
    case 'zero':
    default:
      return {
        netDebt: 0,
        method: 'zero',
        source: 'assumed_zero'
      }
  }
}

/**
 * Revenue Multiple Model (EV-based)
 */
export class RevenueMultipleModel implements ValuationModel {
  key = 'revenue_multiple'
  name = 'Revenue Multiple'

  compute(profile: CompanyProfile, assumptions: ValuationAssumptions): ValuationOutput {
    const multiple = assumptions.revenueMultiple || 1.0
    const ev = profile.revenue * multiple
    
    const netDebtCalc = calculateNetDebt(profile, assumptions)
    const equity = ev - netDebtCalc.netDebt
    
    // Confidence based on data quality and company size
    let confidence = 70
    if (profile.revenue > 10000000) confidence += 10 // Large companies more reliable
    if (profile.revenueGrowth > 0.1) confidence += 10 // Growing companies
    if (netDebtCalc.method === 'zero') confidence -= 5 // Net debt assumption reduces confidence
    
    return {
      modelKey: this.key,
      modelName: this.name,
      valueEv: ev,
      valueEquity: equity,
      basis: `Revenue (${(profile.revenue/1000).toFixed(1)}M SEK) × ${multiple}x multiple`,
      multipleUsed: multiple,
      confidence: Math.min(100, Math.max(0, confidence)),
      inputs: {
        revenue: profile.revenue,
        multiple,
        netDebt: netDebtCalc.netDebt,
        netDebtMethod: netDebtCalc.method,
        netDebtSource: netDebtCalc.source
      }
    }
  }
}

/**
 * EBITDA Multiple Model (EV-based)
 */
export class EbitdaMultipleModel implements ValuationModel {
  key = 'ebitda_multiple'
  name = 'EBITDA Multiple'

  compute(profile: CompanyProfile, assumptions: ValuationAssumptions): ValuationOutput {
    const multiple = assumptions.ebitdaMultiple || 6.0
    
    // Use EBITDA if available, otherwise use ORS (Operating Result) as proxy
    const ebitda = profile.ebitda || (profile.revenue * profile.ebitMargin)
    const ev = ebitda * multiple
    
    const netDebtCalc = calculateNetDebt(profile, assumptions)
    const equity = ev - netDebtCalc.netDebt
    
    // Confidence based on data quality
    let confidence = 60
    if (profile.ebitda) confidence += 15 // Real EBITDA data
    else confidence -= 10 // Using EBIT margin proxy
    
    if (ebitda > 0) confidence += 10 // Profitable
    if (profile.revenue > 10000000) confidence += 10
    if (netDebtCalc.method === 'zero') confidence -= 5
    
    const basis = profile.ebitda 
      ? `EBITDA (${(ebitda/1000).toFixed(1)}M SEK) × ${multiple}x multiple`
      : `EBITDA proxy (${(ebitda/1000).toFixed(1)}M SEK) × ${multiple}x multiple`
    
    return {
      modelKey: this.key,
      modelName: this.name,
      valueEv: ev,
      valueEquity: equity,
      basis,
      multipleUsed: multiple,
      confidence: Math.min(100, Math.max(0, confidence)),
      inputs: {
        ebitda,
        multiple,
        netDebt: netDebtCalc.netDebt,
        netDebtMethod: netDebtCalc.method,
        netDebtSource: netDebtCalc.source,
        reason: profile.ebitda ? undefined : 'Using EBIT margin as EBITDA proxy'
      }
    }
  }
}

/**
 * Earnings Multiple Model (PER - Equity-based)
 */
export class EarningsMultipleModel implements ValuationModel {
  key = 'earnings_multiple'
  name = 'Earnings Multiple (PER)'

  compute(profile: CompanyProfile, assumptions: ValuationAssumptions): ValuationOutput {
    const multiple = assumptions.earningsMultiple || 8.0
    
    // If negative profit, return null
    if (profile.netProfit <= 0) {
      return {
        modelKey: this.key,
        modelName: this.name,
        valueEv: null,
        valueEquity: null,
        basis: 'Cannot value unprofitable company using earnings multiple',
        multipleUsed: null,
        confidence: 0,
        inputs: {
          netProfit: profile.netProfit,
          multiple,
          reason: 'Negative or zero net profit'
        }
      }
    }
    
    const equity = profile.netProfit * multiple
    
    const netDebtCalc = calculateNetDebt(profile, assumptions)
    const ev = equity + netDebtCalc.netDebt
    
    // Confidence based on profitability and stability
    let confidence = 70
    if (profile.netProfitMargin > 0.05) confidence += 15 // High margins
    if (profile.netProfitMargin > 0.1) confidence += 10 // Very high margins
    if (profile.revenueGrowth > 0.1) confidence += 10 // Growing
    if (profile.revenue < 5000000) confidence -= 10 // Small companies less reliable
    
    return {
      modelKey: this.key,
      modelName: this.name,
      valueEv: ev,
      valueEquity: equity,
      basis: `Net Profit (${(profile.netProfit/1000).toFixed(1)}M SEK) × ${multiple}x multiple`,
      multipleUsed: multiple,
      confidence: Math.min(100, Math.max(0, confidence)),
      inputs: {
        netProfit: profile.netProfit,
        multiple,
        netDebt: netDebtCalc.netDebt,
        netDebtMethod: netDebtCalc.method,
        netDebtSource: netDebtCalc.source
      }
    }
  }
}

/**
 * DCF-Lite Model (EV-based)
 */
export class DcfLiteModel implements ValuationModel {
  key = 'dcf_lite'
  name = 'DCF-Lite'

  compute(profile: CompanyProfile, assumptions: ValuationAssumptions): ValuationOutput {
    const discountRate = assumptions.discountRate || 0.10
    const terminalMultiple = assumptions.terminalMultiple || 8.0
    const growthYears = 3 // Simplified to 3 years
    
    // Use net profit as cash flow proxy
    const baseCashFlow = profile.netProfit
    const growthRate = Math.min(profile.revenueGrowth, 0.15) // Cap at 15%
    
    if (baseCashFlow <= 0) {
      return {
        modelKey: this.key,
        modelName: this.name,
        valueEv: null,
        valueEquity: null,
        basis: 'Cannot perform DCF with negative cash flow',
        multipleUsed: null,
        confidence: 0,
        inputs: {
          baseCashFlow,
          growthRate,
          discountRate,
          reason: 'Negative or zero cash flow'
        }
      }
    }
    
    // Calculate projected cash flows
    let pvCashFlows = 0
    for (let year = 1; year <= growthYears; year++) {
      const cashFlow = baseCashFlow * Math.pow(1 + growthRate, year)
      const pv = cashFlow / Math.pow(1 + discountRate, year)
      pvCashFlows += pv
    }
    
    // Terminal value
    const terminalCashFlow = baseCashFlow * Math.pow(1 + growthRate, growthYears + 1)
    const terminalValue = (terminalCashFlow * terminalMultiple) / Math.pow(1 + discountRate, growthYears + 1)
    
    const ev = pvCashFlows + terminalValue
    
    const netDebtCalc = calculateNetDebt(profile, assumptions)
    const equity = ev - netDebtCalc.netDebt
    
    // Confidence based on data quality and assumptions
    let confidence = 50
    if (profile.netProfitMargin > 0.05) confidence += 15
    if (profile.revenueGrowth > 0.05 && profile.revenueGrowth < 0.25) confidence += 10 // Reasonable growth
    if (profile.revenue > 10000000) confidence += 10
    if (netDebtCalc.method === 'zero') confidence -= 5
    
    return {
      modelKey: this.key,
      modelName: this.name,
      valueEv: ev,
      valueEquity: equity,
      basis: `DCF: ${growthYears}yr growth (${(growthRate*100).toFixed(1)}%) + terminal value (${terminalMultiple}x)`,
      multipleUsed: null,
      confidence: Math.min(100, Math.max(0, confidence)),
      inputs: {
        baseCashFlow,
        growthRate,
        discountRate,
        terminalMultiple,
        pvCashFlows,
        terminalValue,
        netDebt: netDebtCalc.netDebt,
        netDebtMethod: netDebtCalc.method,
        netDebtSource: netDebtCalc.source
      }
    }
  }
}

/**
 * Hybrid Score-Adjusted Model
 */
export class HybridScoreModel implements ValuationModel {
  key = 'hybrid_score'
  name = 'Hybrid Score-Adjusted'

  compute(profile: CompanyProfile, assumptions: ValuationAssumptions): ValuationOutput {
    // Get results from other models
    const revenueModel = new RevenueMultipleModel()
    const ebitdaModel = new EbitdaMultipleModel()
    const earningsModel = new EarningsMultipleModel()
    const dcfModel = new DcfLiteModel()
    
    const revenueResult = revenueModel.compute(profile, assumptions)
    const ebitdaResult = ebitdaModel.compute(profile, assumptions)
    const earningsResult = earningsModel.compute(profile, assumptions)
    const dcfResult = dcfModel.compute(profile, assumptions)
    
    // Calculate weights based on company characteristics
    const weights = this.calculateWeights(profile)
    
    // Weighted average of available models
    let totalWeight = 0
    let weightedEv = 0
    let weightedEquity = 0
    let totalConfidence = 0
    let modelCount = 0
    
    const results = [revenueResult, ebitdaResult, earningsResult, dcfResult]
    const modelWeights = [weights.revenue, weights.ebitda, weights.earnings, weights.dcf]
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const weight = modelWeights[i]
      
      if (result.valueEv !== null && result.valueEquity !== null) {
        weightedEv += result.valueEv * weight
        weightedEquity += result.valueEquity * weight
        totalWeight += weight
        totalConfidence += result.confidence
        modelCount++
      }
    }
    
    if (totalWeight === 0) {
      return {
        modelKey: this.key,
        modelName: this.name,
        valueEv: null,
        valueEquity: null,
        basis: 'No valid models available for hybrid calculation',
        multipleUsed: null,
        confidence: 0,
        inputs: {
          reason: 'All individual models returned null values'
        }
      }
    }
    
    const finalEv = weightedEv / totalWeight
    const finalEquity = weightedEquity / totalWeight
    const avgConfidence = totalConfidence / modelCount
    
    return {
      modelKey: this.key,
      modelName: this.name,
      valueEv: finalEv,
      valueEquity: finalEquity,
      basis: `Weighted average of ${modelCount} models (Revenue:${weights.revenue.toFixed(1)}, EBITDA:${weights.ebitda.toFixed(1)}, Earnings:${weights.earnings.toFixed(1)}, DCF:${weights.dcf.toFixed(1)})`,
      multipleUsed: null,
      confidence: Math.round(avgConfidence),
      inputs: {
        weights,
        modelCount,
        totalWeight,
        revenueValue: revenueResult.valueEv,
        ebitdaValue: ebitdaResult.valueEv,
        earningsValue: earningsResult.valueEv,
        dcfValue: dcfResult.valueEv
      }
    }
  }
  
  private calculateWeights(profile: CompanyProfile) {
    // Base weights
    let revenueWeight = 0.3
    let ebitdaWeight = 0.3
    let earningsWeight = 0.2
    let dcfWeight = 0.2
    
    // Adjust based on company characteristics
    if (profile.netProfit > 0) {
      earningsWeight += 0.1
      dcfWeight += 0.1
    } else {
      earningsWeight = 0
      dcfWeight = 0
      revenueWeight += 0.1
      ebitdaWeight += 0.1
    }
    
    // High growth companies favor revenue/ebitda multiples
    if (profile.revenueGrowth > 0.15) {
      revenueWeight += 0.1
      ebitdaWeight += 0.1
      earningsWeight -= 0.1
      dcfWeight -= 0.1
    }
    
    // High margin companies favor earnings/DCF
    if (profile.netProfitMargin > 0.1) {
      earningsWeight += 0.1
      dcfWeight += 0.1
      revenueWeight -= 0.1
      ebitdaWeight -= 0.1
    }
    
    // Normalize weights
    const total = revenueWeight + ebitdaWeight + earningsWeight + dcfWeight
    return {
      revenue: revenueWeight / total,
      ebitda: ebitdaWeight / total,
      earnings: earningsWeight / total,
      dcf: dcfWeight / total
    }
  }
}

/**
 * Run all valuation models for a company
 */
export function runValuations(
  profile: CompanyProfile, 
  assumptions: ValuationAssumptions[]
): ValuationOutput[] {
  const models: ValuationModel[] = [
    new RevenueMultipleModel(),
    new EbitdaMultipleModel(),
    new EarningsMultipleModel(),
    new DcfLiteModel(),
    new HybridScoreModel()
  ]
  
  const results: ValuationOutput[] = []
  
  for (const model of models) {
    // Find assumptions for this model
    const modelAssumptions = assumptions.find(a => a.modelKey === model.key)
    if (!modelAssumptions) {
      console.warn(`No assumptions found for model ${model.key}`)
      continue
    }
    
    try {
      const result = model.compute(profile, modelAssumptions)
      results.push(result)
    } catch (error) {
      console.error(`Error computing ${model.key}:`, error)
      results.push({
        modelKey: model.key,
        modelName: model.name,
        valueEv: null,
        valueEquity: null,
        basis: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        multipleUsed: null,
        confidence: 0,
        inputs: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  }
  
  return results
}

/**
 * Create company profile from master analytics data
 */
export function createCompanyProfile(data: any): CompanyProfile {
  // Determine size bucket
  let sizeBucket: 'small' | 'medium' | 'large' = 'small'
  if (data.SDI > 50000000) sizeBucket = 'large'
  else if (data.SDI > 10000000) sizeBucket = 'medium'
  
  // Determine growth bucket
  let growthBucket: 'low' | 'medium' | 'high' = 'low'
  if (data.Revenue_growth > 0.15) growthBucket = 'high'
  else if (data.Revenue_growth > 0.05) growthBucket = 'medium'
  
  return {
    orgnr: data.OrgNr,
    name: data.name,
    industry: data.segment_name || 'Okänd',
    sizeBucket,
    growthBucket,
    revenue: data.SDI || 0,
    netProfit: data.DR || 0,
    ebitda: data.ORS, // Use ORS as EBITDA proxy
    revenueGrowth: data.Revenue_growth || 0,
    ebitMargin: data.EBIT_margin || 0,
    netProfitMargin: data.NetProfit_margin || 0,
    employees: data.employees || 0
  }
}
