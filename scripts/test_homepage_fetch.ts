/**
 * Test script to fetch homepage data from Allabolag using the scraper
 * Fetches 50 companies and checks how many have homepage data
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { config } from 'dotenv';
import { getBuildId, getAllabolagSession } from '../scraper/allabolag-scraper/src/lib/allabolag';

// Load environment variables from scraper's .env.local
config({ path: join(__dirname, '..', 'scraper', 'allabolag-scraper', '.env.local') });

const DB_PATH = join(__dirname, '..', 'data', 'new_schema_local.db');

function extractCompanyIdFromRawJson(rawJson: string | null): string | null {
  if (!rawJson) return null;
  try {
    const data = JSON.parse(rawJson);
    const company = data?.company || data?.pageProps?.company;
    return company?.companyId || company?.company_id || null;
  } catch {
    return null;
  }
}

function extractHomepage(companyData: any): string | null {
  if (!companyData) return null;
  
  const homepage = companyData.homePage || companyData.homepage || companyData.website || companyData.url;
  if (homepage) {
    const url = String(homepage).trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }
  return null;
}

async function fetchCompanyData(buildId: string, companyId: string, session: any, isFirst: boolean = false) {
  const url = `https://www.allabolag.se/_next/data/${buildId}/company/${companyId}.json?companyId=${companyId}`;
  
  try {
    // Try to use proxy, but fallback to direct fetch if proxy not configured
    let fetchFn: typeof fetch;
    try {
      const { fetchWithProxy } = await import('../scraper/allabolag-scraper/src/lib/unified-proxy');
      fetchFn = fetchWithProxy as any;
    } catch {
      // If proxy not available, use direct fetch (will only work if VPN is active)
      fetchFn = fetch;
      console.log('  ⚠️  Proxy not configured, using direct fetch (requires VPN)');
    }
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://www.allabolag.se/'
    };
    
    if (session) {
      headers['Cookie'] = session.cookies;
      headers['X-Request-Verification-Token'] = session.token;
    }
    
    const response = await fetchFn(url, { headers });
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      console.log(`  ⚠️  HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const company = data?.pageProps?.company || data?.company;
    
    // Debug: Log first company's structure
    if (isFirst && company) {
      console.log(`\n🔍 Debug: First company response structure:`);
      console.log(`   Company keys: ${Object.keys(company).slice(0, 30).join(', ')}`);
      console.log(`   homePage type: ${typeof company.homePage}`);
      console.log(`   homePage value: ${JSON.stringify(company.homePage)}`);
      console.log(`   homePage truthy: ${!!company.homePage}`);
      console.log(`   homePage null check: ${company.homePage === null}`);
      console.log(`   homePage undefined check: ${company.homePage === undefined}`);
      if (company.homePage) {
        console.log(`   ✅ homePage is truthy: "${company.homePage}"`);
      }
    }
    
    return company;
  } catch (error: any) {
    if (error.message.includes('No proxy provider')) {
      console.log(`  ⚠️  Proxy required but not configured. Enable VPN_ENABLED=true in .env.local`);
      return null;
    }
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const db = new Database(DB_PATH);
  
  // Get 50 companies (mix of with and without homepage) that have companyId in raw_json
  const query = `
    SELECT DISTINCT
      c.orgnr,
      c.company_name,
      c.homepage as existing_homepage,
      (SELECT raw_json FROM company_financials cf 
       WHERE cf.orgnr = c.orgnr AND cf.raw_json IS NOT NULL 
       ORDER BY cf.year DESC LIMIT 1) as raw_json
    FROM companies c
    WHERE EXISTS (
      SELECT 1 FROM company_financials cf 
      WHERE cf.orgnr = c.orgnr AND cf.raw_json IS NOT NULL
    )
    ORDER BY RANDOM()
    LIMIT 50
  `;
  
  const companies = db.prepare(query).all() as Array<{
    orgnr: string;
    company_name: string;
    existing_homepage: string | null;
    raw_json: string | null;
  }>;
  
  if (companies.length === 0) {
    console.log('No companies found that need homepage data');
    db.close();
    return;
  }
  
  console.log(`\n📋 Found ${companies.length} companies to test\n`);
  
  // Extract companyIds
  const companiesWithIds: Array<{ orgnr: string; companyName: string; companyId: string; existingHomepage: string | null }> = [];
  for (const row of companies) {
    const companyId = extractCompanyIdFromRawJson(row.raw_json);
    if (companyId) {
      companiesWithIds.push({
        orgnr: row.orgnr,
        companyName: row.company_name,
        companyId,
        existingHomepage: row.existing_homepage
      });
    }
  }
  
  if (companiesWithIds.length === 0) {
    console.log('❌ No companies with valid companyIds found');
    db.close();
    return;
  }
  
  console.log(`✅ Extracted companyIds for ${companiesWithIds.length} companies\n`);
  
  // Get session and build ID using scraper functions
  console.log('🔍 Getting Allabolag session and build ID...');
  const session = await getAllabolagSession();
  const buildId = await getBuildId(session);
  
  if (!buildId) {
    console.log('❌ Could not get build ID');
    db.close();
    return;
  }
  
  console.log(`✅ Using build ID: ${buildId}\n`);
  console.log('📡 Fetching homepage data from Allabolag...\n');
  
  let foundCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  let alreadyHadHomepage = 0;
  const foundHomepages: Array<{ name: string; homepage: string; hadBefore: boolean }> = [];
  
  for (let i = 0; i < companiesWithIds.length; i++) {
    const { orgnr, companyName, companyId, existingHomepage } = companiesWithIds[i];
    
    if (existingHomepage) {
      alreadyHadHomepage++;
    }
    
    if (i > 0 && i % 10 === 0) {
      console.log(`📊 Progress: ${i}/${companiesWithIds.length} (Found: ${foundCount}, Not found: ${notFoundCount}, Errors: ${errorCount})`);
    }
    
    // Fetch company data
    const companyData = await fetchCompanyData(buildId, companyId, session, i === 0);
    
    if (companyData) {
      const homepage = extractHomepage(companyData);
      if (homepage) {
        foundCount++;
        const hadBefore = !!existingHomepage;
        foundHomepages.push({ name: companyName, homepage, hadBefore });
        if (foundCount <= 20) {
          const status = hadBefore ? '(already in DB)' : '(NEW!)';
          console.log(`  ✅ ${companyName.substring(0, 35)}: ${homepage} ${status}`);
        }
      } else {
        notFoundCount++;
      }
    } else {
      notFoundCount++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  db.close();
  
  const newHomepages = foundHomepages.filter(h => !h.hadBefore).length;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ TEST RESULTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Total companies tested: ${companiesWithIds.length}`);
  console.log(`   Already had homepage in DB: ${alreadyHadHomepage}`);
  console.log(`   ✅ Found homepage in API: ${foundCount} (${Math.round(foundCount / companiesWithIds.length * 100)}%)`);
  console.log(`   🆕 NEW homepages found: ${newHomepages}`);
  console.log(`   ❌ No homepage in API: ${notFoundCount}`);
  console.log(`   ⚠️  Errors: ${errorCount}`);
  console.log(`${'='.repeat(60)}\n`);
  
  if (foundCount > 0) {
    console.log(`📝 Sample homepages found:`);
    foundHomepages.slice(0, 10).forEach(({ name, homepage }) => {
      console.log(`   • ${name.substring(0, 35)}: ${homepage}`);
    });
    if (foundHomepages.length > 10) {
      console.log(`   ... and ${foundHomepages.length - 10} more`);
    }
  }
  
  if (foundCount > companiesWithIds.length * 0.3) {
    console.log(`\n⚠️  WARNING: Found ${foundCount} homepages out of ${companiesWithIds.length} companies!`);
    console.log(`   This suggests we're missing homepage data in our extraction process.`);
    console.log(`   We should update our extraction scripts to capture this data.`);
  }
}

main().catch(console.error);

