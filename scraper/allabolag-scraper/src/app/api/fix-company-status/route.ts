import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
    }
    
    const localDb = new LocalStagingDB(jobId);
    
    // Get all company IDs with 'no_financials' status
    const companyIds = localDb.getCompanyIdsToProcess(jobId, 'no_financials');
    console.log(`Found ${companyIds.length} company IDs with 'no_financials' status`);
    
    // Update their status to 'resolved'
    let updatedCount = 0;
    for (const companyId of companyIds) {
      localDb.updateCompanyIdStatus(jobId, companyId.orgnr, 'resolved');
      updatedCount++;
    }
    
    return NextResponse.json({
      message: `Updated ${updatedCount} company IDs from 'no_financials' to 'resolved'`,
      updatedCount: updatedCount
    });
    
  } catch (error: unknown) {
    console.error('Error fixing company ID statuses:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: message
    }, { status: 500 });
  }
}
