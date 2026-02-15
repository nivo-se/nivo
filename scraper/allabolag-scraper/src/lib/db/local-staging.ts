/**
 * Local Staging Database Module
 * 
 * Provides SQLite-based local staging database for scraper jobs
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

export interface StagingJob {
  id: string;
  jobType: string;
  filterHash: string;
  params: any;
  status: 'pending' | 'running' | 'done' | 'error' | 'paused' | 'stopped';
  stage: string;
  lastPage?: number;
  processedCount?: number;
  totalCompanies?: number;
  errorCount?: number;
  lastError?: string;
  migrationStatus?: string;
  rateLimitStats?: any;
  createdAt: string;
  updatedAt: string;
}

export interface StagingCompany {
  orgnr: string;
  companyName: string;
  companyId?: string;
  companyIdHint?: string;
  homepage?: string;
  naceCategories: string[];
  segmentName: string[];
  revenueSek?: number;
  profitSek?: number;
  foundationYear?: number;
  companyAccountsLastYear?: string;
  scrapedAt: string;
  jobId: string;
  status: 'pending' | 'id_resolved' | 'financials_fetched' | 'error';
  updatedAt: string;
}

export class LocalStagingDB {
  private db: any;
  private jobId: string;

  constructor(jobId: string) {
    this.jobId = jobId;
    
    // Ensure staging directory exists
    const stagingDir = join(process.cwd(), 'staging');
    mkdirSync(stagingDir, { recursive: true });
    
    // Open database
    const dbPath = join(stagingDir, `staging_${jobId}.db`);
    this.db = new Database(dbPath);
    
    // Initialize tables
    this.initializeTables();
  }

  private initializeTables() {
    // Create staging_jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS staging_jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        filter_hash TEXT NOT NULL,
        params TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        stage TEXT NOT NULL DEFAULT 'stage1_segmentation',
        last_page INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        total_companies INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        migration_status TEXT DEFAULT 'pending',
        rate_limit_stats TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create staging_companies table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS staging_companies (
        orgnr TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        company_id TEXT,
        company_id_hint TEXT,
        homepage TEXT,
        nace_categories TEXT DEFAULT '[]',
        segment_name TEXT DEFAULT '[]',
        revenue_sek REAL,
        profit_sek REAL,
        foundation_year INTEGER,
        company_accounts_last_year TEXT,
        scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
        job_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create staging_company_ids table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS staging_company_ids (
        orgnr TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'scraper',
        confidence_score TEXT DEFAULT '1.0',
        scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
        job_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add error_message column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE staging_company_ids ADD COLUMN error_message TEXT`);
    } catch (e: any) {
      // Column already exists, ignore
      if (!e.message?.includes('duplicate column')) {
        console.log('Note: error_message column may already exist');
      }
    }

    // Create staging_financials table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS staging_financials (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        orgnr TEXT NOT NULL,
        year INTEGER NOT NULL,
        period TEXT NOT NULL,
        period_start TEXT,
        period_end TEXT,
        currency TEXT DEFAULT 'SEK',
        revenue REAL,
        profit REAL,
        employees INTEGER,
        be REAL,
        tr REAL,
        raw_data TEXT NOT NULL,
        validation_status TEXT DEFAULT 'pending',
        validation_errors TEXT,
        scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
        job_id TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(company_id, year, period)
      )
    `);
    
    // Update unique constraint to include period (for existing databases)
    // Note: SQLite doesn't support ALTER TABLE to modify UNIQUE constraints directly
    // But the PRIMARY KEY on id already handles uniqueness, so we just ensure period is part of uniqueness
    
    // Add missing columns if they don't exist (for existing databases)
    const columnsToAdd = [
      { name: 'revenue', type: 'REAL' },
      { name: 'profit', type: 'REAL' },
      { name: 'employees', type: 'INTEGER' },
      { name: 'be', type: 'REAL' },
      { name: 'tr', type: 'REAL' }
    ];
    
    for (const col of columnsToAdd) {
      try {
        this.db.exec(`ALTER TABLE staging_financials ADD COLUMN ${col.name} ${col.type}`);
      } catch (e: any) {
        // Column already exists, ignore
        if (!e.message?.includes('duplicate column')) {
          console.log(`Note: ${col.name} column may already exist or error occurred:`, e.message);
        }
      }
    }
  }

  // Job management methods
  insertJob(job: StagingJob) {
    const stmt = this.db.prepare(`
      INSERT INTO staging_jobs (
        id, job_type, filter_hash, params, status, stage, 
        last_page, processed_count, total_companies, error_count, 
        last_error, migration_status, rate_limit_stats, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      job.id,
      job.jobType,
      job.filterHash,
      JSON.stringify(job.params),
      job.status,
      job.stage,
      job.lastPage || 0,
      job.processedCount || 0,
      job.totalCompanies || 0,
      job.errorCount || 0,
      job.lastError || null,
      job.migrationStatus || 'pending',
      job.rateLimitStats ? JSON.stringify(job.rateLimitStats) : null,
      job.createdAt,
      job.updatedAt
    );
  }

  getJob(jobId: string): StagingJob | null {
    const stmt = this.db.prepare('SELECT * FROM staging_jobs WHERE id = ?');
    const row = stmt.get(jobId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      jobType: row.job_type,
      filterHash: row.filter_hash,
      params: JSON.parse(row.params),
      status: row.status,
      stage: row.stage,
      lastPage: row.last_page,
      processedCount: row.processed_count,
      totalCompanies: row.total_companies,
      errorCount: row.error_count,
      lastError: row.last_error,
      migrationStatus: row.migration_status,
      rateLimitStats: row.rate_limit_stats ? JSON.parse(row.rate_limit_stats) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  updateJob(jobId: string, updates: Partial<StagingJob>) {
    const fields = [];
    const values = [];
    
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.stage !== undefined) {
      fields.push('stage = ?');
      values.push(updates.stage);
    }
    if (updates.lastPage !== undefined) {
      fields.push('last_page = ?');
      values.push(updates.lastPage);
    }
    if (updates.processedCount !== undefined) {
      fields.push('processed_count = ?');
      values.push(updates.processedCount);
    }
    if (updates.totalCompanies !== undefined) {
      fields.push('total_companies = ?');
      values.push(updates.totalCompanies);
    }
    if (updates.errorCount !== undefined) {
      fields.push('error_count = ?');
      values.push(updates.errorCount);
    }
    if (updates.lastError !== undefined) {
      fields.push('last_error = ?');
      values.push(updates.lastError);
    }
    if (updates.migrationStatus !== undefined) {
      fields.push('migration_status = ?');
      values.push(updates.migrationStatus);
    }
    if (updates.rateLimitStats !== undefined) {
      fields.push('rate_limit_stats = ?');
      values.push(JSON.stringify(updates.rateLimitStats));
    }
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(jobId);
    
    const stmt = this.db.prepare(`UPDATE staging_jobs SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  getJobStats(jobId: string) {
    const companiesStmt = this.db.prepare('SELECT COUNT(*) as count FROM staging_companies WHERE job_id = ?');
    const companiesCount = companiesStmt.get(jobId) as { count: number };
    
    const companyIdsStmt = this.db.prepare('SELECT COUNT(*) as count FROM staging_company_ids WHERE job_id = ?');
    const companyIdsCount = companyIdsStmt.get(jobId) as { count: number };
    
    const financialsStmt = this.db.prepare('SELECT COUNT(*) as count FROM staging_financials WHERE job_id = ?');
    const financialsCount = financialsStmt.get(jobId) as { count: number };
    
    return {
      companies: companiesCount.count,
      companyIds: companyIdsCount.count,
      financials: financialsCount.count
    };
  }

  // Company management methods
  insertCompanies(companies: StagingCompany[]) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO staging_companies (
        orgnr, company_name, company_id, company_id_hint, homepage,
        nace_categories, segment_name, revenue_sek, profit_sek,
        foundation_year, company_accounts_last_year, scraped_at,
        job_id, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = this.db.transaction((companies: StagingCompany[]) => {
      for (const company of companies) {
        stmt.run(
          company.orgnr,
          company.companyName,
          company.companyId || null,
          company.companyIdHint || null,
          company.homepage || null,
          JSON.stringify(company.naceCategories),
          JSON.stringify(company.segmentName),
          company.revenueSek || null,
          company.profitSek || null,
          company.foundationYear || null,
          company.companyAccountsLastYear || null,
          company.scrapedAt,
          company.jobId,
          company.status,
          company.updatedAt
        );
      }
    });
    
    insertMany(companies);
  }

  getCompanies(jobId: string): StagingCompany[] {
    const stmt = this.db.prepare('SELECT * FROM staging_companies WHERE job_id = ?');
    const rows = stmt.all(jobId) as any[];
    
    return rows.map(row => ({
      orgnr: row.orgnr,
      companyName: row.company_name,
      companyId: row.company_id,
      companyIdHint: row.company_id_hint,
      homepage: row.homepage,
      naceCategories: JSON.parse(row.nace_categories),
      segmentName: JSON.parse(row.segment_name),
      revenueSek: row.revenue_sek,
      profitSek: row.profit_sek,
      foundationYear: row.foundation_year,
      companyAccountsLastYear: row.company_accounts_last_year,
      scrapedAt: row.scraped_at,
      jobId: row.job_id,
      status: row.status,
      updatedAt: row.updated_at
    }));
  }

  updateCompany(orgnr: string, updates: Partial<StagingCompany>) {
    const fields = [];
    const values = [];
    
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.companyId !== undefined) {
      fields.push('company_id = ?');
      values.push(updates.companyId);
    }
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(orgnr);
    
    const stmt = this.db.prepare(`UPDATE staging_companies SET ${fields.join(', ')} WHERE orgnr = ?`);
    stmt.run(...values);
  }

  updateCompanyStatus(jobId: string, orgnr: string, status: string, errorMessage?: string) {
    const fields = ['status = ?', 'updated_at = ?'];
    const values = [status, new Date().toISOString()];
    
    if (errorMessage) {
      fields.push('last_error = ?');
      values.push(errorMessage);
    }
    
    values.push(orgnr);
    
    const stmt = this.db.prepare(`UPDATE staging_companies SET ${fields.join(', ')} WHERE orgnr = ? AND job_id = ?`);
    stmt.run(...values, jobId);
  }

  insertCompanyIds(companyIds: any[]) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO staging_company_ids (orgnr, company_id, source, confidence_score, scraped_at, job_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = this.db.transaction((companyIds: any[]) => {
      for (const companyId of companyIds) {
        stmt.run(
          companyId.orgnr,
          companyId.companyId,
          companyId.source || 'scraper',
          companyId.confidenceScore || '1.0',
          companyId.scrapedAt || new Date().toISOString(),
          companyId.jobId,
          companyId.status || 'pending',
          new Date().toISOString()
        );
      }
    });
    
    insertMany(companyIds);
  }

  getCompanyIds(jobId: string): any[] {
    console.log(`Getting company IDs for job: ${jobId}`);
    const stmt = this.db.prepare(`
      SELECT * FROM staging_company_ids WHERE job_id = ?
    `);
    const results = stmt.all(jobId);
    console.log(`Found ${results.length} company IDs for job ${jobId}`);
    return results;
  }

  getCompanyIdsToProcess(jobId: string, status: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM staging_company_ids WHERE job_id = ? AND status = ?
    `);
    return stmt.all(jobId, status);
  }

  updateCompanyIdStatus(jobId: string, orgnr: string, status: string, error?: string) {
    const fields = ['status = ?', 'updated_at = ?'];
    const values = [status, new Date().toISOString()];
    
    if (error) {
      fields.push('error_message = ?');
      values.push(error);
    }
    
    const stmt = this.db.prepare(`UPDATE staging_company_ids SET ${fields.join(', ')} WHERE orgnr = ? AND job_id = ?`);
    stmt.run(...values, orgnr, jobId);
  }

  insertFinancials(financials: any[]) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO staging_financials (
        id, company_id, orgnr, year, period, period_start, period_end, currency,
        revenue, profit, employees, be, tr, raw_data, validation_status, scraped_at, job_id, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = this.db.transaction((financials: any[]) => {
      for (const financial of financials) {
        stmt.run(
          financial.id,
          financial.companyId,
          financial.orgnr,
          financial.year,
          financial.period,
          financial.periodStart,
          financial.periodEnd,
          financial.currency,
          financial.revenue,
          financial.profit,
          financial.employees,
          financial.be,
          financial.tr,
          financial.rawData,
          financial.validationStatus,
          financial.scrapedAt,
          financial.jobId,
          financial.updatedAt
        );
      }
    });
    
    insertMany(financials);
  }

  getCompanyByOrgnr(jobId: string, orgnr: string): any {
    const stmt = this.db.prepare('SELECT * FROM staging_companies WHERE job_id = ? AND orgnr = ?');
    const row = stmt.get(jobId, orgnr) as any;
    
    if (row) {
      return {
        orgnr: row.orgnr,
        companyName: row.company_name,
        companyId: row.company_id,
        companyIdHint: row.company_id_hint,
        homepage: row.homepage,
        foundationYear: row.foundation_year,
        revenueSek: row.revenue_sek,
        profitSek: row.profit_sek,
        naceCategories: row.nace_categories,
        segmentName: row.segment_name,
        status: row.status,
        jobId: row.job_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    
    return null;
  }

  getCompaniesToProcess(jobId: string, status: string): StagingCompany[] {
    const stmt = this.db.prepare('SELECT * FROM staging_companies WHERE job_id = ? AND status = ?');
    const rows = stmt.all(jobId, status) as any[];
    
    return rows.map(row => ({
      orgnr: row.orgnr,
      companyName: row.company_name,
      companyId: row.company_id,
      companyIdHint: row.company_id_hint,
      homepage: row.homepage,
      naceCategories: JSON.parse(row.nace_categories),
      segmentName: JSON.parse(row.segment_name),
      revenueSek: row.revenue_sek,
      profitSek: row.profit_sek,
      foundationYear: row.foundation_year,
      companyAccountsLastYear: row.company_accounts_last_year,
      scrapedAt: row.scraped_at,
      jobId: row.job_id,
      status: row.status,
      updatedAt: row.updated_at
    }));
  }

  // Enhanced methods for UI data validation
  getCompaniesWithDetails(jobId: string, filters: any = {}, pagination: any = {}) {
    const { page = 1, limit = 50 } = pagination;
    const { status, hasFinancials, searchTerm } = filters;
    
    let whereClause = 'WHERE c.job_id = ?';
    const params: any[] = [jobId];
    
    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }
    
    if (searchTerm) {
      whereClause += ' AND (c.company_name LIKE ? OR c.orgnr LIKE ?)';
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total 
      FROM staging_companies c
      LEFT JOIN staging_company_ids ci ON c.orgnr = ci.orgnr AND ci.job_id = ?
      LEFT JOIN staging_financials f ON c.orgnr = f.orgnr AND f.job_id = ?
      ${whereClause}
    `);
    const totalResult = countStmt.get(jobId, jobId, ...params) as { total: number };
    
    // Get paginated results
    const offset = (page - 1) * limit;
    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        ci.company_id as resolved_company_id,
        ci.confidence_score,
        COUNT(f.id) as financial_records,
        GROUP_CONCAT(DISTINCT f.year) as financial_years
      FROM staging_companies c
      LEFT JOIN staging_company_ids ci ON c.orgnr = ci.orgnr AND ci.job_id = ?
      LEFT JOIN staging_financials f ON c.orgnr = f.orgnr AND f.job_id = ?
      ${whereClause}
      GROUP BY c.orgnr
      ORDER BY c.company_name
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(jobId, jobId, ...params, limit, offset) as any[];
    
    const companies = rows.map(row => {
      const financialYears = row.financial_years 
        ? row.financial_years.split(',').map((y: string) => parseInt(y)).sort((a: number, b: number) => b - a)
        : [];
      
      // Get actual financial data for each year
      const financials = this.getFinancialsByOrgnr(jobId, row.orgnr);
      const financialsByYear = financials.reduce((acc: any, f: any) => {
        // Use year_period as key to handle different periods in same year
        const key = `${f.year}_${f.period || '12'}`;
        if (!acc[key]) {
          // Include ALL account codes and metrics from raw_data (50+ metrics)
          acc[key] = {
            year: f.year,
            period: f.period || '12',
            periodStart: f.period_start,
            periodEnd: f.period_end,
            currency: f.currency || 'SEK',
            revenue: f.revenue,
            profit: f.profit,
            employees: f.employees,
            be: f.be,
            tr: f.tr,
            // Core financial metrics
            sdi: f.sdi || null,
            dr: f.dr || null,
            ors: f.ors || null, // EBITDA
            rg: f.rg || null,   // Operating Income (EBIT)
            ek: f.ek || null,   // Equity
            fk: f.fk || null,   // Debt
            // Additional account codes (50+ metrics)
            adi: f.adi || null,
            adk: f.adk || null,
            adr: f.adr || null,
            ak: f.ak || null,
            ant: f.ant || null,
            fi: f.fi || null,
            gg: f.gg || null,
            kbp: f.kbp || null,
            lg: f.lg || null,
            sap: f.sap || null,
            sed: f.sed || null,
            si: f.si || null,
            sek: f.sek || null,
            sf: f.sf || null,
            sfa: f.sfa || null,
            sge: f.sge || null,
            sia: f.sia || null,
            sik: f.sik || null,
            skg: f.skg || null,
            skgki: f.skgki || null,
            sko: f.sko || null,
            slg: f.slg || null,
            som: f.som || null,
            sub: f.sub || null,
            sv: f.sv || null,
            svd: f.svd || null,
            utr: f.utr || null,
            fsd: f.fsd || null,
            kb: f.kb || null,
            awa: f.awa || null,
            iac: f.iac || null,
            min: f.min || null,
            // Complete raw data for reference (includes all JSON data)
            rawData: f.rawData || null
          };
        }
        return acc;
      }, {});
      
      return {
        orgnr: row.orgnr,
        companyName: row.company_name,
        companyId: row.company_id,
        status: row.status,
        stage1Data: {
          revenue: row.revenue_sek,
          profit: row.profit_sek,
          nace: JSON.parse(row.nace_categories),
          segment: JSON.parse(row.segment_name),
          homepage: row.homepage,
          foundedYear: row.foundation_year
        },
        stage2Data: {
          companyId: row.resolved_company_id,
          confidence: row.confidence_score
        },
        stage3Data: {
          years: financialYears,
          recordCount: row.financial_records,
          validationStatus: row.financial_records > 0 ? 'complete' : 'pending',
          financials: Object.values(financialsByYear) // Array of financial records by year/period
        },
        errors: []
      };
    });
    
    return {
      companies,
      pagination: {
        page,
        limit,
        total: totalResult.total,
        pages: Math.ceil(totalResult.total / limit)
      }
    };
  }

  getFinancialYears(orgnr: string): number[] {
    const stmt = this.db.prepare('SELECT DISTINCT year FROM staging_financials WHERE orgnr = ? ORDER BY year DESC');
    const rows = stmt.all(orgnr) as { year: number }[];
    return rows.map(row => row.year);
  }

  getFinancialsByOrgnr(jobId: string, orgnr: string): any[] {
    const stmt = this.db.prepare(`
      SELECT 
        year,
        period,
        period_start,
        period_end,
        currency,
        revenue,
        profit,
        employees,
        be,
        tr,
        raw_data
      FROM staging_financials
      WHERE job_id = ? AND orgnr = ?
      ORDER BY year DESC, period DESC
    `);
    const rows = stmt.all(jobId, orgnr) as any[];
    
    // Parse raw_data to extract ALL account codes (50+ metrics)
    return rows.map(row => {
      let parsedRawData: any = {};
      try {
        parsedRawData = JSON.parse(row.raw_data || '{}');
      } catch (e) {
        // If parsing fails, use empty object
      }
      
      // Extract account codes from raw_data structure
      // The raw_data can be in different formats:
      // 1. Direct account codes (sdi, dr, etc.) - already extracted
      // 2. Complete JSON response with pageProps.company.companyAccounts
      // 3. Report structure with accounts array
      
      let accountCodes: Record<string, number | null> = {};
      
      // Try to extract from pageProps structure (complete JSON response)
      if (parsedRawData.pageProps?.company?.companyAccounts) {
        const companyAccounts = parsedRawData.pageProps.company.companyAccounts;
        // Find the report matching this year and period
        // Period can be in format "2024-08" or "12" or just the year
        const period = row.period || '12';
        const periodYear = period.split('-')[0];
        const periodMonth = period.split('-')[1] || '12';
        
        const matchingReport = companyAccounts.find((r: any) => {
          const reportYear = r.year;
          const reportPeriod = String(r.period || '12');
          // Match by year and try to match period (can be "2024-08" or "12" or "08")
          return reportYear === row.year && (
            reportPeriod === period || 
            reportPeriod === periodMonth ||
            reportPeriod === periodYear ||
            period === reportPeriod
          );
        });
        
        if (matchingReport?.accounts) {
          for (const account of matchingReport.accounts) {
            if (account.code && account.amount !== null && account.amount !== undefined) {
              const amount = parseFloat(account.amount);
              if (!isNaN(amount)) {
                accountCodes[account.code] = amount;
              }
            }
          }
        }
      }
      
      // Try to extract from direct account codes (if stored at top level)
      if (parsedRawData.sdi !== undefined || parsedRawData.dr !== undefined) {
        accountCodes = { ...parsedRawData };
      }
      
      // Extract ALL account codes from raw_data (50+ metrics)
      return {
        year: row.year,
        period: row.period,
        period_start: row.period_start,
        period_end: row.period_end,
        currency: row.currency,
        revenue: row.revenue,
        profit: row.profit,
        employees: row.employees,
        be: row.be,
        tr: row.tr,
        // Core financial metrics (from accountCodes or parsedRawData)
        sdi: accountCodes['SDI'] || parsedRawData.sdi || null,  // Revenue
        dr: accountCodes['DR'] || parsedRawData.dr || null,    // Net profit
        ors: accountCodes['ORS'] || parsedRawData.ors || null,  // EBITDA
        rg: accountCodes['RG'] || parsedRawData.rg || null,    // Operating Income (EBIT)
        ek: accountCodes['EK'] || parsedRawData.ek || null,    // Equity
        fk: accountCodes['FK'] || parsedRawData.fk || null,    // Debt
        // Additional account codes (50+ metrics)
        adi: accountCodes['ADI'] || parsedRawData.adi || null,
        adk: accountCodes['ADK'] || parsedRawData.adk || null,
        adr: accountCodes['ADR'] || parsedRawData.adr || null,
        ak: accountCodes['AK'] || parsedRawData.ak || null,
        ant: accountCodes['ANT'] || parsedRawData.ant || null,
        fi: accountCodes['FI'] || parsedRawData.fi || null,
        gg: accountCodes['GG'] || parsedRawData.gg || null,
        kbp: accountCodes['KBP'] || parsedRawData.kbp || null,
        lg: accountCodes['LG'] || parsedRawData.lg || null,
        sap: accountCodes['SAP'] || parsedRawData.sap || null,
        sed: accountCodes['SED'] || parsedRawData.sed || null,
        si: accountCodes['SI'] || parsedRawData.si || null,
        sek: accountCodes['SEK'] || parsedRawData.sek || null,
        sf: accountCodes['SF'] || parsedRawData.sf || null,
        sfa: accountCodes['SFA'] || parsedRawData.sfa || null,
        sge: accountCodes['SGE'] || parsedRawData.sge || null,
        sia: accountCodes['SIA'] || parsedRawData.sia || null,
        sik: accountCodes['SIK'] || parsedRawData.sik || null,
        skg: accountCodes['SKG'] || parsedRawData.skg || null,
        skgki: accountCodes['SKGKI'] || parsedRawData.skgki || null,
        sko: accountCodes['SKO'] || parsedRawData.sko || null,
        slg: accountCodes['SLG'] || parsedRawData.slg || null,
        som: accountCodes['SOM'] || parsedRawData.som || null,
        sub: accountCodes['SUB'] || parsedRawData.sub || null,
        sv: accountCodes['SV'] || parsedRawData.sv || null,
        svd: accountCodes['SVD'] || parsedRawData.svd || null,
        utr: accountCodes['UTR'] || parsedRawData.utr || null,
        fsd: accountCodes['FSD'] || parsedRawData.fsd || null,
        kb: accountCodes['KB'] || parsedRawData.kb || null,
        awa: accountCodes['AWA'] || parsedRawData.awa || null,
        iac: accountCodes['IAC'] || parsedRawData.iac || null,
        min: accountCodes['MIN'] || parsedRawData.min || null,
        // Include all account codes as a map for easy access
        allAccountCodes: accountCodes,
        // Complete raw data for reference
        rawData: parsedRawData
      };
    });
  }

  getFinancialYearsForJob(jobId: string): { year: number }[] {
    const stmt = this.db.prepare('SELECT DISTINCT year FROM staging_financials WHERE job_id = ? ORDER BY year DESC');
    return stmt.all(jobId) as { year: number }[];
  }

  getFinancialSummary(jobId: string) {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT c.orgnr) as total_companies,
        COUNT(DISTINCT ci.orgnr) as companies_with_ids,
        COUNT(DISTINCT f.orgnr) as companies_with_financials,
        COUNT(f.id) as total_financial_records,
        AVG(financial_count.record_count) as avg_records_per_company
      FROM staging_companies c
      LEFT JOIN staging_company_ids ci ON c.orgnr = ci.orgnr AND ci.job_id = ?
      LEFT JOIN staging_financials f ON c.orgnr = f.orgnr AND f.job_id = ?
      LEFT JOIN (
        SELECT orgnr, COUNT(*) as record_count 
        FROM staging_financials 
        WHERE job_id = ? 
        GROUP BY orgnr
      ) financial_count ON c.orgnr = financial_count.orgnr
      WHERE c.job_id = ?
    `);
    
    const result = stmt.get(jobId, jobId, jobId, jobId) as any;
    
    return {
      totalCompanies: result.total_companies || 0,
      companiesWithIds: result.companies_with_ids || 0,
      companiesWithFinancials: result.companies_with_financials || 0,
      totalFinancialRecords: result.total_financial_records || 0,
      avgRecordsPerCompany: Math.round(result.avg_records_per_company || 0),
      stage1Progress: result.total_companies > 0 ? 100 : 0,
      stage2Progress: result.total_companies > 0 ? Math.round((result.companies_with_ids / result.total_companies) * 100) : 0,
      stage3Progress: result.total_companies > 0 ? Math.round((result.companies_with_financials / result.total_companies) * 100) : 0
    };
  }

  getCompanyErrors(jobId: string) {
    const stmt = this.db.prepare(`
      SELECT 
        c.orgnr,
        c.company_name,
        c.status,
        CASE 
          WHEN c.status = 'error' THEN 'Stage 1: Segmentation failed'
          WHEN ci.orgnr IS NULL AND c.status != 'error' THEN 'Stage 2: Company ID not resolved'
          WHEN f.orgnr IS NULL AND ci.orgnr IS NOT NULL THEN 'Stage 3: Financial data not fetched'
          ELSE NULL
        END as error_message
      FROM staging_companies c
      LEFT JOIN staging_company_ids ci ON c.orgnr = ci.orgnr AND ci.job_id = ?
      LEFT JOIN staging_financials f ON c.orgnr = f.orgnr AND f.job_id = ?
      WHERE c.job_id = ? 
        AND (c.status = 'error' 
             OR (ci.orgnr IS NULL AND c.status != 'error')
             OR (f.orgnr IS NULL AND ci.orgnr IS NOT NULL))
    `);
    
    const rows = stmt.all(jobId, jobId, jobId) as any[];
    
    return rows.map(row => ({
      orgnr: row.orgnr,
      companyName: row.company_name,
      status: row.status,
      errorMessage: row.error_message
    }));
  }

  // Utility: expose limited schema info for debugging
  getTableSchema(tableName: string) {
    const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
    return stmt.all();
  }

  addColumnIfMissing(tableName: string, columnDef: string) {
    const [columnName] = columnDef.split(' ');
    const schema = this.getTableSchema(tableName) as Array<{ name: string }>;
    const exists = schema.some(col => col.name === columnName);
    if (exists) return false;
    this.db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`).run();
    return true;
  }

  // Cleanup
  close() {
    this.db.close();
  }
}
