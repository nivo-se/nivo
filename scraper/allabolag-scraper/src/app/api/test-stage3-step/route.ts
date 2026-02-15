import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';
import { withSession, getBuildId, fetchFinancialData } from '@/lib/allabolag';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
    }
    
    console.log(`Testing Stage 3 step by step for job ${jobId}`);
    
    const localDb = new LocalStagingDB(jobId);
    
    // Step 1: Get company IDs
    console.log('Step 1: Getting company IDs...');
    const companyIds = localDb.getCompanyIdsToProcess(jobId, 'resolved');
    console.log(`Found ${companyIds.length} company IDs with 'resolved' status`);
    
    if (companyIds.length === 0) {
      return NextResponse.json({
        error: 'No company IDs found with resolved status',
        totalCompanyIds: localDb.getCompanyIds(jobId).length
      });
    }
    
    // Step 2: Get first company
    const firstCompanyId = companyIds[0];
    console.log('Step 2: Processing first company:', firstCompanyId.orgnr);
    
    // Step 3: Get company data
    console.log('Step 3: Getting company data...');
    const companyData = localDb.getCompanyByOrgnr(jobId, firstCompanyId.orgnr);
    console.log('Company data found:', companyData ? 'Yes' : 'No');
    
    if (!companyData) {
      return NextResponse.json({
        error: 'No company data found for first company',
        orgnr: firstCompanyId.orgnr
      });
    }
    
    // Step 4: Test withSession
    console.log('Step 4: Testing withSession...');
    const result = await withSession(async (session) => {
      console.log('Inside withSession, getting build ID...');
      const buildId = await getBuildId(session);
      console.log('Build ID retrieved:', buildId);
      
      // Step 5: Test financial fetch
      console.log('Step 5: Testing financial fetch...');
      const financialData = await fetchFinancialData(buildId, firstCompanyId.company_id, session, companyData.companyName, companyData.naceCategories);
      console.log(`Financial data fetched: ${financialData.length} records`);
      
      return {
        buildId: buildId,
        financialData: financialData,
        companyData: companyData
      };
    });
    
    console.log('All steps completed successfully');
    
    return NextResponse.json({
      success: true,
      steps: {
        companyIdsFound: companyIds.length,
        companyDataFound: true,
        withSessionSuccess: true,
        financialDataRecords: result.financialData.length
      },
      result: result
    });
    
  } catch (error) {
    console.error('Error in Stage 3 step test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
