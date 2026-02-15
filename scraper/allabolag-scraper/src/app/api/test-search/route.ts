import { NextRequest, NextResponse } from 'next/server';
import { getBuildId, fetchSearchPage } from '@/lib/allabolag';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || 'Ängsdals skolor AB';
    
    console.log(`Testing search for: ${query}`);
    
    const buildId = await getBuildId();
    console.log(`Build ID: ${buildId}`);
    
    const searchResults = await fetchSearchPage(buildId, query);
    console.log('Search results:', JSON.stringify(searchResults, null, 2));
    
    return NextResponse.json({
      query,
      buildId,
      searchResults
    });
  } catch (error) {
    console.error('Search test failed:', error);
    return NextResponse.json(
      { 
        error: 'Search test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
