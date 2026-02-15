import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing staging tables...');
    
    // Test if staging tables exist
    const { data: jobsData, error: jobsError } = await supabase
      .from('scraper_staging_jobs')
      .select('count')
      .limit(1);
    
    const { data: companiesData, error: companiesError } = await supabase
      .from('scraper_staging_companies')
      .select('count')
      .limit(1);
    
    return NextResponse.json({
      success: true,
      tables: {
        scraper_staging_jobs: {
          exists: !jobsError,
          error: jobsError?.message,
          data: jobsData
        },
        scraper_staging_companies: {
          exists: !companiesError,
          error: companiesError?.message,
          data: companiesData
        }
      }
    });
    
  } catch (error) {
    console.error('Staging tables test error:', error);
    return NextResponse.json(
      { 
        error: 'Staging tables test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
