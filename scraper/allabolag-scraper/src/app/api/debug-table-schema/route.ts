import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
    }
    
    console.log(`Checking table schema for job ${jobId}`);
    
    const localDb = new LocalStagingDB(jobId);
    
    // Get table schema via public helper
    const schema = localDb.getTableSchema('staging_financials');
    
    return NextResponse.json({
      jobId: jobId,
      tableSchema: schema,
      columnCount: schema.length
    });
    
  } catch (error: unknown) {
    console.error('Error checking table schema:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: message
    }, { status: 500 });
  }
}
