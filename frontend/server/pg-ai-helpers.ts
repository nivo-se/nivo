/**
 * Postgres queries for AI analysis / valuation (used by enhanced-server).
 */

import type { Pool } from 'pg'

export async function checkAiCreditsLimit(
  pool: Pool,
  userId: string,
  estimatedCostUsd: number
): Promise<{ allowed: boolean; message: string }> {
  try {
    const cfg = (
      await pool.query(
        `SELECT global_monthly_limit_usd, per_user_monthly_limit_usd FROM ai_credits_config WHERE id = 1`
      )
    ).rows[0]
    if (!cfg) return { allowed: true, message: '' }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const usage = (
      await pool.query(`SELECT user_id, amount_usd FROM ai_credits_usage WHERE created_at >= $1`, [
        startOfMonth,
      ])
    ).rows

    let userTotal = 0
    let globalTotal = 0
    for (const row of usage) {
      const amt = Number(row?.amount_usd ?? 0)
      globalTotal += amt
      if (row?.user_id === userId) userTotal += amt
    }
    const globalLimit = Number(cfg.global_monthly_limit_usd ?? 999999)
    const perUserLimit =
      cfg.per_user_monthly_limit_usd != null ? Number(cfg.per_user_monthly_limit_usd) : null
    if (perUserLimit != null && userTotal + estimatedCostUsd > perUserLimit) {
      return {
        allowed: false,
        message: `Per-user AI spend limit reached ($${userTotal.toFixed(2)} / $${perUserLimit.toFixed(2)} this month).`,
      }
    }
    if (globalTotal + estimatedCostUsd > globalLimit) {
      return {
        allowed: false,
        message: `Global AI spend limit reached ($${globalTotal.toFixed(2)} / $${globalLimit.toFixed(2)} this month).`,
      }
    }
    return { allowed: true, message: '' }
  } catch {
    return { allowed: true, message: '' }
  }
}

export async function recordAiCreditsUsage(
  pool: Pool,
  userId: string,
  amountUsd: number,
  operationType: 'screening' | 'deep_analysis',
  runId: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ai_credits_usage (user_id, amount_usd, operation_type, run_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, amountUsd, operationType, runId]
    )
  } catch (e) {
    console.warn('Failed to record AI credits usage:', e)
  }
}

export async function insertRunRecord(pool: Pool, run: any): Promise<void> {
  const initiatedBy = run.initiatedBy || 'unknown-user'
  const r = await pool.query(
    `INSERT INTO ai_analysis_runs (
      id, initiated_by, model_version, analysis_mode, status, started_at, completed_at,
      error_message, analysis_template_id, analysis_template_name, custom_instructions, company_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      run.id,
      initiatedBy,
      run.modelVersion,
      run.analysisMode,
      run.status,
      run.startedAt,
      run.completedAt,
      run.errorMessage ?? null,
      run.templateId ?? null,
      run.templateName ?? null,
      run.customInstructions ?? null,
      run.companyCount,
    ]
  )
}

export async function updateRunRecord(pool: Pool, run: any): Promise<void> {
  const r = await pool.query(
    `UPDATE ai_analysis_runs SET status = $1, completed_at = $2, error_message = $3 WHERE id = $4`,
    [run.status, run.completedAt, run.errorMessage ?? null, run.id]
  )
  if (r.rowCount === 0) {
    throw new Error('Failed to update analysis run')
  }
}

export async function fetchRunHistory(pool: Pool, limit: number): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT * FROM ai_analysis_runs ORDER BY started_at DESC LIMIT $1`,
    [limit]
  )
  return rows
}

export async function fetchAnalysisRuns(pool: Pool, filters: any) {
  const {
    page,
    limit,
    search,
    analysisMode,
    templateId,
    dateFrom,
    dateTo,
    status,
    sortBy,
    sortOrder,
  } = filters

  const conditions: string[] = []
  const params: unknown[] = []
  let p = 1

  if (search) {
    conditions.push(
      `(r.analysis_template_name ILIKE $${p} OR r.custom_instructions ILIKE $${p} OR r.id::text ILIKE $${p})`
    )
    params.push(`%${search}%`)
    p++
  }
  if (analysisMode && analysisMode !== 'all') {
    conditions.push(`r.analysis_mode = $${p}`)
    params.push(analysisMode)
    p++
  }
  if (templateId && templateId !== 'all') {
    if (templateId === 'custom') {
      conditions.push(`r.analysis_template_id IS NULL`)
    } else {
      conditions.push(`r.analysis_template_id = $${p}`)
      params.push(templateId)
      p++
    }
  }
  if (dateFrom) {
    conditions.push(`r.started_at >= $${p}`)
    params.push(dateFrom)
    p++
  }
  if (dateTo) {
    conditions.push(`r.started_at <= $${p}`)
    params.push(dateTo)
    p++
  }
  if (status && status !== 'all') {
    conditions.push(`r.status = $${p}`)
    params.push(status)
    p++
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const orderColSafe =
    sortBy === 'companies'
      ? 'company_count'
      : sortBy === 'template'
        ? 'analysis_template_name'
        : 'started_at'
  const asc = sortOrder === 'asc'
  const orderDir = asc ? 'ASC' : 'DESC'

  const countQ = await pool.query(
    `SELECT COUNT(*)::int AS c FROM ai_analysis_runs r ${whereSql}`,
    params
  )
  const total = countQ.rows[0]?.c ?? 0

  const offset = (page - 1) * limit
  const dataParams = [...params, limit, offset]
  const limIdx = p
  const offIdx = p + 1

  const { rows: data } = await pool.query(
    `SELECT r.*,
      COALESCE((
        SELECT json_agg(json_build_object('orgnr', c.orgnr, 'company_name', c.company_name))
        FROM ai_company_analysis c WHERE c.run_id = r.id
      ), '[]'::json) AS ai_company_analysis,
      COALESCE((
        SELECT json_agg(json_build_object('orgnr', s.orgnr, 'company_name', s.company_name))
        FROM ai_screening_results s WHERE s.run_id = r.id
      ), '[]'::json) AS ai_screening_results
     FROM ai_analysis_runs r
     ${whereSql}
     ORDER BY r.${orderColSafe} ${orderDir}
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    dataParams
  )

  const runs = (data || []).map((run: any) => {
    const companies = new Map<string, { orgnr: string; name: string }>()
    const ca = Array.isArray(run.ai_company_analysis) ? run.ai_company_analysis : []
    const sr = Array.isArray(run.ai_screening_results) ? run.ai_screening_results : []
    for (const company of ca) {
      if (company?.orgnr) {
        companies.set(company.orgnr, { orgnr: company.orgnr, name: company.company_name })
      }
    }
    for (const company of sr) {
      if (company?.orgnr) {
        companies.set(company.orgnr, { orgnr: company.orgnr, name: company.company_name })
      }
    }
    return {
      id: run.id,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      analysisMode: run.analysis_mode,
      templateName: run.analysis_template_name,
      customInstructions: run.custom_instructions,
      companyCount: run.company_count || 0,
      companies: Array.from(companies.values()),
      status: run.status,
      modelVersion: run.model_version,
      initiatedBy: run.initiated_by,
    }
  })

  const totalPages = Math.ceil(total / limit) || 0
  return { runs, total, page, totalPages }
}

export async function fetchRunDetail(pool: Pool, runId: string) {
  const runQ = await pool.query(`SELECT * FROM ai_analysis_runs WHERE id = $1`, [runId])
  const runData = runQ.rows[0]
  if (!runData) return null

  if (runData.analysis_mode === 'screening') {
    const screeningQ = await pool.query(`SELECT * FROM ai_screening_results WHERE run_id = $1`, [runId])
    return {
      run: {
        id: runData.id,
        status: runData.status,
        modelVersion: runData.model_version,
        analysisMode: runData.analysis_mode,
        startedAt: runData.started_at,
        completedAt: runData.completed_at,
        errorMessage: runData.error_message,
      },
      results: screeningQ.rows || [],
    }
  }

  const analysisQ = await pool.query(
    `SELECT
      id, run_id, orgnr, company_name, summary, recommendation, confidence, risk_score,
      financial_grade, commercial_grade, operational_grade, next_steps, created_at,
      executive_summary, key_findings, narrative, strengths, weaknesses, opportunities, risks,
      acquisition_interest, financial_health_score, growth_outlook, market_position, target_price_msek
     FROM ai_company_analysis WHERE run_id = $1`,
    [runId]
  )
  const analysisData = analysisQ.rows || []

  const transformedCompanies = analysisData.map((item: any) => ({
    id: item.id,
    runId: item.run_id,
    orgnr: item.orgnr,
    companyName: item.company_name,
    summary: item.summary,
    recommendation: item.recommendation,
    confidence: item.confidence,
    riskScore: item.risk_score,
    financialGrade: item.financial_grade,
    commercialGrade: item.commercial_grade,
    operationalGrade: item.operational_grade,
    nextSteps: item.next_steps || [],
    createdAt: item.created_at,
    executiveSummary: item.executive_summary,
    keyFindings: item.key_findings,
    narrative: item.narrative,
    strengths: item.strengths,
    weaknesses: item.weaknesses,
    opportunities: item.opportunities,
    risks: item.risks,
    acquisitionInterest: item.acquisition_interest,
    financialHealth: item.financial_health_score,
    growthPotential: item.growth_outlook,
    marketPosition: item.market_position,
    targetPrice: item.target_price_msek,
  }))

  return {
    run: {
      id: runData.id,
      status: runData.status,
      modelVersion: runData.model_version,
      analysisMode: runData.analysis_mode,
      startedAt: runData.started_at,
      completedAt: runData.completed_at,
      errorMessage: runData.error_message,
    },
    companies: transformedCompanies,
  }
}

export async function fetchCompanyDataFromNewSchema(pool: Pool, orgnr: string): Promise<any | null> {
  const companyQ = await pool.query(
    `SELECT orgnr, company_name, segment_names, address, homepage, email, foundation_year, employees_latest
     FROM companies WHERE orgnr = $1`,
    [orgnr]
  )
  const companyData = companyQ.rows[0]
  if (!companyData) {
    console.error(`[valuation] Failed to fetch company row for ${orgnr}`)
    return null
  }

  const metricsQ = await pool.query(
    `SELECT orgnr, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek, revenue_cagr_3y,
            avg_ebitda_margin, avg_net_margin, digital_presence
     FROM company_metrics WHERE orgnr = $1`,
    [orgnr]
  )
  const metricsData = metricsQ.rows[0]
  if (!metricsQ.rows.length) {
    console.warn(`[valuation] Metrics fetch warning for ${orgnr}`)
  }

  const segmentNames = Array.isArray(companyData.segment_names)
    ? companyData.segment_names
    : companyData.segment_names
      ? [companyData.segment_names]
      : []

  let city: string | null = null
  if (companyData.address) {
    if (typeof companyData.address === 'object') {
      city =
        companyData.address.postPlace || companyData.address.visitorAddress?.postPlace || null
    }
  }

  const revenue = metricsData?.latest_revenue_sek ? metricsData.latest_revenue_sek * 1000 : null
  const profit = metricsData?.latest_profit_sek ? metricsData.latest_profit_sek * 1000 : null

  return {
    OrgNr: companyData.orgnr,
    name: companyData.company_name,
    segment_name: segmentNames[0] || null,
    city: city,
    employees: companyData.employees_latest,
    revenue: revenue,
    profit: profit,
    SDI: metricsData?.latest_revenue_sek || null,
    DR: metricsData?.latest_profit_sek || null,
    ORS: metricsData?.latest_ebitda_sek || null,
    Revenue_growth: metricsData?.revenue_cagr_3y || null,
    EBIT_margin: metricsData?.avg_ebitda_margin || null,
    NetProfit_margin: metricsData?.avg_net_margin || null,
    digital_presence: metricsData?.digital_presence || false,
    incorporation_date: companyData.foundation_year ? `${companyData.foundation_year}-01-01` : null,
    email: companyData.email,
    homepage: companyData.homepage,
    address: companyData.address,
  }
}

export async function fetchValuationSourceData(pool: Pool, companyIds: string[]) {
  const companyRows = (
    await pool.query(
      `SELECT orgnr, company_name, segment_names, employees_latest FROM companies WHERE orgnr = ANY($1::text[])`,
      [companyIds]
    )
  ).rows

  const metricsRows = (
    await pool.query(
      `SELECT orgnr, latest_revenue_sek, latest_profit_sek, latest_ebitda_sek, revenue_cagr_3y,
              avg_ebitda_margin, avg_net_margin
       FROM company_metrics WHERE orgnr = ANY($1::text[])`,
      [companyIds]
    )
  ).rows

  const accountRows = (
    await pool.query(
      `SELECT orgnr, year, account_code, amount_sek FROM financial_accounts
       WHERE orgnr = ANY($1::text[]) AND period = '12' ORDER BY year DESC`,
      [companyIds]
    )
  ).rows

  const accountsMap = new Map<string, Map<number, any>>()
  for (const row of accountRows || []) {
    const orgnr = row.orgnr
    if (!orgnr) continue
    if (!accountsMap.has(orgnr)) {
      accountsMap.set(orgnr, new Map())
    }
    const yearMap = accountsMap.get(orgnr)!
    const year = row.year
    if (!yearMap.has(year)) {
      yearMap.set(year, { year })
    }
    const record = yearMap.get(year)!
    if (row.account_code === 'SDI') record.SDI = row.amount_sek
    else if (row.account_code === 'RG') record.RG = row.amount_sek
    else if (row.account_code === 'DR') record.DR = row.amount_sek
    else if (row.account_code === 'EBITDA') record.EBITDA = row.amount_sek
  }

  const companiesMap = new Map<string, any>()
  for (const companyRow of companyRows || []) {
    const orgnr = companyRow.orgnr
    const metricsRow = metricsRows?.find((m: any) => m.orgnr === orgnr)
    const segmentNames = Array.isArray(companyRow.segment_names)
      ? companyRow.segment_names
      : companyRow.segment_names
        ? [companyRow.segment_names]
        : []

    const fallbackYear = new Date().getFullYear()
    const fallbackRecord = {
      year: fallbackYear,
      SDI: metricsRow?.latest_revenue_sek || null,
      RG: metricsRow?.latest_revenue_sek || null,
      EBIT: metricsRow?.latest_ebitda_sek || null,
      EBITDA: metricsRow?.latest_ebitda_sek || null,
      DR: metricsRow?.latest_profit_sek || null,
    }

    const yearRecords = accountsMap.get(orgnr) || new Map()
    const records =
      Array.from(yearRecords.values()).length > 0 ? Array.from(yearRecords.values()) : [fallbackRecord]

    companiesMap.set(orgnr, {
      orgnr: orgnr,
      name: companyRow.company_name || 'Okänt bolag',
      industry: segmentNames[0] || null,
      employees: companyRow.employees_latest || null,
      records,
    })
  }

  return { companies: Array.from(companiesMap.values()) }
}

export async function persistValuationSession(
  pool: Pool,
  payload: {
    companyIds: string[]
    mode: 'default' | 'deep'
    companies: any[]
    insights: { companyInsights: Record<string, any>; overallSummary: string }
    exportDataset: any
  }
): Promise<string | null> {
  const r = await pool.query(
    `INSERT INTO valuation_sessions (
      company_ids, "mode", valuation_payload, overall_summary, export_dataset, generated_at
    ) VALUES ($1::text[], $2, $3::jsonb, $4, $5::jsonb, $6)
    RETURNING id`,
    [
      payload.companyIds,
      payload.mode,
      JSON.stringify(
        payload.companies.map((company) => ({
          orgnr: company.orgnr,
          name: company.name,
          industry: company.industry,
          employees: company.employees,
          metrics: company.metrics,
          history: company.history,
          aiInsights: payload.insights.companyInsights[company.orgnr] ?? null,
        }))
      ),
      payload.insights.overallSummary,
      JSON.stringify(payload.exportDataset),
      new Date().toISOString(),
    ]
  )
  const id = r.rows[0]?.id
  return id != null ? String(id) : null
}
