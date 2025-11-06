import { ValidationResult, ValidationRule, StagingFinancial } from '../providers/base';

export class DataValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * Initialize validation rules
   */
  private initializeRules(): void {
    this.rules = [
      // Required fields validation
      {
        name: 'required_fields',
        validate: (data: StagingFinancial) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (!data.company_id) {
            errors.push('Company ID is required');
          }
          if (!data.orgnr) {
            errors.push('Organization number is required');
          }
          if (!data.year) {
            errors.push('Year is required');
          }
          if (!data.period) {
            errors.push('Period is required');
          }

          return {
            status: errors.length > 0 ? 'invalid' : 'valid',
            errors,
            warnings,
          };
        }
      },

      // Year validation
      {
        name: 'year_range',
        validate: (data: StagingFinancial) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (data.year < 2000 || data.year > new Date().getFullYear() + 1) {
            errors.push(`Year ${data.year} is outside valid range (2000-${new Date().getFullYear() + 1})`);
          }

          if (data.year < 2010) {
            warnings.push(`Year ${data.year} is quite old, data might be outdated`);
          }

          return {
            status: errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
            errors,
            warnings,
          };
        }
      },

      // Revenue validation (SDI)
      {
        name: 'revenue_validation',
        validate: (data: StagingFinancial) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (data.sdi !== null && data.sdi !== undefined) {
            if (data.sdi < 0) {
              errors.push('Revenue (SDI) cannot be negative');
            } else if (data.sdi === 0) {
              warnings.push('Revenue (SDI) is zero - company might be inactive');
            } else if (data.sdi > 1000000000) { // 1 billion SEK
              warnings.push('Revenue (SDI) is very high - please verify');
            }
          } else {
            warnings.push('Revenue (SDI) is missing');
          }

          return {
            status: errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
            errors,
            warnings,
          };
        }
      },

      // Profit validation (DR)
      {
        name: 'profit_validation',
        validate: (data: StagingFinancial) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (data.dr !== null && data.dr !== undefined) {
            if (data.dr > 1000000000) { // 1 billion SEK
              warnings.push('Net profit (DR) is very high - please verify');
            }
            // Negative profit is allowed (losses)
          }

          return {
            status: errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
            errors,
            warnings,
          };
        }
      },

      // EBITDA validation (ORS)
      {
        name: 'ebitda_validation',
        validate: (data: StagingFinancial) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (data.ors !== null && data.ors !== undefined) {
            if (data.ors > 1000000000) { // 1 billion SEK
              warnings.push('EBITDA (ORS) is very high - please verify');
            }
          }

          return {
            status: errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
            errors,
            warnings,
          };
        }
      },

      // Equity validation (EK)
      {
        name: 'equity_validation',
        validate: (data: StagingFinancial) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (data.ek !== null && data.ek !== undefined) {
            if (data.ek < -1000000000) { // -1 billion SEK
              warnings.push('Equity (EK) is very negative - company might be in financial distress');
            } else if (data.ek > 1000000000) { // 1 billion SEK
              warnings.push('Equity (EK) is very high - please verify');
            }
          }

          return {
            status: errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
            errors,
            warnings,
          };
        }
      },

      // Consistency checks
      {
        name: 'consistency_checks',
        validate: (data: StagingFinancial) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          // Check if all key financial metrics are zero (might indicate incomplete data)
          const keyMetrics = [data.sdi, data.dr, data.ors, data.ek];
          const zeroCount = keyMetrics.filter(m => m === 0).length;
          
          if (zeroCount === keyMetrics.length) {
            warnings.push('All key financial metrics are zero - data might be incomplete');
          }

          // Check for unrealistic ratios
          if (data.sdi && data.sdi > 0 && data.dr && data.dr > 0) {
            const profitMargin = (data.dr / data.sdi) * 100;
            if (profitMargin > 50) {
              warnings.push(`Profit margin is very high (${profitMargin.toFixed(1)}%) - please verify`);
            }
          }

          return {
            status: errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
            errors,
            warnings,
          };
        }
      },

      // Currency validation
      {
        name: 'currency_validation',
        validate: (data: StagingFinancial) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (data.currency && data.currency !== 'SEK') {
            warnings.push(`Currency is ${data.currency}, expected SEK`);
          }

          return {
            status: errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
            errors,
            warnings,
          };
        }
      }
    ];
  }

  /**
   * Validate a single financial record
   */
  validateRecord(data: StagingFinancial): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let overallStatus: 'valid' | 'warning' | 'invalid' = 'valid';

    for (const rule of this.rules) {
      const result = rule.validate(data);
      
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      
      // Overall status is the most severe
      if (result.status === 'invalid') {
        overallStatus = 'invalid';
      } else if (result.status === 'warning' && overallStatus === 'valid') {
        overallStatus = 'warning';
      }
    }

    return {
      status: overallStatus,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Validate multiple records
   */
  validateRecords(records: StagingFinancial[]): {
    valid: StagingFinancial[];
    warnings: StagingFinancial[];
    invalid: StagingFinancial[];
    summary: {
      total: number;
      valid: number;
      warnings: number;
      invalid: number;
    };
  } {
    const valid: StagingFinancial[] = [];
    const warnings: StagingFinancial[] = [];
    const invalid: StagingFinancial[] = [];

    for (const record of records) {
      const result = this.validateRecord(record);
      
      // Update the record with validation status
      record.validation_status = result.status;
      record.validation_errors = {
        errors: result.errors,
        warnings: result.warnings,
      };

      switch (result.status) {
        case 'valid':
          valid.push(record);
          break;
        case 'warning':
          warnings.push(record);
          break;
        case 'invalid':
          invalid.push(record);
          break;
      }
    }

    return {
      valid,
      warnings,
      invalid,
      summary: {
        total: records.length,
        valid: valid.length,
        warnings: warnings.length,
        invalid: invalid.length,
      },
    };
  }

  /**
   * Get validation summary for a job
   */
  async getValidationSummary(jobId: string): Promise<{
    total: number;
    valid: number;
    warnings: number;
    invalid: number;
    pending: number;
  }> {
    // This would typically query the database
    // For now, return a mock structure
    return {
      total: 0,
      valid: 0,
      warnings: 0,
      invalid: 0,
      pending: 0,
    };
  }

  /**
   * Add a custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a validation rule by name
   */
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
  }

  /**
   * Get all validation rules
   */
  getRules(): ValidationRule[] {
    return [...this.rules];
  }
}
