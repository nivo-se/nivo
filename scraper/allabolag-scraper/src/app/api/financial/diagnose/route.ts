import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';
import { getBuildId, fetchFinancialData, withSession } from '@/lib/allabolag';
import { addCorsHeaders, handleCors } from '@/lib/cors';

export async function GET(request: NextRequest) {
  try {
    // Handle CORS
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return addCorsHeaders(NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      ));
    }

    console.log(`Starting diagnostic analysis for job ${jobId}`);

    const localDb = new LocalStagingDB(jobId);
    
    // Get all companies with their IDs
    const allCompanyIds = localDb.getCompanyIds(jobId);
    const allCompanies = localDb.getCompanies(jobId);
    
    // Create a map of orgnr -> company name
    const companyMap = new Map(allCompanies.map(c => [c.orgnr, c.companyName]));
    
    // Get financial records count per company
    // Access database directly - need to check LocalStagingDB structure
    const db = (localDb as any).db;
    const financialStmt = db.prepare(`
      SELECT orgnr, COUNT(*) as record_count, 
             GROUP_CONCAT(year || '-' || period) as years_periods,
             GROUP_CONCAT(period_start || ' to ' || period_end) as period_ranges
      FROM staging_financials 
      WHERE job_id = ?
      GROUP BY orgnr
    `);
    const financialCounts = new Map(
      (financialStmt.all(jobId) as any[]).map((row: any) => [
        row.orgnr,
        {
          recordCount: row.record_count,
          yearsPeriods: row.years_periods || '',
          periodRanges: row.period_ranges || ''
        }
      ])
    );

    // Build diagnostic data
    const diagnostics = await Promise.all(allCompanyIds.map(async (companyId: any) => {
      const companyName = companyMap.get(companyId.orgnr) || 'Unknown';
      const financialInfo = financialCounts.get(companyId.orgnr) || {
        recordCount: 0,
        yearsPeriods: '',
        periodRanges: ''
      };

      const diagnostic: any = {
        orgnr: companyId.orgnr,
        companyName,
        companyId: companyId.company_id,
        status: companyId.status || 'unknown',
        errorMessage: companyId.error_message || null,
        financialRecords: financialInfo.recordCount,
        yearsPeriods: financialInfo.yearsPeriods,
        periodRanges: financialInfo.periodRanges,
        apiTest: null
      };

      // If no financial records, test the API directly
      if (financialInfo.recordCount === 0 && companyId.company_id) {
        try {
          console.log(`Testing API for company ${companyName} (${companyId.company_id})`);
          
          // Get company data from staging
          const companyData = localDb.getCompanyByOrgnr(jobId, companyId.orgnr);
          
          if (companyData) {
            // Test API call with session - wrap properly
            const testResult = await withSession(async (session: any) => {
              const buildId = await getBuildId(session);
              
              // Attempt to fetch financial data
              const testData = await fetchFinancialData(buildId, {
                ...companyData,
                companyId: companyId.company_id,
                company_name: companyData.companyName,
                segment_name: companyData.segmentName?.[0] || ''
              }, session);

              return {
                success: true,
                recordsReturned: testData?.length || 0,
                buildId,
                sampleRecord: testData && testData.length > 0 ? {
                  year: testData[0].year,
                  period: testData[0].period,
                  periodStart: testData[0].periodStart,
                  periodEnd: testData[0].periodEnd,
                  hasRevenue: !!testData[0].sdi,
                  hasProfit: !!testData[0].dr
                } : null,
                allRecords: testData?.map((r: any) => ({
                  year: r.year,
                  period: r.period,
                  periodStart: r.periodStart,
                  periodEnd: r.periodEnd
                })) || []
              };
            });
            
            diagnostic.apiTest = testResult;
          } else {
            diagnostic.apiTest = {
              success: false,
              error: 'Company data not found in staging_companies table'
            };
          }
        } catch (error: any) {
          diagnostic.apiTest = {
            success: false,
            error: error.message || 'Unknown error',
            errorType: error.constructor?.name || 'Error'
          };
          console.error(`Error testing API for ${companyId.orgnr}:`, error);
        }
      }

      return diagnostic;
    }));

    // Summary statistics
    const summary = {
      totalCompanies: allCompanyIds.length,
      companiesWithFinancials: diagnostics.filter(d => d.financialRecords > 0).length,
      companiesWithoutFinancials: diagnostics.filter(d => d.financialRecords === 0).length,
      totalFinancialRecords: diagnostics.reduce((sum, d) => sum + d.financialRecords, 0),
      statusBreakdown: diagnostics.reduce((acc: any, d: any) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      }, {}),
      apiTestResults: diagnostics
        .filter(d => d.apiTest)
        .map(d => ({
          orgnr: d.orgnr,
          companyName: d.companyName,
          success: d.apiTest.success,
          recordsReturned: d.apiTest.recordsReturned || 0,
          error: d.apiTest.error
        }))
    };

    localDb.close();

    return addCorsHeaders(NextResponse.json({
      jobId,
      summary,
      diagnostics,
      timestamp: new Date().toISOString()
    }));

  } catch (error: any) {
    console.error('Error in diagnostic endpoint:', error);
    return addCorsHeaders(NextResponse.json(
      { 
        error: 'Diagnostic analysis failed',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    ));
  }
}

