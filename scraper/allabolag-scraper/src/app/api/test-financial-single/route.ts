import { NextRequest, NextResponse } from 'next/server';
import { fetchFinancialData, withSession } from '@/lib/allabolag';

export async function POST(request: NextRequest) {
  try {
    const { companyId, companyName, buildId } = await request.json();
    
    if (!companyId || !buildId) {
      return NextResponse.json(
        { error: 'companyId and buildId are required' },
        { status: 400 }
      );
    }
    
    console.log(`Testing financial data fetch for company: ${companyName} (${companyId})`);
    
    const result = await withSession(async (session) => {
      const financialData = await fetchFinancialData(buildId, companyId, session, companyName);
      return financialData;
    });
    
    console.log(`Financial data fetch result:`, result);
    
    return NextResponse.json({
      companyId: companyId,
      companyName: companyName,
      buildId: buildId,
      extractedData: result,
      dataPoints: result ? result.length : 0
    });
    
  } catch (error) {
    console.error('Error in test financial single:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch financial data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
