import { supabase } from '../lib/db';
import { DataValidator } from './validation';

export class StagingManager {
  private validator: DataValidator;

  constructor() {
    this.validator = new DataValidator();
  }

  /**
   * Validate all staging data for a job
   */
  async validateStagingData(jobId: string): Promise<{
    summary: {
      total: number;
      valid: number;
      warnings: number;
      invalid: number;
    };
    details: any[];
  }> {
    try {
      // Get all financial records for the job
      const { data: financialRecords, error } = await supabase
        .from('scraper_staging_financials')
        .select('*')
        .eq('job_id', jobId)
        .eq('validation_status', 'pending');

      if (error) {
        throw error;
      }

      if (!financialRecords || financialRecords.length === 0) {
        return {
          summary: { total: 0, valid: 0, warnings: 0, invalid: 0 },
          details: [],
        };
      }

      // Validate all records
      const validationResult = this.validator.validateRecords(financialRecords);

      // Update validation status in database
      const updates = financialRecords.map(record => ({
        id: record.id,
        validation_status: record.validation_status,
        validation_errors: record.validation_errors,
        updated_at: new Date().toISOString(),
      }));

      const { error: updateError } = await supabase
        .from('scraper_staging_financials')
        .upsert(updates);

      if (updateError) {
        console.error('Error updating validation status:', updateError);
      }

      return {
        summary: validationResult.summary,
        details: financialRecords,
      };
    } catch (error) {
      console.error('Error validating staging data:', error);
      throw error;
    }
  }

  /**
   * Migrate validated data to production tables
   */
  async migrateToProduction(jobId: string, options: {
    includeWarnings?: boolean;
    skipDuplicates?: boolean;
  } = {}): Promise<{
    migrated: number;
    skipped: number;
    errors: number;
    report: any;
  }> {
    const { includeWarnings = false, skipDuplicates = true } = options;

    try {
      // Get validated financial records
      let query = supabase
        .from('scraper_staging_financials')
        .select('*')
        .eq('job_id', jobId)
        .in('validation_status', includeWarnings ? ['valid', 'warning'] : ['valid']);

      const { data: financialRecords, error } = await query;

      if (error) {
        throw error;
      }

      if (!financialRecords || financialRecords.length === 0) {
        return {
          migrated: 0,
          skipped: 0,
          errors: 0,
          report: { message: 'No valid records to migrate' },
        };
      }

      let migrated = 0;
      let skipped = 0;
      let errors = 0;
      const migrationReport: any = {
        startTime: new Date().toISOString(),
        records: [],
      };

      // Process each record
      for (const record of financialRecords) {
        try {
          // Check for duplicates if skipDuplicates is enabled
          if (skipDuplicates) {
            const { data: existing, error: checkError } = await supabase
              .from('company_accounts_by_id')
              .select('companyId')
              .eq('companyId', record.company_id)
              .eq('year', record.year)
              .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
              throw checkError;
            }

            if (existing) {
              skipped++;
              migrationReport.records.push({
                companyId: record.company_id,
                year: record.year,
                status: 'skipped',
                reason: 'duplicate',
              });
              continue;
            }
          }

          // Prepare data for production table
          const productionData = {
            companyId: record.company_id,
            organisationNumber: record.orgnr,
            name: null, // Will be filled from master_analytics if needed
            year: record.year,
            period: record.period,
            periodStart: record.period_start,
            periodEnd: record.period_end,
            length: null,
            currency: record.currency,
            remark: null,
            referenceUrl: null,
            accIncompleteCode: null,
            accIncompleteDesc: null,
            // Map financial account codes
            ADI: record.adi,
            ADK: record.adk,
            ADR: record.adr,
            AK: record.ak,
            ANT: record.ant,
            DR: record.dr,
            EK: record.ek,
            EKA: null,
            FI: record.fi,
            FK: record.fk,
            GG: record.gg,
            KBP: record.kbp,
            LG: record.lg,
            ORS: record.ors,
            RG: record.rg,
            SAP: record.sap,
            SDI: record.sdi,
            SED: record.sed,
            SI: record.si,
            SEK: record.sek,
            SF: record.sf,
            SFA: record.sfa,
            SGE: record.sge,
            SIA: record.sia,
            SIK: record.sik,
            SKG: record.skg,
            SKGKI: record.skgki,
            SKO: record.sko,
            SLG: record.slg,
            SOM: record.som,
            SUB: record.sub,
            SV: record.sv,
            SVD: record.svd,
            UTR: record.utr,
            FSD: record.fsd,
            KB: record.kb,
            AWA: record.awa,
            IAC: record.iac,
            MIN: record.min,
            BE: record.be,
            TR: record.tr,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Insert into production table
          const { error: insertError } = await supabase
            .from('company_accounts_by_id')
            .insert(productionData);

          if (insertError) {
            throw insertError;
          }

          migrated++;
          migrationReport.records.push({
            companyId: record.company_id,
            year: record.year,
            status: 'migrated',
          });

        } catch (error: any) {
          errors++;
          console.error(`Error migrating record for company ${record.company_id}, year ${record.year}:`, error);
          migrationReport.records.push({
            companyId: record.company_id,
            year: record.year,
            status: 'error',
            error: error.message,
          });
        }
      }

      migrationReport.endTime = new Date().toISOString();
      migrationReport.summary = {
        migrated,
        skipped,
        errors,
        total: financialRecords.length,
      };

      // Log migration to migration_log table
      const { error: logError } = await supabase
        .from('migration_log')
        .insert({
          id: crypto.randomUUID(),
          job_id: jobId,
          source_table: 'scraper_staging_financials',
          target_table: 'company_accounts_by_id',
          records_processed: migrated,
          records_skipped: skipped,
          records_failed: errors,
          migration_report: migrationReport,
          status: errors > 0 ? 'completed_with_errors' : 'completed',
          started_at: migrationReport.startTime,
          completed_at: migrationReport.endTime,
        });

      if (logError) {
        console.error('Error logging migration:', logError);
      }

      return {
        migrated,
        skipped,
        errors,
        report: migrationReport,
      };

    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  }

  /**
   * Get staging data preview
   */
  async getStagingPreview(jobId: string, limit: number = 100): Promise<{
    companies: any[];
    financials: any[];
    summary: any;
  }> {
    try {
      // Get companies
      const { data: companies, error: companiesError } = await supabase
        .from('scraper_staging_companies')
        .select('*')
        .eq('job_id', jobId)
        .limit(limit);

      if (companiesError) {
        throw companiesError;
      }

      // Get financials
      const { data: financials, error: financialsError } = await supabase
        .from('scraper_staging_financials')
        .select('*')
        .eq('job_id', jobId)
        .limit(limit);

      if (financialsError) {
        throw financialsError;
      }

      // Get summary counts
      const { count: totalCompanies } = await supabase
        .from('scraper_staging_companies')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);

      const { count: totalFinancials } = await supabase
        .from('scraper_staging_financials')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);

      const { count: validFinancials } = await supabase
        .from('scraper_staging_financials')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('validation_status', 'valid');

      return {
        companies: companies || [],
        financials: financials || [],
        summary: {
          totalCompanies: totalCompanies || 0,
          totalFinancials: totalFinancials || 0,
          validFinancials: validFinancials || 0,
        },
      };
    } catch (error) {
      console.error('Error getting staging preview:', error);
      throw error;
    }
  }

  /**
   * Clear staging data for a job
   */
  async clearStagingData(jobId: string): Promise<void> {
    try {
      // Delete in order to respect foreign key constraints
      const tables = [
        'scraper_staging_financials',
        'scraper_staging_company_ids',
        'scraper_staging_companies',
        'scraper_staging_jobs',
        'scraper_checkpoints',
      ];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('job_id', jobId);

        if (error) {
          console.error(`Error clearing ${table}:`, error);
        }
      }

      console.log(`Cleared all staging data for job ${jobId}`);
    } catch (error) {
      console.error('Error clearing staging data:', error);
      throw error;
    }
  }
}
