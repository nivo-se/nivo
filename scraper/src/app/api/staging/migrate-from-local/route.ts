import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '../../../lib/db/local-staging';
import { supabase } from '../../../lib/db';

export async function POST(request: NextRequest) {
  try {
    const { jobId, includeWarnings = false, skipDuplicates = true } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting migration from local staging to Supabase for job ${jobId}...`);

    // Initialize local staging database
    const stagingDB = new LocalStagingDB(jobId);
    
    // Get validated financial records from local staging
    const financialRecords = stagingDB.getValidFinancials(jobId, includeWarnings);
    
    if (financialRecords.length === 0) {
      stagingDB.close();
      return NextResponse.json({
        message: 'No valid records to migrate',
        migrated: 0,
        skipped: 0,
        errors: 0,
      });
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
        source_table: 'local_staging_financials',
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

    // Close staging database
    stagingDB.close();

    return NextResponse.json({
      message: 'Migration from local staging completed',
      migrated,
      skipped,
      errors,
      report: migrationReport,
    });

  } catch (error: any) {
    console.error('Error in migration endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get migration history for the job
    const { data: migrations, error } = await supabase
      .from('migration_log')
      .select('*')
      .eq('job_id', jobId)
      .order('started_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      migrations: migrations || [],
    });

  } catch (error: any) {
    console.error('Error in migration history endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
