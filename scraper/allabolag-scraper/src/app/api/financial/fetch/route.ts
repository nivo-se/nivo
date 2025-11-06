import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { LocalStagingDB } from '@/lib/db/local-staging';
import { filterHash } from '@/lib/hash';
import { getBuildId, fetchFinancialData, withSession } from '@/lib/allabolag';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting financial data fetching job...');
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      );
    }
    
    console.log('Source job ID:', jobId);
    
    // Work directly with the existing session database
    const localDb = new LocalStagingDB(jobId);
    
    // Update the existing job to show Stage 3 is starting
    localDb.updateJob(jobId, {
      stage: 'stage3_financials',
      status: 'running'
    });
    
    console.log('Starting Stage 3 financial data fetch for existing job');
    
    // Start processing in background
    processFinancialJob(jobId, localDb).catch(async (error: unknown) => {
      console.error('Financial job failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      localDb.updateJob(jobId, { 
        status: 'error', 
        lastError: message
      });
    });
    
    return NextResponse.json({ jobId: jobId });
  } catch (error: unknown) {
    console.error('Error starting financial job:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to start financial job',
        details: message
      },
      { status: 500 }
    );
  }
}

async function processFinancialJob(jobId: string, localDb: LocalStagingDB) {
  return withSession(async (session: any) => {
    const buildId = await getBuildId(session);
    const batchSize = 100; // Increased from 50 for better throughput
    const concurrency = 20; // Limited to 20 to stay within free plan's concurrent session limit
    let totalProcessed = 0;
    let iterationCount = 0;
    const maxIterations = 1000; // Safety limit to prevent infinite loops
    
    console.log(`Starting Stage 3 financial data fetch for job ${jobId} with buildId: ${buildId}`);
  
    while (iterationCount < maxIterations) {
      iterationCount++;
      
      // Check if job has been stopped or paused
      const jobStatus = localDb.getJob(jobId);
      if (jobStatus && (jobStatus.status === 'stopped' || jobStatus.status === 'paused')) {
        console.log(`Job ${jobId} is ${jobStatus.status}, stopping financial fetch`);
        break;
      }
      
      // Get batch of companies with resolved company IDs that haven't been processed yet
      // Only process companies that are pending or resolved (not already processed)
      let companyIds = localDb.getCompanyIdsToProcess(jobId, 'pending');
      
      if (companyIds.length === 0) {
        companyIds = localDb.getCompanyIdsToProcess(jobId, 'resolved');
      }
      
      // If no pending/resolved companies, check for companies marked as 'error' or 'no_financials'
      // that need to be retried (could have been marked incorrectly due to previous bugs)
      if (companyIds.length === 0) {
        const stats = localDb.getJobStats(jobId);
        
        // Get all company IDs to check their statuses
        const allCompanyIds = localDb.getCompanyIds(jobId);
        console.log(`No pending/resolved companies found. Checking status of ${allCompanyIds.length} total company IDs...`);
        
        // Check status distribution
        const statusCounts: Record<string, number> = {};
        allCompanyIds.forEach((cid: any) => {
          const status = cid.status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        console.log(`Company ID status distribution:`, statusCounts);
        
        // Retry companies with error or no_financials status
        // Even if we have some financials, companies marked as 'error' should be retried
        // This fixes cases where schema errors prevented data from being saved
        const errorIds = localDb.getCompanyIdsToProcess(jobId, 'error');
        const noFinancialsIds = localDb.getCompanyIdsToProcess(jobId, 'no_financials');
        console.log(`Found ${errorIds.length} companies marked as 'error' and ${noFinancialsIds.length} as 'no_financials'`);
        
        const allRetryIds = [...errorIds, ...noFinancialsIds];
        if (allRetryIds.length > 0) {
          console.log(`Retrying ${allRetryIds.length} companies with error/no_financials status (${errorIds.length} errors, ${noFinancialsIds.length} no_financials)`);
          // Reset their status to 'resolved' so they can be retried
          const idsToRetry = allRetryIds.slice(0, batchSize);
          for (const cid of idsToRetry) {
            localDb.updateCompanyIdStatus(jobId, cid.orgnr, 'resolved', undefined);
            console.log(`Reset company ${cid.orgnr} status from '${cid.status}' to 'resolved' for retry`);
          }
          companyIds = idsToRetry;
        } else {
          // All companies might have status 'resolved' - try fetching them anyway
          const resolvedIds = allCompanyIds.filter((cid: any) => cid.status === 'resolved' || !cid.status);
          if (resolvedIds.length > 0) {
            console.log(`No error/no_financials companies found, but ${resolvedIds.length} companies have status 'resolved'. Processing them.`);
            companyIds = resolvedIds.slice(0, batchSize);
          }
        }
      }
      
      // If still no companies to process, check if all are truly done
      if (companyIds.length === 0) {
        const allCompanyIds = localDb.getCompanyIds(jobId);
        const stats = localDb.getJobStats(jobId);
        
        if (allCompanyIds.length === 0) {
          console.log('No company IDs found for financial data processing');
          break;
        }
        
        // Only consider done if we have financials OR all companies have been fetched successfully
        const financialsFetchedCount = allCompanyIds.filter((cid: any) => 
          cid.status === 'financials_fetched'
        ).length;
        
        if (stats.financials > 0 || financialsFetchedCount >= allCompanyIds.length) {
          console.log(`Financial data processing complete. Companies: ${stats.companies}, Financials: ${stats.financials}, Fetched: ${financialsFetchedCount}`);
          break;
        }
        
        // If no financials and not all fetched, something is wrong - break to avoid infinite loop
        console.log(`No pending company IDs and no financials found. Total: ${allCompanyIds.length}, Financials: ${stats.financials}`);
        break;
      }
      
      const companiesToProcess = companyIds.slice(0, batchSize);
      console.log(`Processing batch of ${companiesToProcess.length} companies for financial data (iteration ${iterationCount})`);
      
      // Process in chunks with controlled concurrency
      const chunks: any[] = [];
      for (let i = 0; i < companiesToProcess.length; i += concurrency) {
        chunks.push(companiesToProcess.slice(i, i + concurrency));
      }
      
      for (const chunk of chunks) {
        const promises = chunk.map(async (companyIdRecord: any) => {
          try {
            // Get the full company data from the staging_companies table
            const companyData = localDb.getCompanyByOrgnr(jobId, companyIdRecord.orgnr);
            
            if (!companyData) {
              console.log(`No company data found for orgnr ${companyIdRecord.orgnr}`);
              localDb.updateCompanyIdStatus(jobId, companyIdRecord.orgnr, 'no_company_data');
              return { processed: true, financialsCount: 0 };
            }
            
            // Fetch financial data for this company
            const financialData = await fetchCompanyFinancials(buildId, companyData, companyIdRecord.company_id, session);
            
            if (financialData && financialData.length > 0) {
              // Store financial data in local database
              // Map account codes to expected fields: sdi -> revenue, dr -> profit
              const financialsToInsert = financialData.map((financial: any) => ({
                id: `${companyIdRecord.company_id}_${financial.year}_${financial.period}`,
                companyId: companyIdRecord.company_id,
                orgnr: companyIdRecord.orgnr,
                year: financial.year,
                period: financial.period,
                periodStart: financial.periodStart,
                periodEnd: financial.periodEnd,
                currency: financial.currency || 'SEK',
                revenue: financial.sdi || financial.revenue || null, // SDI is revenue
                profit: financial.dr || financial.profit || null,   // DR is net profit
                employees: financial.additionalCompanyData?.employees || financial.employees || null,
                be: financial.be || null,
                tr: financial.tr || null,
                // Store COMPLETE raw JSON response from Allabolag.se
                // This includes all account codes, company data, and metadata
                rawData: JSON.stringify(financial.completeRawData || financial.rawData || {
                  // Fallback: include all extracted account codes if complete raw data not available
                  sdi: financial.sdi || null,
                  dr: financial.dr || null,
                  ors: financial.ors || null,
                  rg: financial.rg || null,
                  ek: financial.ek || null,
                  fk: financial.fk || null,
                  adi: financial.adi || null,
                  adk: financial.adk || null,
                  adr: financial.adr || null,
                  ak: financial.ak || null,
                  ant: financial.ant || null,
                  fi: financial.fi || null,
                  gg: financial.gg || null,
                  kbp: financial.kbp || null,
                  lg: financial.lg || null,
                  sap: financial.sap || null,
                  sed: financial.sed || null,
                  si: financial.si || null,
                  sek: financial.sek || null,
                  sf: financial.sf || null,
                  sfa: financial.sfa || null,
                  sge: financial.sge || null,
                  sia: financial.sia || null,
                  sik: financial.sik || null,
                  skg: financial.skg || null,
                  skgki: financial.skgki || null,
                  sko: financial.sko || null,
                  slg: financial.slg || null,
                  som: financial.som || null,
                  sub: financial.sub || null,
                  sv: financial.sv || null,
                  svd: financial.svd || null,
                  utr: financial.utr || null,
                  fsd: financial.fsd || null,
                  kb: financial.kb || null,
                  awa: financial.awa || null,
                  iac: financial.iac || null,
                  min: financial.min || null,
                  be: financial.be || null,
                  tr: financial.tr || null,
                  additionalCompanyData: financial.additionalCompanyData || null
                }),
                validationStatus: 'pending',
                scrapedAt: new Date().toISOString(),
                jobId: jobId,
                updatedAt: new Date().toISOString()
              }));
              
              localDb.insertFinancials(financialsToInsert);
              
              // Update company ID status
              localDb.updateCompanyIdStatus(jobId, companyIdRecord.orgnr, 'financials_fetched');
              
              console.log(`Fetched ${financialData.length} financial records for company ${companyIdRecord.company_id}`);
              return { processed: true, financialsCount: financialData.length };
            } else {
              console.log(`No financial data found for company ${companyIdRecord.company_id}`);
              localDb.updateCompanyIdStatus(jobId, companyIdRecord.orgnr, 'no_financials');
              return { processed: true, financialsCount: 0 };
            }
            
          } catch (error: any) {
            console.error(`❌ Error fetching financials for company ${companyIdRecord.company_id}:`, error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            
            // Check if it's a proxy error - stop job
            if (error.message?.includes('Oxylabs proxy') || error.message?.includes('proxy')) {
              console.error('❌ Proxy error detected - stopping job');
              localDb.updateJob(jobId, {
                status: 'error',
                lastError: `Proxy error: ${error.message}`,
                updatedAt: new Date().toISOString()
              });
              throw new Error(`Proxy error: ${error.message}. Job stopped. Fix proxy and resume job.`);
            }
            
            localDb.updateCompanyIdStatus(jobId, companyIdRecord.orgnr, 'error', message);
            return { processed: true, financialsCount: 0 };
          }
        });
        
        const results = await Promise.all(promises);
        const chunkProcessed = results.filter(r => r?.processed).length;
        totalProcessed += chunkProcessed;
        
        // Update job progress more frequently
        const stats = localDb.getJobStats(jobId);
        localDb.updateJob(jobId, {
          processedCount: totalProcessed,
          updatedAt: new Date().toISOString()
        });
        
        console.log(`Processed ${chunkProcessed} companies, total: ${totalProcessed}, financials: ${stats.financials}`);
        
        // No delay - proxy handles rate limiting and we need maximum throughput
      }
      
      // Update stats after each batch
      const stats = localDb.getJobStats(jobId);
      console.log(`Progress update: ${stats.companies} companies, ${stats.companyIds} company IDs, ${stats.financials} financial records`);
    }
    
    // Mark job as done
    const finalStats = localDb.getJobStats(jobId);
    localDb.updateJob(jobId, { 
      status: 'done',
      stage: 'stage3_financials',
      processedCount: totalProcessed,
      updatedAt: new Date().toISOString()
    });
  
    console.log(`Stage 3 financial data fetch for job ${jobId} completed. Processed ${totalProcessed} companies, ${finalStats.financials} financial records`);
  });
}

async function fetchCompanyFinancials(buildId: string, companyData: any, companyId: string, session: any) {
  try {
    console.log(`Fetching financial data for company ${companyData.companyName} (${companyData.orgnr}) - Company ID: ${companyId}`);
    
    // Add the companyId to the companyData for fetchFinancialData
    const enrichedCompanyData = {
      ...companyData,
      companyId: companyId,
      company_name: companyData.companyName || companyData.company_name,
      segment_name: companyData.segmentName || companyData.segment_name || companyData.naceCategories?.[0] || ''
    };
    
    // Use the real fetchFinancialData function from allabolag.ts
    const { fetchFinancialData } = await import('@/lib/allabolag');
    const financialData = await fetchFinancialData(buildId, enrichedCompanyData, session);
    
    console.log(`Fetched ${financialData.length} financial records for company ${companyData.companyName} (${companyData.orgnr})`);
    return financialData;
  } catch (error: unknown) {
    console.error(`Error fetching financial data for company ${companyData.companyName} (${companyData.orgnr}):`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', message);
    throw error;
  }
}
