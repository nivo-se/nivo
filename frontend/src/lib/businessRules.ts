// =====================================================
// BUSINESS RULES AND THRESHOLDS CONFIGURATION
// This file contains all the business logic definitions
// for categorizing companies and calculating metrics
// =====================================================

export interface BusinessRules {
  profitability: {
    high: { min: number; description: string }
    good: { min: number; description: string }
    low: { min: number; description: string }
    loss: { min: number; description: string }
  }
  growth: {
    high: { min: number; description: string }
    medium: { min: number; description: string }
    low: { min: number; description: string }
    declining: { min: number; description: string }
    rapidDecline: { min: number; description: string }
  }
  companySize: {
    micro: { maxRevenue: number; maxEmployees: number; description: string }
    small: { maxRevenue: number; maxEmployees: number; description: string }
    medium: { maxRevenue: number; maxEmployees: number; description: string }
    large: { minRevenue: number; minEmployees: number; description: string }
  }
  employeeSize: {
    micro: { max: number; description: string }
    small: { max: number; description: string }
    medium: { max: number; description: string }
    large: { max: number; description: string }
    enterprise: { min: number; description: string }
  }
}

// Default business rules - can be easily adjusted
export const DEFAULT_BUSINESS_RULES: BusinessRules = {
  profitability: {
    high: {
      min: 0.15, // 15% minimum EBIT margin
      description: "Companies with EBIT margin ≥ 15%"
    },
    good: {
      min: 0.05, // 5% minimum EBIT margin
      description: "Companies with EBIT margin 5-15%"
    },
    low: {
      min: 0.0, // 0% minimum EBIT margin
      description: "Companies with EBIT margin 0-5%"
    },
    loss: {
      min: -1.0, // Negative EBIT margin
      description: "Companies with negative EBIT margin"
    }
  },
  growth: {
    high: {
      min: 0.20, // 20% minimum growth
      description: "Companies with revenue growth ≥ 20%"
    },
    medium: {
      min: 0.05, // 5% minimum growth
      description: "Companies with revenue growth 5-20%"
    },
    low: {
      min: 0.0, // 0% minimum growth
      description: "Companies with revenue growth 0-5%"
    },
    declining: {
      min: -0.10, // -10% minimum (declining)
      description: "Companies with revenue decline 0-10%"
    },
    rapidDecline: {
      min: -1.0, // More than -10% decline
      description: "Companies with revenue decline > 10%"
    }
  },
  companySize: {
    micro: {
      maxRevenue: 2000000, // 2M SEK max
      maxEmployees: 10,
      description: "Companies with < 2M SEK revenue and < 10 employees"
    },
    small: {
      maxRevenue: 10000000, // 10M SEK max
      maxEmployees: 50,
      description: "Companies with 2-10M SEK revenue and 10-50 employees"
    },
    medium: {
      maxRevenue: 50000000, // 50M SEK max
      maxEmployees: 250,
      description: "Companies with 10-50M SEK revenue and 50-250 employees"
    },
    large: {
      minRevenue: 50000000, // 50M SEK min
      minEmployees: 250,
      description: "Companies with > 50M SEK revenue and > 250 employees"
    }
  },
  employeeSize: {
    micro: {
      max: 10,
      description: "1-10 employees"
    },
    small: {
      max: 50,
      description: "11-50 employees"
    },
    medium: {
      max: 200,
      description: "51-200 employees"
    },
    large: {
      max: 500,
      description: "201-500 employees"
    },
    enterprise: {
      min: 500,
      description: "500+ employees"
    }
  }
}

// =====================================================
// CATEGORIZATION FUNCTIONS
// =====================================================

export class BusinessRulesEngine {
  private rules: BusinessRules

  constructor(rules: BusinessRules = DEFAULT_BUSINESS_RULES) {
    this.rules = rules
  }

  // Update rules (for future admin panel functionality)
  updateRules(newRules: Partial<BusinessRules>) {
    this.rules = { ...this.rules, ...newRules }
  }

  // Get current rules
  getRules(): BusinessRules {
    return this.rules
  }

  // Categorize profitability based on EBIT margin
  getProfitabilityCategory(ebitMargin: number | null): string {
    if (ebitMargin === null || isNaN(ebitMargin)) return 'Unknown'
    
    if (ebitMargin >= this.rules.profitability.high.min) return 'High Profitability'
    if (ebitMargin >= this.rules.profitability.good.min) return 'Good Profitability'
    if (ebitMargin >= this.rules.profitability.low.min) return 'Low Profitability'
    return 'Loss Making'
  }

  // Categorize growth based on revenue growth
  getGrowthCategory(revenueGrowth: number | null): string {
    if (revenueGrowth === null || isNaN(revenueGrowth)) return 'Unknown'
    
    if (revenueGrowth >= this.rules.growth.high.min) return 'High Growth'
    if (revenueGrowth >= this.rules.growth.medium.min) return 'Medium Growth'
    if (revenueGrowth >= this.rules.growth.low.min) return 'Low Growth'
    if (revenueGrowth >= this.rules.growth.declining.min) return 'Declining'
    return 'Rapid Decline'
  }

  // Categorize company size (this would need revenue data, which we don't have reliably)
  getCompanySizeCategory(revenue: string | null, employees: string | null): string {
    // Since revenue data is mostly null, we'll use employees as primary indicator
    const empCount = this.parseNumber(employees)
    if (empCount === null) return 'Unknown'
    
    if (empCount <= this.rules.employeeSize.micro.max) return 'Micro'
    if (empCount <= this.rules.employeeSize.small.max) return 'Small'
    if (empCount <= this.rules.employeeSize.medium.max) return 'Medium'
    if (empCount <= this.rules.employeeSize.large.max) return 'Large'
    return 'Enterprise'
  }

  // Categorize employee size
  getEmployeeSizeCategory(employees: string | null): string {
    const empCount = this.parseNumber(employees)
    if (empCount === null) return 'Unknown'
    
    if (empCount <= this.rules.employeeSize.micro.max) return '1-10'
    if (empCount <= this.rules.employeeSize.small.max) return '11-50'
    if (empCount <= this.rules.employeeSize.medium.max) return '51-200'
    if (empCount <= this.rules.employeeSize.large.max) return '201-500'
    return '500+'
  }

  // Helper function to parse string numbers
  private parseNumber(value: string | null): number | null {
    if (!value) return null
    const parsed = parseFloat(value)
    return isNaN(parsed) ? null : parsed
  }

  // Get category descriptions for UI
  getCategoryDescriptions() {
    return {
      profitability: {
        'High Profitability': this.rules.profitability.high.description,
        'Good Profitability': this.rules.profitability.good.description,
        'Low Profitability': this.rules.profitability.low.description,
        'Loss Making': this.rules.profitability.loss.description
      },
      growth: {
        'High Growth': this.rules.growth.high.description,
        'Medium Growth': this.rules.growth.medium.description,
        'Low Growth': this.rules.growth.low.description,
        'Declining': this.rules.growth.declining.description,
        'Rapid Decline': this.rules.growth.rapidDecline.description
      },
      companySize: {
        'Micro': this.rules.companySize.micro.description,
        'Small': this.rules.companySize.small.description,
        'Medium': this.rules.companySize.medium.description,
        'Large': this.rules.companySize.large.description
      },
      employeeSize: {
        '1-10': this.rules.employeeSize.micro.description,
        '11-50': this.rules.employeeSize.small.description,
        '51-200': this.rules.employeeSize.medium.description,
        '201-500': this.rules.employeeSize.large.description,
        '500+': this.rules.employeeSize.enterprise.description
      }
    }
  }

  // Get thresholds for display
  getThresholds() {
    return {
      profitability: {
        high: `${(this.rules.profitability.high.min * 100).toFixed(1)}%`,
        good: `${(this.rules.profitability.good.min * 100).toFixed(1)}%`,
        low: `${(this.rules.profitability.low.min * 100).toFixed(1)}%`
      },
      growth: {
        high: `${(this.rules.growth.high.min * 100).toFixed(1)}%`,
        medium: `${(this.rules.growth.medium.min * 100).toFixed(1)}%`,
        low: `${(this.rules.growth.low.min * 100).toFixed(1)}%`,
        declining: `${(this.rules.growth.declining.min * 100).toFixed(1)}%`
      },
      companySize: {
        micro: `Revenue < ${(this.rules.companySize.micro.maxRevenue / 1000000).toFixed(1)}M SEK, Employees ≤ ${this.rules.companySize.micro.maxEmployees}`,
        small: `Revenue ${(this.rules.companySize.micro.maxRevenue / 1000000).toFixed(1)}-${(this.rules.companySize.small.maxRevenue / 1000000).toFixed(1)}M SEK, Employees ${this.rules.companySize.micro.maxEmployees + 1}-${this.rules.companySize.small.maxEmployees}`,
        medium: `Revenue ${(this.rules.companySize.small.maxRevenue / 1000000).toFixed(1)}-${(this.rules.companySize.medium.maxRevenue / 1000000).toFixed(1)}M SEK, Employees ${this.rules.companySize.small.maxEmployees + 1}-${this.rules.companySize.medium.maxEmployees}`,
        large: `Revenue > ${(this.rules.companySize.large.minRevenue / 1000000).toFixed(1)}M SEK, Employees > ${this.rules.companySize.large.minEmployees}`
      }
    }
  }
}

// Create a singleton instance
export const businessRulesEngine = new BusinessRulesEngine()

// Export for easy access
export default businessRulesEngine










