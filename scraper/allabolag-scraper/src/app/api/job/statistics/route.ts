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
    
    console.log('Fetching job statistics for:', jobId);
    
    // Use the local database to get job statistics
    const localDb = new LocalStagingDB(jobId);
    const job = localDb.getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Basic statistics available from LocalStagingDB
    const stats = localDb.getJobStats(jobId);
    
    // Companies by status (derived from companies table)
    const companiesByStatus = {
      pending: localDb.getCompaniesToProcess(jobId, 'pending').length,
      id_resolved: localDb.getCompaniesToProcess(jobId, 'id_resolved').length,
      error: localDb.getCompaniesToProcess(jobId, 'error').length,
    };
    
    // Company IDs statistics
    const companyIdsByStatus = {
      pending: localDb.getCompanyIdsToProcess(jobId, 'pending').length,
      financials_fetched: localDb.getCompanyIdsToProcess(jobId, 'financials_fetched').length,
      no_financials: localDb.getCompanyIdsToProcess(jobId, 'no_financials').length,
      error: localDb.getCompanyIdsToProcess(jobId, 'error').length,
    };
    
    return NextResponse.json({
      job: {
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
      },
      statistics: {
        totals: {
          companies: stats.companies,
          companyIds: stats.companyIds,
          financials: stats.financials
        },
        companies: {
          byStatus: companiesByStatus
        },
        companyIds: {
          total: Object.values(companyIdsByStatus).reduce((a, b) => a + b, 0),
          byStatus: companyIdsByStatus
        }
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching job statistics:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch job statistics',
        details: message
      },
      { status: 500 }
    );
  }
}
