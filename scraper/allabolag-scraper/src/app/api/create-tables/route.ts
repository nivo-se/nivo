import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function POST(request: NextRequest) {
  try {
    console.log('Ensuring local staging tables exist...');

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId') || 'init';

    // Instantiating LocalStagingDB ensures tables are created
    const localDb = new LocalStagingDB(jobId);

    // Simple sanity query via schema helper
    const schema = localDb.getTableSchema('staging_jobs');

    return NextResponse.json({
      success: true,
      message: 'Local staging tables are present',
      table: 'staging_jobs',
      columnCount: schema.length
    });
  } catch (error: unknown) {
    console.error('Table creation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Table creation test failed',
        details: message
      },
      { status: 500 }
    );
  }
}
