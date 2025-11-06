import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
    }
    
    console.log(`Testing financial data insertion for job ${jobId}`);
    
    const localDb = new LocalStagingDB(jobId);
    
    // Create test financial data
    const testFinancials = [
      {
        id: 'test_company_2024_2024-06',
        companyId: '2K14ZT0I63IKI',
        orgnr: '5564800836',
        year: 2024,
        period: '2024-06',
        periodStart: '2023-07-01',
        periodEnd: '2024-06-30',
        currency: 'SEK',
        revenue: 100476,
        profit: 4257,
        employees: 80,
        be: 0,
        tr: 8.6,
        rawData: JSON.stringify({ test: 'data' }),
        validationStatus: 'pending',
        scrapedAt: new Date().toISOString(),
        jobId: jobId,
        updatedAt: new Date().toISOString()
      }
    ];
    
    console.log('Inserting test financial data...');
    localDb.insertFinancials(testFinancials);
    console.log('Financial data inserted successfully');
    
    // Check if it was inserted
    const stats = localDb.getJobStats(jobId);
    console.log('Job stats after insertion:', stats);
    
    return NextResponse.json({
      success: true,
      message: 'Financial data inserted successfully',
      stats: stats
    });
    
  } catch (error) {
    console.error('Error in test insert financials:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
