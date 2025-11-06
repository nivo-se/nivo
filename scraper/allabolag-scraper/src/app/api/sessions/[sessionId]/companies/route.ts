import { NextRequest, NextResponse } from 'next/server';
import { LocalStagingDB } from '@/lib/db/local-staging';
import { handleCors, addCorsHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  // Handle CORS preflight
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const { sessionId } = await params;
    console.log(`Fetching companies for session: ${sessionId}`);
    
    const localDb = new LocalStagingDB(sessionId);
    
    // Check if session exists
    const jobDetails = localDb.getJob(sessionId);
    if (!jobDetails) {
      console.log(`Session not found: ${sessionId}`);
      localDb.close();
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    console.log(`Session found, getting companies...`);
    
    // Get basic company data first
    const basicCompanies = localDb.getCompanies(sessionId);
    console.log(`Found ${basicCompanies.length} companies`);
    
    const basicSummary = {
      totalCompanies: basicCompanies.length,
      companiesWithIds: 0,
      companiesWithFinancials: 0,
      totalFinancialRecords: 0,
      avgRecordsPerCompany: 0,
      stage1Progress: 100,
      stage2Progress: 0,
      stage3Progress: 0
    };
    
    localDb.close();
    
    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionId,
      companies: basicCompanies.map(c => ({
        orgnr: c.orgnr,
        companyName: c.companyName,
        companyId: c.companyId,
        status: c.status,
        stage1Data: {
          revenue: c.revenueSek,
          profit: c.profitSek,
          nace: c.naceCategories,
          segment: c.segmentName,
          homepage: c.homepage,
          foundedYear: c.foundationYear
        },
        stage2Data: {
          companyId: null,
          confidence: null
        },
        stage3Data: {
          years: [],
          recordCount: 0,
          validationStatus: 'pending'
        },
        errors: []
      })),
      pagination: {
        page: 1,
        limit: basicCompanies.length,
        total: basicCompanies.length,
        pages: 1
      },
      summary: basicSummary,
      errors: [],
      totalErrors: 0
    }));
    
  } catch (error: unknown) {
    console.error(`Error fetching companies for session:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return addCorsHeaders(NextResponse.json({ error: message }, { status: 500 }));
  }
}

export function OPTIONS(request: NextRequest) {
  // Explicit OPTIONS handler for CORS preflight
  return handleCors(request) || addCorsHeaders(new NextResponse(null, { status: 204 }));
}
