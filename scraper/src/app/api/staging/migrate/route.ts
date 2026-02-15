import { NextRequest, NextResponse } from 'next/server';
import { StagingManager } from '../../../core/staging';

export async function POST(request: NextRequest) {
  try {
    const { jobId, includeWarnings = false, skipDuplicates = true } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting migration for job ${jobId}...`);

    const stagingManager = new StagingManager();
    const result = await stagingManager.migrateToProduction(jobId, {
      includeWarnings,
      skipDuplicates,
    });

    return NextResponse.json({
      message: 'Migration completed',
      migrated: result.migrated,
      skipped: result.skipped,
      errors: result.errors,
      report: result.report,
    });

  } catch (error: any) {
    console.error('Error in migration endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get migration history for the job
    const { data: migrations, error } = await supabase
      .from('migration_log')
      .select('*')
      .eq('job_id', jobId)
      .order('started_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      migrations: migrations || [],
    });

  } catch (error: any) {
    console.error('Error in migration history endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
