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

    const localDb = new LocalStagingDB(jobId);
    
    // Check if session exists
    const jobDetails = localDb.getJob(jobId);
    if (!jobDetails) {
      localDb.close();
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get basic company data
    const companies = localDb.getCompanies(jobId);
    const jobStats = localDb.getJobStats(jobId);
    
    // Get companies with details if available
    let companiesWithDetails = [];
    let pagination = { page: 1, limit: 1000, total: companies.length, pages: 1 };
    
    try {
      const detailedResult = localDb.getCompaniesWithDetails(jobId, {}, { page: 1, limit: 1000 });
      companiesWithDetails = detailedResult.companies;
      pagination = detailedResult.pagination;
    } catch (error) {
      console.log('Using basic company data:', error);
      companiesWithDetails = companies.map(c => ({
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
          companyId: c.companyId,
          confidence: null
        },
        stage3Data: {
          years: [],
          recordCount: 0,
          validationStatus: 'pending'
        },
        errors: []
      }));
    }

    // Calculate year range from financial data
    let yearRange = { min: null, max: null };
    try {
      const financialYears = localDb.getFinancialYearsForJob(jobId);
      if (financialYears && financialYears.length > 0) {
        const years = financialYears.map(y => y.year).filter(y => y && !isNaN(y));
        if (years.length > 0) {
          yearRange = {
            min: Math.min(...years),
            max: Math.max(...years)
          };
        }
      }
    } catch (error) {
      console.log('Could not get financial years:', error);
    }

    const validationData = {
      success: true,
      sessionId: jobId,
      summary: {
        totalCompanies: jobStats.companies,
        companiesWithIds: jobStats.companyIds,
        companiesWithFinancials: jobStats.financials,
        totalFinancialRecords: jobStats.financials,
        avgRecordsPerCompany: jobStats.companies > 0 ? Math.round(jobStats.financials / jobStats.companies) : 0,
        stage1Progress: jobStats.companies > 0 ? 100 : 0,
        stage2Progress: jobStats.companies > 0 ? Math.round((jobStats.companyIds / jobStats.companies) * 100) : 0,
        stage3Progress: jobStats.companyIds > 0 ? Math.round((jobStats.financials / jobStats.companyIds) * 100) : 0,
        yearRange: yearRange
      },
      companies: companiesWithDetails,
      pagination: pagination,
      errors: [],
      totalErrors: 0
    };
    
    localDb.close();
    return NextResponse.json(validationData);
    
  } catch (error) {
    console.error('Error fetching validation data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation data' },
      { status: 500 }
    );
  }
}
