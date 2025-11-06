import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
    }
    
    console.log(`Completing Stage 3 for job ${jobId}`);
    
    const localDb = new LocalStagingDB(jobId);
    
    // Update job status to done
    localDb.updateJob(jobId, {
      status: 'done',
      stage: 'stage3_financials'
    });
    
    // Get final stats
    const stats = localDb.getJobStats(jobId);
    
    return NextResponse.json({
      success: true,
      message: 'Stage 3 completed successfully',
      stats: stats
    });
    
  } catch (error: unknown) {
    console.error('Error completing Stage 3:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}
