import { NextRequest, NextResponse } from 'next/server';
import { AllabolagFinancials } from '../../../providers/allabolag/financials';
import { LocalStagingDB } from '../../../lib/db/local-staging';

export async function POST(request: NextRequest) {
  try {
    const { jobId, batchSize = 50 } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting financial data fetch for job ${jobId}...`);

    // Initialize local staging database
    const stagingDB = new LocalStagingDB(jobId);
    
    // Get companies that need financial data
    const companiesToProcess = stagingDB.getCompanyIdsToProcess(jobId, 'id_resolved');
    
    if (companiesToProcess.length === 0) {
      return NextResponse.json({ 
        message: 'No companies need financial data processing',
        processed: 0,
        total: 0
      });
    }

    // Initialize financials fetcher
    const financialsFetcher = new AllabolagFinancials();
    
    let processedCount = 0;
    let errorCount = 0;
    const batch: any[] = [];

    // Process companies in batches
    for (const company of companiesToProcess.slice(0, batchSize)) {
      try {
        console.log(`Processing company ${company.company_id} (${company.orgnr})...`);
        
        // Fetch financial data
        const financialData = await financialsFetcher.fetchFinancials(company.company_id);
        
        if (financialData.length > 0) {
          // Prepare financial records for database
          for (const financial of financialData) {
            batch.push({
              id: crypto.randomUUID(),
              company_id: financial.companyId,
              orgnr: financial.orgnr,
              year: financial.year,
              period: financial.period,
              period_start: financial.periodStart,
              period_end: financial.periodEnd,
              currency: financial.currency,
              // Map account codes
              sdi: financial.accounts.SDI || null,
              dr: financial.accounts.DR || null,
              ors: financial.accounts.ORS || null,
              ek: financial.accounts.EK || null,
              adi: financial.accounts.ADI || null,
              adk: financial.accounts.ADK || null,
              adr: financial.accounts.ADR || null,
              ak: financial.accounts.AK || null,
              ant: financial.accounts.ANT || null,
              fi: financial.accounts.FI || null,
              fk: financial.accounts.FK || null,
              gg: financial.accounts.GG || null,
              kbp: financial.accounts.KBP || null,
              lg: financial.accounts.LG || null,
              rg: financial.accounts.RG || null,
              sap: financial.accounts.SAP || null,
              sed: financial.accounts.SED || null,
              si: financial.accounts.SI || null,
              sek: financial.accounts.SEK || null,
              sf: financial.accounts.SF || null,
              sfa: financial.accounts.SFA || null,
              sge: financial.accounts.SGE || null,
              sia: financial.accounts.SIA || null,
              sik: financial.accounts.SIK || null,
              skg: financial.accounts.SKG || null,
              skgki: financial.accounts.SKGKI || null,
              sko: financial.accounts.SKO || null,
              slg: financial.accounts.SLG || null,
              som: financial.accounts.SOM || null,
              sub: financial.accounts.SUB || null,
              sv: financial.accounts.SV || null,
              svd: financial.accounts.SVD || null,
              utr: financial.accounts.UTR || null,
              fsd: financial.accounts.FSD || null,
              kb: financial.accounts.KB || null,
              awa: financial.accounts.AWA || null,
              iac: financial.accounts.IAC || null,
              min: financial.accounts.MIN || null,
              be: financial.accounts.BE || null,
              tr: financial.accounts.TR || null,
              raw_data: financial.rawData,
              validation_status: 'pending',
              scraped_at: new Date().toISOString(),
              job_id: jobId,
            });
          }

          // Mark company as processed
          stagingDB.updateCompanyIdStatus(jobId, company.orgnr, 'financials_fetched');
          processedCount++;
        } else {
          console.log(`No financial data found for company ${company.company_id}`);
          stagingDB.updateCompanyIdStatus(jobId, company.orgnr, 'financials_fetched');
          processedCount++;
        }

        // Save checkpoint every 10 companies
        if (processedCount % 10 === 0) {
          stagingDB.saveCheckpoint({
            id: crypto.randomUUID(),
            jobId,
            stage: 'stage3_financials',
            lastProcessedCompany: company.company_id,
            processedCount,
            errorCount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

      } catch (error: any) {
        console.error(`Error processing company ${company.company_id}:`, error);
        errorCount++;
        
        // Mark company as error
        stagingDB.updateCompanyIdStatus(jobId, company.orgnr, 'error', error.message);
      }
    }

    // Insert financial data batch to local staging
    if (batch.length > 0) {
      stagingDB.insertFinancials(batch);
      console.log(`Inserted ${batch.length} financial records to local staging`);
    }

    // Update job progress in local staging
    stagingDB.updateJob(jobId, {
      processed_count: processedCount,
      error_count: errorCount,
      rate_limit_stats: JSON.stringify(financialsFetcher.getRateLimitStats()),
    });

    // Save final checkpoint
    stagingDB.saveCheckpoint({
      id: crypto.randomUUID(),
      jobId,
      stage: 'stage3_financials',
      processedCount,
      errorCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Close staging database
    stagingDB.close();

    return NextResponse.json({
      message: 'Financial data fetch completed',
      processed: processedCount,
      total: companiesToProcess.length,
      errors: errorCount,
      financialRecords: batch.length,
      rateLimitStats: financialsFetcher.getRateLimitStats(),
    });

  } catch (error: any) {
    console.error('Error in financial fetch endpoint:', error);
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

    // Get job progress
    const { data: jobData, error: jobError } = await supabase
      .from('scraper_staging_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !jobData) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get financial data count
    const { count: financialCount, error: financialError } = await supabase
      .from('scraper_staging_financials')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId);

    if (financialError) {
      console.error('Error getting financial count:', financialError);
    }

    // Get companies with financial data
    const { count: companiesWithFinancials, error: companiesError } = await supabase
      .from('scraper_staging_company_ids')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .eq('status', 'financials_fetched');

    if (companiesError) {
      console.error('Error getting companies count:', companiesError);
    }

    return NextResponse.json({
      job: jobData,
      progress: {
        totalCompanies: jobData.total_companies || 0,
        processedCompanies: jobData.processed_count || 0,
        companiesWithFinancials: companiesWithFinancials || 0,
        financialRecords: financialCount || 0,
        errorCount: jobData.error_count || 0,
      },
      rateLimitStats: jobData.rate_limit_stats,
    });

  } catch (error: any) {
    console.error('Error in financial fetch status endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
