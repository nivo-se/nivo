import { NextRequest, NextResponse } from 'next/server';
import { getBuildId, fetchFinancialData } from '@/lib/allabolag';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || '2KH2M16I5YDDT';
    const orgnr = searchParams.get('orgnr') || '5591563530';
    const companyName = searchParams.get('name') || 'Norrdala Bygg AB';
    
    console.log(`Testing financial data fetch for: ${companyName} (${orgnr}) - Company ID: ${companyId}`);
    
    const buildId = await getBuildId();
    console.log(`Build ID: ${buildId}`);
    
    const companyData = {
      orgnr: orgnr,
      company_name: companyName,
      segment_name: 'Byggnad',
      companyId: companyId
    };
    
    const financialData = await fetchFinancialData(buildId, companyData);
    console.log(`Fetched ${financialData.length} financial records`);
    
    return NextResponse.json({
      success: true,
      companyName,
      orgnr,
      companyId,
      buildId,
      financialRecords: financialData.length,
      financialData: financialData.slice(0, 2) // Show first 2 records
    });
  } catch (error) {
    console.error('Financial data test failed:', error);
    return NextResponse.json(
      { 
        error: 'Financial data test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
