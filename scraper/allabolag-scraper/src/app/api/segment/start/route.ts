import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { LocalStagingDB, StagingCompany } from '@/lib/db/local-staging';
import { filterHash } from '@/lib/hash';
import { getBuildId, fetchSegmentationPage, normalizeCompany, getAllabolagSession, withSession } from '@/lib/allabolag';

const StartSegmentationSchema = z.object({
  revenueFrom: z.number().min(0),
  revenueTo: z.number().min(0),
  profitFrom: z.number().optional(), // Allow negative values for companies with losses
  profitTo: z.number().optional(),
  companyType: z.literal("AB").optional().default("AB"),
});

export async function POST(request: NextRequest) {
  try {
    console.log('Starting segmentation job...');
    const body = await request.json();
    console.log('Request body:', body);
    
    // Convert null to undefined for optional fields
    const normalizedBody = {
      ...body,
      profitFrom: body.profitFrom ?? undefined,
      profitTo: body.profitTo ?? undefined,
    };
    
    const params = StartSegmentationSchema.parse(normalizedBody);
    console.log('Parsed params:', params);
    
    // Allabolag.se expects values in thousands of SEK
    // User input: 50 M SEK → Send to API: 50,000 k SEK (50 * 1000)
    // User input: 0.5 M SEK → Send to API: 500 k SEK (0.5 * 1000)
    // For profitFrom: Allow negative values to capture companies with losses (e.g., -0.5 M SEK = -500 k SEK)
    const scraperParams = {
      ...params,
      revenueFrom: params.revenueFrom * 1000,  // 50 M SEK = 50,000 k SEK
      revenueTo: params.revenueTo * 1000,       // 60 M SEK = 60,000 k SEK
      profitFrom: params.profitFrom !== undefined ? params.profitFrom * 1000 : -500,  // Use user's value, or default to -500 k SEK to capture companies with losses
      profitTo: params.profitTo ? params.profitTo * 1000 : 100000000,  // Set very high upper limit if not provided (100,000 M SEK = 100,000,000 k SEK)
    };
    console.log('Scraper params:', scraperParams);
    
    // Compute filter hash using original params (for UI consistency)
    const hash = filterHash(params);
    console.log('Filter hash:', hash);
    
    // Check if jobId is provided for resume, otherwise create new
    const providedJobId = body.jobId;
    let jobId: string;
    
    if (providedJobId) {
      // Resume existing job
      jobId = providedJobId;
      console.log(`Resuming existing job: ${jobId}`);
    } else {
      // Create new job
      jobId = uuidv4();
      console.log(`Creating new job: ${jobId}`);
    }
    
    const localDb = new LocalStagingDB(jobId);
    console.log('Local database created');
    
    // Check if job already exists
    const existingJob = localDb.getJob(jobId);
    if (existingJob) {
      // If job is already running, don't start another one
      if (existingJob.status === 'running') {
        return NextResponse.json({ 
          jobId: existingJob.id,
          message: 'Job already running' 
        });
      }
      // If job is done or error, we can resume it
      // The processSegmentationJob will handle resuming from lastPage
      console.log(`Resuming existing job ${jobId} from page ${existingJob.lastPage || 0}`);
    }
    
    // Create or update job in local database
    const now = new Date().toISOString();
    
    if (existingJob) {
      // Update existing job to resume
      console.log(`Updating existing job ${jobId} to resume...`);
      localDb.updateJob(jobId, {
        status: 'running',
        stage: 'stage1_segmentation',
        updatedAt: now
      });
      console.log('Job updated for resume');
    } else {
      // Create new job
      console.log('Inserting new job into local database...');
      localDb.insertJob({
        id: jobId,
        jobType: 'segmentation',
        filterHash: hash,
        params: params,
        status: 'running',
        stage: 'stage1_segmentation',
        createdAt: now,
        updatedAt: now
      });
      console.log('Job inserted successfully');
    }
    
    // Start processing in background
    processSegmentationJob(jobId, scraperParams, localDb).catch(async (error) => {
      console.error('Segmentation job failed:', error);
      localDb.updateJob(jobId, { 
        status: 'error', 
        lastError: error.message
      });
    });
    
    console.log('Returning job ID:', jobId);
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting segmentation job:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start segmentation job',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function processSegmentationJob(jobId: string, params: any, localDb: LocalStagingDB) {
  return withSession(async (session) => {
    const buildId = await getBuildId(session);
    
    // Check if this is a resume - get existing job info
    const existingJob = localDb.getJob(jobId);
    const existingStats = localDb.getJobStats(jobId);
    
    // Resume from last page if job already exists
    let currentPage = 1;
    let totalCompaniesFound = 0;
    
    if (existingJob && existingJob.lastPage) {
      // Resume from where we left off
      currentPage = existingJob.lastPage + 1;
      totalCompaniesFound = existingStats.companies || 0;
      console.log(`🔄 Resuming job ${jobId} from page ${currentPage} (had ${totalCompaniesFound} companies)`);
    } else {
      console.log(`🆕 Starting new job ${jobId} from page 1`);
    }
    
    let emptyPages = 0;
    const maxPages = 3000;
    const maxEmptyPages = 100; // Increased to 100 - Allabolag has many intermittent empty pages after page 1000
    const pagesPerBatch = 20; // Process 20 pages per batch
    const concurrency = 30; // Increased to 30 for VPN mode (no proxy rate limits)
    
    // Try to get exact count from first page to know when to stop
    let expectedTotalCount: number | null = null;
    try {
      const firstPageResponse = await fetchSegmentationPage(buildId, {
        ...params,
        page: 1,
      }, session);
      expectedTotalCount = firstPageResponse?.pageProps?.numberOfHits || 
                           firstPageResponse?.pageProps?.pagination?.total ||
                           firstPageResponse?.pageProps?.total ||
                           null;
      if (expectedTotalCount) {
        console.log(`📊 Expected total count from API: ${expectedTotalCount} companies`);
      }
    } catch (error) {
      console.warn('Could not fetch expected count from first page:', error);
    }
    
    console.log(`Starting segmentation job ${jobId} with buildId: ${buildId}`);
    console.log(`Using parallel processing: ${concurrency} concurrent pages per batch`);
    
    while (currentPage <= maxPages) {
      try {
        // Process pages in parallel batches
        const pageBatch: number[] = [];
        for (let page = currentPage; page < Math.min(currentPage + pagesPerBatch, maxPages + 1); page++) {
          pageBatch.push(page);
        }
        
        console.log(`Processing pages ${pageBatch[0]}-${pageBatch[pageBatch.length - 1]} in parallel (${pageBatch.length} pages)`);
        
        // Process pages in chunks with controlled concurrency
        const chunks: number[][] = [];
        for (let i = 0; i < pageBatch.length; i += concurrency) {
          chunks.push(pageBatch.slice(i, i + concurrency));
        }
        
        let batchEmptyPages = 0;
        let batchCompaniesFound = 0;
        
        for (const chunk of chunks) {
          // Process pages concurrently within chunk
          const promises = chunk.map(async (pageNum: number) => {
            // Retry logic for empty pages - try up to 3 times with fresh session
            let lastError: string | null = null;
            for (let retry = 0; retry < 3; retry++) {
              try {
                if (retry > 0) {
                  console.log(`🔄 Retrying page ${pageNum} (attempt ${retry + 1}/3) - refreshing session...`);
                  // Get fresh session for retry
                  const freshSession = await getAllabolagSession();
                  const freshBuildId = await getBuildId(freshSession);
                  const response = await fetchSegmentationPage(freshBuildId, {
                    ...params,
                    page: pageNum,
                  }, freshSession);
                  
                  const companies = response?.pageProps?.companies || [];
                  if (companies.length > 0) {
                    console.log(`✅ Page ${pageNum} retry successful: Found ${companies.length} companies`);
                    return { pageNum, companies, isEmpty: false };
                  }
                  // Still empty, try again
                  console.log(`⚠️  Page ${pageNum} still empty after retry ${retry + 1}`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // Exponential backoff
                  continue;
                } else {
                  // First attempt
                  console.log(`Fetching page ${pageNum}...`);
                  const response = await fetchSegmentationPage(buildId, {
                    ...params,
                    page: pageNum,
                  }, session);
                  
                  const companies = response?.pageProps?.companies || [];
                  console.log(`Page ${pageNum}: Found ${companies.length} companies`);
                  
                  // If empty, retry once more before marking as empty
                  if (companies.length === 0 && retry === 0) {
                    console.log(`⚠️  Page ${pageNum} returned empty - will retry...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue; // Retry
                  }
                  
                  return { pageNum, companies, isEmpty: companies.length === 0 };
                }
              } catch (error: any) {
                lastError = error.message;
                console.error(`Error fetching page ${pageNum} (attempt ${retry + 1}):`, error);
                // Check if it's a proxy error - stop job
                if (error.message?.includes('Oxylabs proxy') || error.message?.includes('proxy')) {
                  throw new Error(`Proxy error on page ${pageNum}: ${error.message}`);
                }
                // Wait before retry
                if (retry < 2) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
                }
              }
            }
            // All retries failed or page is still empty
            console.log(`❌ Page ${pageNum} returned empty after 3 attempts`);
            return { pageNum, companies: [], isEmpty: true, error: lastError || 'Empty page after retries' };
          });
          
          const results = await Promise.all(promises);
          
          // Add delay after each chunk to respect rate limits (1 second delay between chunks)
          // This ensures we don't exceed request rate limits even with concurrent sessions
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Process results
          for (const result of results) {
            if (result.error && result.error.includes('proxy')) {
              throw new Error(result.error);
            }
            
            if (result.isEmpty) {
              batchEmptyPages++;
            } else {
              batchEmptyPages = 0; // Reset counter on non-empty page
              batchCompaniesFound += result.companies.length;
              
              // Process and insert companies into local database
              const companiesToInsert = [];
              
              for (const company of result.companies) {
                const normalized = normalizeCompany(company);
                
                if (!normalized.orgnr) {
                  console.warn('Skipping company without orgnr:', company);
                  continue;
                }
                
                companiesToInsert.push({
                  orgnr: normalized.orgnr,
                  companyName: normalized.companyName,
                  companyId: normalized.companyId,
                  companyIdHint: normalized.companyIdHint,
                  homepage: normalized.homepage,
                  naceCategories: normalized.naceCategories,
                  segmentName: normalized.segmentName,
                  revenueSek: normalized.revenueSek,
                  profitSek: normalized.profitSek,
                  foundationYear: normalized.foundationYear,
                  companyAccountsLastYear: normalized.companyAccountsLastYear,
                  scrapedAt: new Date().toISOString(),
                  jobId: jobId,
                  status: 'pending',
                  updatedAt: new Date().toISOString()
                });
              }
              
              // Insert companies in batch
              if (companiesToInsert.length > 0) {
                localDb.insertCompanies(companiesToInsert as StagingCompany[]);
              }
            }
          }
          
          // Check if we've hit too many empty pages
          if (batchEmptyPages >= maxEmptyPages) {
            console.log(`Reached ${maxEmptyPages} empty pages in batch, stopping`);
            emptyPages = batchEmptyPages;
            break;
          }
        }
        
        totalCompaniesFound += batchCompaniesFound;
        emptyPages = batchEmptyPages;
        currentPage = pageBatch[pageBatch.length - 1] + 1;
        
        // Update job progress
        localDb.updateJob(jobId, {
          lastPage: currentPage - 1,
          processedCount: totalCompaniesFound,
          totalCompanies: totalCompaniesFound
        });
        
        console.log(`Job ${jobId} progress: Page ${currentPage - 1}, Total companies found: ${totalCompaniesFound}`);
        
        // Stop if we hit too many empty pages
        // BUT: If we have expected count and we're close (< 5% away), continue
        // OR: If we're still far from expected count, reduce tolerance
        const shouldStop = emptyPages >= maxEmptyPages;
        const isCloseToTarget = expectedTotalCount && 
          totalCompaniesFound > 0 && 
          (totalCompaniesFound / expectedTotalCount) >= 0.95; // 95% of expected count
        
        if (shouldStop && !isCloseToTarget) {
          console.log(`Reached ${maxEmptyPages} empty pages, stopping`);
          console.log(`Found ${totalCompaniesFound} companies (expected: ${expectedTotalCount || 'unknown'})`);
          break;
        } else if (shouldStop && isCloseToTarget) {
          console.log(`Reached ${maxEmptyPages} empty pages but we're at ${((totalCompaniesFound / expectedTotalCount!) * 100).toFixed(1)}% of expected count - stopping`);
          break;
        }
      
    } catch (error: any) {
      console.error(`❌ Error processing page ${currentPage}:`, error);
      
      // Check if it's a proxy error - stop job and mark as error
      if (error.message?.includes('Oxylabs proxy') || error.message?.includes('proxy')) {
        console.error('❌ Proxy error detected - stopping job');
        localDb.updateJob(jobId, {
          status: 'error',
          lastError: `Proxy error on page ${currentPage}: ${error.message}`,
          updatedAt: new Date().toISOString()
        });
        throw new Error(`Proxy error: ${error.message}. Job stopped. Fix proxy and resume from page ${currentPage}.`);
      }
      
      // For other errors, also stop but allow retry
      localDb.updateJob(jobId, {
        status: 'error',
        lastError: `Error on page ${currentPage}: ${error.message}`,
        updatedAt: new Date().toISOString()
      });
      throw error;
    }
  }
  
  // Mark job as done
  localDb.updateJob(jobId, { 
    status: 'done',
    totalCompanies: totalCompaniesFound,
    processedCount: totalCompaniesFound
  });
  
    console.log(`Segmentation job ${jobId} completed:`);
    console.log(`- Total pages processed: ${currentPage - 1}`);
    console.log(`- Total companies found: ${totalCompaniesFound}`);
    console.log(`- Companies stored in database: ${totalCompaniesFound}`);
  });
}




