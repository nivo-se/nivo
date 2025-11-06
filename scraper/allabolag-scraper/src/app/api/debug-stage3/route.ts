import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
    }
    
    const localDb = new LocalStagingDB(jobId);
    
    // Get all company IDs
    const allCompanyIds = localDb.getCompanyIds(jobId);
    console.log(`Found ${allCompanyIds.length} company IDs for job ${jobId}`);
    
    // Test the first company ID
    if (allCompanyIds.length > 0) {
      const firstCompanyId = allCompanyIds[0];
      console.log('Testing first company ID:', firstCompanyId);
      
      // Try to get company data
      const companyData = localDb.getCompanyByOrgnr(jobId, firstCompanyId.orgnr);
      console.log('Company data found:', companyData ? 'Yes' : 'No');
      
      if (companyData) {
        console.log('Company data:', {
          orgnr: companyData.orgnr,
          companyName: companyData.companyName,
          status: companyData.status
        });
      }
      
      return NextResponse.json({
        jobId: jobId,
        totalCompanyIds: allCompanyIds.length,
        firstCompanyId: firstCompanyId,
        companyData: companyData,
        testResult: companyData ? 'SUCCESS' : 'FAILED - No company data found'
      });
    } else {
      return NextResponse.json({
        jobId: jobId,
        totalCompanyIds: 0,
        testResult: 'FAILED - No company IDs found'
      });
    }
    
  } catch (error: unknown) {
    console.error('Error in debug endpoint:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: message
    }, { status: 500 });
  }
}
