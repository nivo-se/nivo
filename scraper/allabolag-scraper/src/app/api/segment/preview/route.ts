import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuildId, fetchSegmentationPage, getAllabolagSession, withSession } from '@/lib/allabolag';

const PreviewSegmentationSchema = z.object({
  revenueFrom: z.number().min(0),
  revenueTo: z.number().min(0),
  profitFrom: z.number().optional(),
  profitTo: z.number().optional(),
  companyType: z.literal("AB").optional().default("AB"),
});

/**
 * Preview endpoint - Get company count for filters without starting a full scrape
 * Similar to Allabolag's web interface that shows instant count
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const revenueFrom = searchParams.get('revenueFrom');
    const revenueTo = searchParams.get('revenueTo');
    const profitFrom = searchParams.get('profitFrom');
    const profitTo = searchParams.get('profitTo');
    const companyType = searchParams.get('companyType') || 'AB';
    
    if (!revenueFrom || !revenueTo) {
      return NextResponse.json(
        { error: 'revenueFrom and revenueTo are required' },
        { status: 400 }
      );
    }
    
    // Convert null to undefined for optional fields
    const params = {
      revenueFrom: parseFloat(revenueFrom),
      revenueTo: parseFloat(revenueTo),
      profitFrom: profitFrom ? parseFloat(profitFrom) : undefined,
      profitTo: profitTo ? parseFloat(profitTo) : undefined,
      companyType: companyType as 'AB',
    };
    
    // Validate parameters
    const validatedParams = PreviewSegmentationSchema.parse(params);
    
    // Convert to thousands of SEK (same as segmentation endpoint)
    // For profit filters: use actual min/max if not provided (the grey default values from web UI)
    // First fetch will tell us what the actual limits are
    let scraperParams = {
      ...validatedParams,
      revenueFrom: validatedParams.revenueFrom * 1000,
      revenueTo: validatedParams.revenueTo * 1000,
      // Don't set profitFrom/profitTo yet - we'll fetch first page to get actual limits
      // Then use those limits if user didn't specify
    };
    
    // Only set profit filters if user explicitly provided them
    if (validatedParams.profitFrom !== undefined) {
      scraperParams.profitFrom = validatedParams.profitFrom * 1000;
    }
    if (validatedParams.profitTo !== undefined) {
      scraperParams.profitTo = validatedParams.profitTo * 1000;
    }
    
    console.log('Preview request:', scraperParams);
    
    // Fetch first page to get count and estimate
    const previewResult = await withSession(async (session) => {
      const buildId = await getBuildId(session);
      
      // Fetch first page
      const page1Response = await fetchSegmentationPage(buildId, {
        ...scraperParams,
        page: 1,
      }, session);
      
      const companies = page1Response?.pageProps?.companies || [];
      let companiesPerPage = companies.length;
      
      // Check if API provides the actual min/max EBIT limits (grey values in web UI)
      // These might be needed for accurate filtering
      let actualProfitMin: number | null = null;
      let actualProfitMax: number | null = null;
      
      // Check for limits in response (filters section might contain min/max values)
      const limits = page1Response?.pageProps?.limits;
      if (limits) {
        // Check if limits contain profit min/max
        if (limits.profitFrom !== undefined || limits.profitMin !== undefined) {
          actualProfitMin = limits.profitFrom || limits.profitMin;
        }
        if (limits.profitTo !== undefined || limits.profitMax !== undefined) {
          actualProfitMax = limits.profitTo || limits.profitMax;
        }
      }
      
      // Try to find total count in response
      // Allabolag web UI shows instant total, so API must provide it somewhere
      // Check all possible locations in the response structure
      let totalCount: number | null = null;
      
      // Log full response structure for debugging (first 2000 chars)
      const responseStr = JSON.stringify(page1Response, null, 2);
      console.log('API Response structure (first 2000 chars):', responseStr.substring(0, 2000));
      
      // Check all possible locations for total count
      // Based on response structure, we see: numberOfHits and pagination in pageProps
      const possiblePaths = [
        page1Response?.pageProps?.numberOfHits, // Most likely - seen in response structure!
        page1Response?.pageProps?.pagination?.total,
        page1Response?.pageProps?.pagination?.totalCount,
        page1Response?.pageProps?.totalCount,
        page1Response?.pageProps?.total,
        page1Response?.pageProps?.totalCompanies,
        page1Response?.pageProps?.count,
        page1Response?.pageProps?.companyCount,
        page1Response?.pageProps?.totalResults,
        page1Response?.pageProps?.results?.total,
        page1Response?.totalCount,
        page1Response?.total,
        page1Response?.count,
        page1Response?.pagination?.total,
        // Check nested structures
        page1Response?.pageProps?.data?.total,
        page1Response?.pageProps?.data?.totalCount,
        page1Response?.pageProps?.meta?.total,
        page1Response?.pageProps?.meta?.totalCount,
      ];
      
      for (const value of possiblePaths) {
        if (typeof value === 'number' && value > 0) {
          totalCount = value;
          console.log(`✅ Found total count: ${totalCount}`);
          break;
        }
      }
      
      // If still not found, check if companies array has a length property that indicates total
      // Some APIs return total as a property of the array
      if (!totalCount && Array.isArray(page1Response?.pageProps?.companies)) {
        const companiesArray = page1Response.pageProps.companies;
        // Check if array has custom properties
        if ((companiesArray as any).total !== undefined) {
          totalCount = (companiesArray as any).total;
        } else if ((companiesArray as any).length !== undefined && (companiesArray as any).length > companiesArray.length) {
          // Sometimes length property is the total, not array length
          totalCount = (companiesArray as any).length;
        }
      }
      
      // If no total count, estimate based on sampling multiple pages
      // Fetch pages 2-5 to get a better average and check how many pages have data
      let estimatedCount: number | null = null;
      let hasMorePages = false;
      let pagesWithData = 1; // Page 1 already has data
      let totalCompaniesSampled = companiesPerPage;
      
      if (!totalCount && companiesPerPage > 0) {
        // Sample pages 2-5 to get better estimation
        const samplePages = [2, 3, 4, 5];
        const pageResults: number[] = [];
        
        for (const pageNum of samplePages) {
          try {
            const pageResponse = await fetchSegmentationPage(buildId, {
              ...scraperParams,
              page: pageNum,
            }, session);
            
            const pageCompanies = pageResponse?.pageProps?.companies || [];
            if (pageCompanies.length > 0) {
              pageResults.push(pageCompanies.length);
              totalCompaniesSampled += pageCompanies.length;
              pagesWithData++;
            } else {
              // Empty page found - might be the end, but continue sampling
              break;
            }
          } catch (error) {
            console.warn(`Could not fetch page ${pageNum} for estimation:`, error);
            break;
          }
        }
        
        hasMorePages = pageResults.length > 0;
        
        if (hasMorePages) {
          // Calculate average companies per page from sampled pages
          const avgCompaniesPerPage = totalCompaniesSampled / pagesWithData;
          
          // Estimate: if we found data on 5 pages, there are likely many more
          // Conservative estimate: at least 10 pages worth, but could be 100+ pages
          // Use the average to estimate: if avg is 10 per page, and we found 5 pages with data,
          // estimate at least 50 pages (10 * 5 = 50, but we'll be more conservative)
          estimatedCount = Math.max(
            avgCompaniesPerPage * 10, // At least 10 pages worth
            avgCompaniesPerPage * 50  // Could be 50+ pages
          );
        } else {
          // Only page 1 has companies
          estimatedCount = companiesPerPage;
        }
      }
      
      // If we found actual profit limits, use them for a second request if user didn't specify
      let finalCount = totalCount || estimatedCount;
      let usedActualLimits = false;
      
      // If profit filters weren't provided and we found actual limits, make another request with those limits
      if ((validatedParams.profitFrom === undefined || validatedParams.profitTo === undefined) && 
          (actualProfitMin !== null || actualProfitMax !== null)) {
        try {
          const fullScraperParams = {
            ...scraperParams,
            profitFrom: actualProfitMin !== null ? actualProfitMin : scraperParams.profitFrom,
            profitTo: actualProfitMax !== null ? actualProfitMax : scraperParams.profitTo,
          };
          
          const fullPage1Response = await fetchSegmentationPage(buildId, {
            ...fullScraperParams,
            page: 1,
          }, session);
          
          const fullCompanies = fullPage1Response?.pageProps?.companies || [];
          const fullTotalCount = fullPage1Response?.pageProps?.numberOfHits || 
                                 fullPage1Response?.pageProps?.pagination?.total ||
                                 fullPage1Response?.pageProps?.total;
          
          if (fullTotalCount && typeof fullTotalCount === 'number') {
            totalCount = fullTotalCount;
            finalCount = fullTotalCount;
            usedActualLimits = true;
            companiesPerPage = fullCompanies.length;
          }
        } catch (error) {
          console.warn('Could not fetch with actual profit limits:', error);
        }
      }
      
      return {
        totalCount,
        estimatedCount,
        finalCount: finalCount || estimatedCount || 0,
        companiesPerPage,
        hasMorePages,
        firstPageCompanies: companiesPerPage,
        pagesSampled: pagesWithData,
        totalCompaniesSampled: totalCompaniesSampled,
        avgCompaniesPerPage: pagesWithData > 0 ? totalCompaniesSampled / pagesWithData : companiesPerPage,
        actualProfitLimits: {
          min: actualProfitMin,
          max: actualProfitMax,
          used: usedActualLimits
        },
        // Include raw response structure for debugging
        responseStructure: {
          hasPageProps: !!page1Response?.pageProps,
          hasTotalCount: totalCount !== null,
          keys: Object.keys(page1Response || {}),
          pagePropsKeys: page1Response?.pageProps ? Object.keys(page1Response.pageProps) : [],
        }
      };
    });
    
    return NextResponse.json({
      success: true,
      filters: validatedParams,
      count: previewResult.finalCount || 0,
      isExact: previewResult.totalCount !== null,
      isEstimated: previewResult.totalCount === null,
      companiesPerPage: previewResult.companiesPerPage,
      hasMorePages: previewResult.hasMorePages,
      actualProfitLimits: previewResult.actualProfitLimits,
      note: previewResult.totalCount 
        ? 'Exact count from API' 
        : `Estimated count (sampled ${previewResult.pagesSampled} pages, avg ${previewResult.avgCompaniesPerPage?.toFixed(1)} companies/page)`,
      ...previewResult
    });
    
  } catch (error: any) {
    console.error('Error in preview endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get company count',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
