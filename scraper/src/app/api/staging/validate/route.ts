import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '../../../lib/db/local-staging';
import { DataValidator } from '../../../core/validation';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting validation for job ${jobId}...`);

    // Initialize local staging database
    const stagingDB = new LocalStagingDB(jobId);
    const validator = new DataValidator();
    
    // Get financial records to validate
    const financialRecords = stagingDB.getFinancialsToValidate(jobId);
    
    if (financialRecords.length === 0) {
      stagingDB.close();
      return NextResponse.json({
        message: 'No records to validate',
        summary: { total: 0, valid: 0, warnings: 0, invalid: 0 },
        details: [],
      });
    }

    // Validate all records
    const validationResult = validator.validateRecords(financialRecords);

    // Update validation status in local staging
    for (const record of validationResult.valid) {
      stagingDB.updateFinancialValidation(record.id, 'valid', {
        errors: [],
        warnings: [],
      });
    }

    for (const record of validationResult.warnings) {
      stagingDB.updateFinancialValidation(record.id, 'warning', {
        errors: [],
        warnings: record.validation_errors?.warnings || [],
      });
    }

    for (const record of validationResult.invalid) {
      stagingDB.updateFinancialValidation(record.id, 'invalid', {
        errors: record.validation_errors?.errors || [],
        warnings: record.validation_errors?.warnings || [],
      });
    }

    stagingDB.close();

    return NextResponse.json({
      message: 'Validation completed',
      summary: validationResult.summary,
      details: financialRecords,
    });

  } catch (error: any) {
    console.error('Error in validation endpoint:', error);
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

    // Initialize local staging database
    const stagingDB = new LocalStagingDB(jobId);
    
    // Get job stats
    const stats = stagingDB.getJobStats(jobId);
    
    // Get sample data
    const companies = stagingDB.getCompaniesToProcess(jobId, 'pending').slice(0, 10);
    const financials = stagingDB.getFinancialsToValidate(jobId).slice(0, 10);
    
    stagingDB.close();

    return NextResponse.json({
      preview: {
        companies,
        financials,
        summary: stats,
      },
    });

  } catch (error: any) {
    console.error('Error in validation preview endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
