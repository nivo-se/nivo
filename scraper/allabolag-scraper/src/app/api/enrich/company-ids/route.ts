import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { LocalStagingDB } from '@/lib/db/local-staging';
import { filterHash } from '@/lib/hash';
import { getBuildId, fetchSearchPage, withSession } from '@/lib/allabolag';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting enrichment job...');
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
    
    // Update the existing job to show Stage 2 is starting
    localDb.updateJob(jobId, {
      stage: 'stage2_enrichment',
      status: 'running'
    });
    
    console.log('Starting Stage 2 enrichment for existing job');
    
    // Start processing in background
    processEnrichmentJob(jobId, localDb).catch(async (error) => {
      console.error('Enrichment job failed:', error);
      localDb.updateJob(jobId, { 
        status: 'error', 
        lastError: error.message
      });
    });
    
    return NextResponse.json({ jobId: jobId });
  } catch (error) {
    console.error('Error starting enrichment job:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start enrichment job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function processEnrichmentJob(jobId: string, localDb: LocalStagingDB) {
  return withSession(async (session) => {
    const buildId = await getBuildId(session);
    const batchSize = 100; // Increased from 50 for better throughput
    const concurrency = 30; // Increased to 30 for VPN mode (no proxy rate limits)
    let processedCount = 0;
    
    console.log(`Starting Stage 2 enrichment for job ${jobId} with buildId: ${buildId}`);
    
    // Get companies from the existing job
    const companies = localDb.getCompanies(jobId);
    
    console.log(`Found ${companies.length} companies to enrich for job ${jobId}`);
    
    while (true) {
      // Get batch of companies that need company ID resolution
      // First try to get companies with 'pending' status, then any status
      let companiesToProcess = localDb.getCompaniesToProcess(jobId, 'pending');
      
      if (companiesToProcess.length === 0) {
        // If no pending companies, get all companies that don't have resolved company IDs
        const allCompanies = localDb.getCompanies(jobId);
        const existingCompanyIds = localDb.getCompanyIds(jobId);
        const resolvedOrgnrs = new Set(existingCompanyIds.map(ci => ci.orgnr));
        
        companiesToProcess = allCompanies.filter(company => !resolvedOrgnrs.has(company.orgnr));
        
        if (companiesToProcess.length === 0) {
          console.log('No more companies to enrich');
          break;
        }
      }
      
      const companiesToEnrich = companiesToProcess.slice(0, batchSize);
      console.log(`Processing batch of ${companiesToEnrich.length} companies for company ID resolution`);
      
      // Process in chunks with controlled concurrency
      const chunks: any[] = [];
      for (let i = 0; i < companiesToEnrich.length; i += concurrency) {
        chunks.push(companiesToEnrich.slice(i, i + concurrency));
      }
      
      for (const chunk of chunks) {
        // Process companies concurrently within chunk
        const promises = chunk.map(async (company: any) => {
          try {
            console.log(`Resolving company ID for ${company.companyName} (${company.orgnr})`);
            
            // Search Allabolag.se directly for the company ID
            try {
              console.log(`Searching Allabolag.se for company ID: ${company.companyName} (${company.orgnr})`);
              
              // Search for the company using its name to get the real company ID
              const searchResults = await fetchSearchPage(buildId, company.companyName, session);
            
              // Extract companies from the correct path in the search results
              const companies = searchResults?.pageProps?.hydrationData?.searchStore?.companies?.companies || 
                               searchResults?.pageProps?.companies || [];
              
              console.log(`Found ${companies.length} companies in search results for ${company.companyName}`);
              
              // Find the company that matches our orgnr
              const matchingCompany = companies.find((c: any) => 
                c.orgnr === company.orgnr || c.organisationNumber === company.orgnr
              );
              
              if (matchingCompany) {
                // Extract company ID from the search results
                const realCompanyId = matchingCompany.companyId || matchingCompany.listingId;
                
                console.log(`Matching company found:`, {
                  name: matchingCompany.name,
                  orgnr: matchingCompany.orgnr,
                  companyId: matchingCompany.companyId,
                  listingId: matchingCompany.listingId
                });
                
                if (realCompanyId) {
                  console.log(`Found company ID: ${realCompanyId} for ${company.companyName} (${company.orgnr})`);
                  
                  // Insert the resolved company ID
                  const companyIdRecord = {
                    orgnr: company.orgnr,
                    companyId: realCompanyId,
                    source: 'allabolag_search',
                    confidenceScore: '1.0',
                    scrapedAt: new Date().toISOString(),
                    jobId: jobId,
                    status: 'resolved',
                    updatedAt: new Date().toISOString()
                  };
                  
                  localDb.insertCompanyIds([companyIdRecord]);
                  localDb.updateCompanyStatus(jobId, company.orgnr, 'id_resolved');
                  return { processed: true, success: true };
                } else {
                  console.log(`Found company but could not extract company ID for ${company.companyName} (${company.orgnr})`);
                  console.log('Company data:', JSON.stringify(matchingCompany, null, 2));
                  localDb.updateCompanyStatus(jobId, company.orgnr, 'id_not_found');
                  return { processed: true, success: false };
                }
              } else {
                console.log(`No matching company found for ${company.companyName} (${company.orgnr})`);
                localDb.updateCompanyStatus(jobId, company.orgnr, 'id_not_found');
                return { processed: true, success: false };
              }
            } catch (searchError) {
              console.log(`Error searching Allabolag.se for ${company.companyName} (${company.orgnr}):`, (searchError as Error).message);
              localDb.updateCompanyStatus(jobId, company.orgnr, 'id_not_found');
              return { processed: true, success: false };
            }
          } catch (error) {
            console.error(`Error resolving company ID for ${company.companyName} (${company.orgnr}):`, error);
            localDb.updateCompanyStatus(jobId, company.orgnr, 'error', (error as Error).message);
            return { processed: true, success: false };
          }
        });
        
        // Wait for all promises in chunk to complete
        const results = await Promise.all(promises);
        const chunkProcessed = results.filter(r => r?.processed).length;
        processedCount += chunkProcessed;
        
        // Update job progress
        localDb.updateJob(jobId, {
          processedCount: processedCount
        });
        
        // No delay - proxy handles rate limiting
      }
  }
  
  // Mark job as done
  localDb.updateJob(jobId, { 
    status: 'done'
  });
  
  console.log(`Stage 2 enrichment for job ${jobId} completed, processed ${processedCount} companies`);
  });
}




