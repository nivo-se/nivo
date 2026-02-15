import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
    }
    
    console.log(`Migrating financial schema for job ${jobId}`);
    
    const localDb = new LocalStagingDB(jobId);
    
    // Add missing columns to staging_financials table
    const columnsToAdd = [
      'revenue TEXT',
      'profit TEXT', 
      'employees TEXT',
      'be TEXT',
      'tr TEXT'
    ];
    
    let addedColumns = 0;
    
    for (const column of columnsToAdd) {
      try {
        const added = localDb.addColumnIfMissing('staging_financials', column);
        if (added) {
          console.log(`Added column: ${column.split(' ')[0]}`);
          addedColumns++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error adding column ${column}:`, message);
      }
    }
    
    // Check final schema
    const finalSchema = localDb.getTableSchema('staging_financials');
    
    return NextResponse.json({
      success: true,
      message: `Migration completed. Added ${addedColumns} columns.`,
      finalColumnCount: finalSchema.length,
      addedColumns: addedColumns
    });
    
  } catch (error: unknown) {
    console.error('Error in migration:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}
