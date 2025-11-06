import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      );
    }
    
    console.log('Fetching job status for:', jobId);
    
    // Use the local database to get job status
    const localDb = new LocalStagingDB(jobId);
    const job = localDb.getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Get job statistics
    const stats = localDb.getJobStats(jobId);
    
    return NextResponse.json({
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      stage: job.stage,
      lastPage: job.lastPage ?? 0,
      processedCount: job.processedCount ?? 0,
      totalCompanies: job.totalCompanies ?? 0,
      errorCount: job.errorCount ?? 0,
      lastError: job.lastError,
      migrationStatus: job.migrationStatus,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      stats: stats
    });
  } catch (error: unknown) {
    console.error('Error fetching job status:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch job status',
        details: message
      },
      { status: 500 }
    );
  }
}