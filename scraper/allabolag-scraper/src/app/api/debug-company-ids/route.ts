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
    
    // Get company IDs by different statuses
    const pendingIds = localDb.getCompanyIdsToProcess(jobId, 'pending');
    const resolvedIds = localDb.getCompanyIdsToProcess(jobId, 'resolved');
    const noFinancialsIds = localDb.getCompanyIdsToProcess(jobId, 'no_financials');
    const idResolvedIds = localDb.getCompanyIdsToProcess(jobId, 'id_resolved');
    
    // Get unique statuses
    const uniqueStatuses = [...new Set(allCompanyIds.map(ci => ci.status))];
    
    return NextResponse.json({
      jobId: jobId,
      counts: {
        total: allCompanyIds.length,
        pending: pendingIds.length,
        resolved: resolvedIds.length,
        no_financials: noFinancialsIds.length,
        id_resolved: idResolvedIds.length
      },
      uniqueStatuses: uniqueStatuses,
      sampleCompanyIds: allCompanyIds.slice(0, 3).map(ci => ({
        orgnr: ci.orgnr,
        companyId: ci.company_id,
        status: ci.status,
        updatedAt: ci.updated_at
      }))
    });
    
  } catch (error: unknown) {
    console.error('Error in debug endpoint:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: message
    }, { status: 500 });
  }
}
