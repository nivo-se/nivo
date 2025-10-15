import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { OpenAIService } from './services/openaiService.js'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local
config({ path: path.resolve(__dirname, '../.env.local') })

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

// Debug: Check if environment variables are loaded
console.log('Supabase URL:', supabaseUrl ? 'Loaded' : 'Missing')
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Loaded' : 'Missing')

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Real AI analysis endpoints with database integration
app.post('/api/ai-analysis', async (req, res) => {
  try {
    const { companies, analysisType = 'screening', instructions, filters, initiatedBy, userId } = req.body || {}
    
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Companies array is required' 
      })
    }

    console.log(`Processing ${analysisType} analysis for ${companies.length} companies`)

    // Fetch real company data from database
    const companyOrgnrs = companies.map(c => c.OrgNr || c.orgnr).filter(Boolean)
    const { data: realCompanies, error: fetchError } = await supabase
      .from('master_analytics')
      .select('*')
      .in('OrgNr', companyOrgnrs)

    if (fetchError) {
      console.error('Error fetching company data:', fetchError)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch company data' 
      })
    }

    console.log(`Found ${realCompanies?.length || 0} real companies in database`)

    // Create analysis run record in database
    const runId = crypto.randomUUID()
    const runRecord = {
      id: runId,
      initiated_by: userId || initiatedBy || 'test-user',
      status: 'completed',
      model_version: analysisType === 'screening' ? 'gpt-3.5-turbo' : 'gpt-4',
      analysis_mode: analysisType,
      filters_json: filters || null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_message: null
    }

    // Insert run record
    const { error: runError } = await supabase
      .from('ai_analysis_runs')
      .insert(runRecord)

    if (runError) {
      console.error('Error inserting run record:', runError)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save analysis run' 
      })
    }

    if (analysisType === 'screening') {
      // Generate screening results using real company data
      const screeningResults = companies.map(company => {
        const realCompany = realCompanies?.find(rc => rc.OrgNr === (company.OrgNr || company.orgnr))
        
        if (!realCompany) {
          console.warn(`No real data found for company ${company.OrgNr || company.orgnr}`)
        return {
          run_id: runId,
          orgnr: company.OrgNr || company.orgnr || '123456',
          company_name: company.name || 'Test Company',
          screening_score: 50, // Default low score for missing data
          risk_flag: 'High risk',
          brief_summary: `No financial data available for ${company.name || 'Test Company'}. Cannot perform proper screening analysis.`
        }
        }

        // Calculate screening score based on real financial metrics
        const revenue = realCompany.revenue || 0
        const profit = realCompany.profit || 0
        const employees = realCompany.employees || 0
        const revenueGrowth = realCompany.Revenue_growth || 0
        const ebitMargin = realCompany.EBIT_margin || 0
        
        // Simple scoring algorithm based on real metrics
        let score = 50 // Base score
        
        // Revenue growth bonus (0-20 points)
        if (revenueGrowth > 0.2) score += 20
        else if (revenueGrowth > 0.1) score += 15
        else if (revenueGrowth > 0.05) score += 10
        else if (revenueGrowth > 0) score += 5
        
        // Profitability bonus (0-15 points)
        if (ebitMargin > 0.1) score += 15
        else if (ebitMargin > 0.05) score += 10
        else if (ebitMargin > 0) score += 5
        
        // Size bonus (0-10 points)
        if (revenue > 100000) score += 10
        else if (revenue > 50000) score += 5
        
        // Employee stability (0-5 points)
        if (employees > 10) score += 5
        else if (employees > 5) score += 3
        
        score = Math.min(100, Math.max(0, score)) // Clamp between 0-100
        
        const riskFlag = score < 60 ? 'Elevated risk' : score < 80 ? 'Medium risk' : 'Low risk'
        
        return {
          run_id: runId,
          orgnr: realCompany.OrgNr,
          company_name: realCompany.name,
          screening_score: Math.round(score),
          risk_flag: riskFlag,
          brief_summary: `${realCompany.name} (${realCompany.OrgNr}): Revenue ${revenue.toLocaleString()} SEK, ${employees} employees, ${(revenueGrowth * 100).toFixed(1)}% growth, ${(ebitMargin * 100).toFixed(1)}% EBIT margin. ${realCompany.segment_name || 'Unknown sector'}.`
        }
      })

      // Insert screening results
      const { error: screeningError } = await supabase
        .from('ai_screening_results')
        .insert(screeningResults)

      if (screeningError) {
        console.error('Error inserting screening results:', screeningError)
      }

      return res.json({
        success: true,
        run: {
          id: runId,
          modelVersion: 'gpt-3.5-turbo',
          startedAt: runRecord.started_at,
          completedAt: runRecord.completed_at,
          status: 'completed',
          analysisMode: 'screening'
        },
        analysis: {
          results: screeningResults.map(r => ({
            orgnr: r.orgnr,
            company_name: r.company_name,
            screening_score: r.screening_score,
            risk_flag: r.risk_flag,
            brief_summary: r.brief_summary
          }))
        }
      })
    } else {
      // Generate deep analysis results using real company data
      const deepAnalysisResults = []
      const allSections = []
      
      for (const company of companies) {
        const realCompany = realCompanies?.find(rc => rc.OrgNr === (company.OrgNr || company.orgnr))
        
        if (!realCompany) {
          console.warn(`No real data found for company ${company.OrgNr || company.orgnr}`)
          deepAnalysisResults.push({
            run_id: runId,
            orgnr: company.OrgNr || company.orgnr || '123456',
            company_name: company.name || 'Test Company',
            summary: `No financial data available for ${company.name || 'Test Company'}. Cannot perform comprehensive analysis.`,
            recommendation: 'Sälj',
            confidence: 20,
            risk_score: 80,
            financial_grade: 'D',
            commercial_grade: 'D',
            operational_grade: 'D',
            next_steps: ['Skaffa tillgång till finansiell data']
          })
          continue
        }

        // Calculate grades based on real financial metrics (keep existing logic)
        const revenue = realCompany.revenue || 0
        const profit = realCompany.profit || 0
        const employees = realCompany.employees || 0
        const revenueGrowth = realCompany.Revenue_growth || 0
        const ebitMargin = realCompany.EBIT_margin || 0
        const netProfitMargin = realCompany.NetProfit_margin || 0
        
        // Financial grade calculation
        let financialGrade = 'D'
        if (ebitMargin > 0.1 && netProfitMargin > 0.05) financialGrade = 'A'
        else if (ebitMargin > 0.05 && netProfitMargin > 0.02) financialGrade = 'B'
        else if (ebitMargin > 0 && netProfitMargin > 0) financialGrade = 'C'
        
        // Commercial grade based on growth and size
        let commercialGrade = 'D'
        if (revenueGrowth > 0.2 && revenue > 50000) commercialGrade = 'A'
        else if (revenueGrowth > 0.1 && revenue > 25000) commercialGrade = 'B'
        else if (revenueGrowth > 0.05) commercialGrade = 'C'
        
        // Operational grade based on employee efficiency
        const revenuePerEmployee = employees > 0 ? revenue / employees : 0
        let operationalGrade = 'D'
        if (revenuePerEmployee > 5000 && employees > 5) operationalGrade = 'A'
        else if (revenuePerEmployee > 3000 && employees > 3) operationalGrade = 'B'
        else if (revenuePerEmployee > 2000) operationalGrade = 'C'
        
        // Overall recommendation
        const avgGrade = [financialGrade, commercialGrade, operationalGrade]
          .map(g => g === 'A' ? 4 : g === 'B' ? 3 : g === 'C' ? 2 : 1)
          .reduce((a, b) => a + b, 0) / 3
        
        let recommendation = 'Sälj'
        if (avgGrade >= 3.5) recommendation = 'Köp'
        else if (avgGrade >= 2.5) recommendation = 'Håll'
        
        // Risk score (inverted - lower is better)
        let riskScore = 50
        if (ebitMargin < 0) riskScore += 30
        if (revenueGrowth < 0) riskScore += 20
        if (employees < 3) riskScore += 15
        if (revenue < 10000) riskScore += 10
        
        riskScore = Math.min(100, Math.max(0, riskScore))
        
        // Confidence based on data completeness
        let confidence = 70
        if (revenue > 0 && employees > 0 && ebitMargin !== null) confidence = 85
        if (revenueGrowth !== null && netProfitMargin !== null) confidence = 95

        // Generate AI narrative insights using OpenAI
        console.log('Generating AI insights for:', realCompany.name)
        const aiInsights = await OpenAIService.generateDeepAnalysis(
          realCompany.name,
          realCompany.OrgNr,
          {
            revenue,
            profit,
            employees,
            revenueGrowth,
            ebitMargin,
            netProfitMargin,
            segmentName: realCompany.segment_name,
            companySizeCategory: realCompany.company_size_category,
            growthCategory: realCompany.growth_category,
            profitabilityCategory: realCompany.profitability_category
          }
        )
        
        // Store analysis result
        deepAnalysisResults.push({
          run_id: runId,
          orgnr: realCompany.OrgNr,
          company_name: realCompany.name,
          summary: aiInsights.summary, // Use AI-generated summary
          recommendation: recommendation,
          confidence: confidence,
          risk_score: riskScore,
          financial_grade: financialGrade,
          commercial_grade: commercialGrade,
          operational_grade: operationalGrade,
          next_steps: [
            'Genomför detaljerad finansiell analys',
            'Utvärdera marknadspotential',
            'Analysera konkurrensläge',
            'Bedöm operativa förbättringsmöjligheter'
          ]
        })

        // Store sections for later insertion
        for (const section of aiInsights.sections) {
          allSections.push({
            run_id: runId,
            section_type: section.section_type,
            title: section.title,
            content_md: section.content_md,
            confidence: section.confidence
          })
        }
      }

      // Insert company analysis results
      console.log('Attempting to insert', deepAnalysisResults.length, 'analysis results')
      console.log('Sample result:', JSON.stringify(deepAnalysisResults[0], null, 2))
      
      const { data: insertedData, error: analysisError } = await supabase
        .from('ai_company_analysis')
        .insert(deepAnalysisResults)
        .select()

      if (analysisError) {
        console.error('Error inserting analysis results:', analysisError)
        console.error('Error details:', JSON.stringify(analysisError, null, 2))
      } else {
        console.log('Successfully inserted', insertedData?.length || 0, 'analysis results')
        console.log('Inserted data:', JSON.stringify(insertedData, null, 2))
      }

      // Insert AI-generated sections
      if (allSections.length > 0) {
        const { error: sectionsError } = await supabase
          .from('ai_analysis_sections')
          .insert(allSections)

        if (sectionsError) {
          console.error('Error inserting analysis sections:', sectionsError)
        } else {
          console.log('Successfully inserted', allSections.length, 'analysis sections')
        }
      }

      return res.json({
        success: true,
        run: {
          id: runId,
          modelVersion: 'gpt-4',
          startedAt: runRecord.started_at,
          completedAt: runRecord.completed_at,
          status: 'completed',
          analysisMode: 'deep'
        },
        analysis: {
          companies: deepAnalysisResults.map(r => ({
            orgnr: r.orgnr,
            name: r.company_name,
            summary: r.summary,
            recommendation: r.recommendation,
            confidence: r.confidence,
            riskScore: r.risk_score,
            financialGrade: r.financial_grade,
            commercialGrade: r.commercial_grade,
            operationalGrade: r.operational_grade,
            nextSteps: r.next_steps,
            sections: [
              {
                section_type: 'financial_analysis',
                title: 'Finansiell Analys',
                content_md: `Finansiell analys för ${r.company_name}. Detta är en detaljerad bedömning av företagets ekonomiska hälsa.`,
                supporting_metrics: [
                  { metric_name: 'Omsättningstillväxt', metric_value: Math.floor(Math.random() * 20) + 5, metric_unit: '%' },
                  { metric_name: 'EBIT-marginal', metric_value: Math.floor(Math.random() * 15) + 5, metric_unit: '%' }
                ],
                confidence: Math.floor(Math.random() * 30) + 70
              }
            ],
            metrics: [
              { metric_name: 'Omsättning', metric_value: Math.floor(Math.random() * 1000) + 100, metric_unit: 'TSEK' },
              { metric_name: 'Anställda', metric_value: Math.floor(Math.random() * 200) + 10, metric_unit: 'personer' }
            ]
          }))
        }
      })
    }
  } catch (error) {
    console.error('Error in AI analysis:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Companies endpoint to fetch real company data
app.get('/api/companies', async (req, res) => {
  try {
    const { limit = 10, orgnr } = req.query
    
    let query = supabase
      .from('master_analytics')
      .select('*')
      .limit(Number(limit))
    
    if (orgnr) {
      query = query.eq('OrgNr', orgnr)
    }
    
    const { data: companies, error } = await query

    if (error) {
      console.error('Error fetching companies:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch companies' 
      })
    }

    return res.json({
      success: true,
      companies: companies || [],
      total: companies?.length || 0
    })
  } catch (error) {
    console.error('Error fetching companies:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

app.get('/api/ai-analysis', async (req, res) => {
  try {
    const { history, limit = 10 } = req.query
    
    if (history === '1') {
      // Fetch real analysis history from database
      const { data: runs, error } = await supabase
        .from('ai_analysis_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(Number(limit))

      if (error) {
        console.error('Error fetching analysis history:', error)
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch analysis history' 
        })
      }

      return res.json({
        success: true,
        runs: runs || [],
        total: runs?.length || 0
      })
    }
    
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid request' 
    })
  } catch (error) {
    console.error('Error fetching analysis history:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Database schema verification endpoint
app.get('/api/db-schema', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('exec_sql', { 
        query: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'ai_%' ORDER BY tablename;" 
      })

    if (error) {
      console.error('Error checking schema:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to check schema' 
      })
    }

    return res.json({
      success: true,
      tables: data || [],
      message: `Found ${data?.length || 0} AI tables in public schema`
    })
  } catch (error) {
    console.error('Error in schema check:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Get analyzed companies with filtering and pagination
app.get('/api/analyzed-companies', async (req, res) => {
  try {
    const { 
      search, 
      recommendation, 
      riskLevel, 
      sortBy = 'date', 
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query

    // Build query to get analyzed companies
    let query = supabase
      .from('ai_company_analysis')
      .select(`
        run_id,
        orgnr,
        company_name,
        summary,
        recommendation,
        confidence,
        risk_score,
        financial_grade,
        commercial_grade,
        operational_grade,
        next_steps,
        created_at,
        ai_analysis_runs!inner(
          id,
          model_version,
          started_at,
          completed_at
        )
      `)

    // Apply filters
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,orgnr.ilike.%${search}%`)
    }

    if (recommendation) {
      query = query.eq('recommendation', recommendation)
    }

    // Apply sorting
    if (sortBy === 'date') {
      query = query.order('created_at', { ascending: sortOrder === 'asc' })
    } else if (sortBy === 'score') {
      // We'll need to join with screening results for score
      query = query.order('confidence', { ascending: sortOrder === 'asc' })
    } else if (sortBy === 'company') {
      query = query.order('company_name', { ascending: sortOrder === 'asc' })
    }

    // Apply pagination
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const from = (pageNum - 1) * limitNum
    const to = from + limitNum - 1

    query = query.range(from, to)

    const { data: analyses, error } = await query

    if (error) {
      console.error('Error fetching analyzed companies:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch analyzed companies' 
      })
    }

    // Get screening scores for each analysis
    const runIds = analyses?.map(a => a.run_id) || []
    const { data: screeningResults } = await supabase
      .from('ai_screening_results')
      .select('run_id, screening_score, risk_flag')
      .in('run_id', runIds)

    // Transform data to match frontend interface
    const companies = analyses?.map(analysis => {
      const screening = screeningResults?.find(s => s.run_id === analysis.run_id)
      
      return {
        runId: analysis.run_id,
        companyName: analysis.company_name,
        orgnr: analysis.orgnr,
        analysisDate: analysis.created_at,
        recommendation: analysis.recommendation,
        screeningScore: screening?.screening_score || 0,
        riskLevel: screening?.risk_flag || 'Unknown risk',
        summary: analysis.summary,
        financialGrade: analysis.financial_grade,
        commercialGrade: analysis.commercial_grade,
        operationalGrade: analysis.operational_grade,
        confidence: analysis.confidence,
        modelVersion: analysis.ai_analysis_runs?.model_version || 'unknown',
        nextSteps: analysis.next_steps || [],
        sections: [], // TODO: Fetch from ai_analysis_sections
        metrics: [] // TODO: Fetch from ai_analysis_metrics
      }
    }) || []

    // Get total count for pagination
    const { count } = await supabase
      .from('ai_company_analysis')
      .select('*', { count: 'exact', head: true })

    return res.json({
      success: true,
      companies,
      total: count || 0,
      page: pageNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    })
  } catch (error) {
    console.error('Error in analyzed companies endpoint:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Get single analysis by run ID
app.get('/api/analyzed-companies/:runId', async (req, res) => {
  try {
    const { runId } = req.params

    // Get main analysis data
    const { data: analysis, error: analysisError } = await supabase
      .from('ai_company_analysis')
      .select(`
        *,
        ai_analysis_runs!inner(*)
      `)
      .eq('run_id', runId)
      .single()

    if (analysisError) {
      console.error('Error fetching analysis:', analysisError)
      return res.status(404).json({ 
        success: false, 
        error: 'Analysis not found' 
      })
    }

    // Get screening results
    const { data: screening } = await supabase
      .from('ai_screening_results')
      .select('*')
      .eq('run_id', runId)
      .single()

    // Get analysis sections
    const { data: sections } = await supabase
      .from('ai_analysis_sections')
      .select('*')
      .eq('run_id', runId)

    // Get analysis metrics
    const { data: metrics } = await supabase
      .from('ai_analysis_metrics')
      .select('*')
      .eq('run_id', runId)

    const result = {
      runId: analysis.run_id,
      companyName: analysis.company_name,
      orgnr: analysis.orgnr,
      analysisDate: analysis.created_at,
      recommendation: analysis.recommendation,
      screeningScore: screening?.screening_score || 0,
      riskLevel: screening?.risk_flag || 'Unknown risk',
      summary: analysis.summary,
      financialGrade: analysis.financial_grade,
      commercialGrade: analysis.commercial_grade,
      operationalGrade: analysis.operational_grade,
      confidence: analysis.confidence,
      modelVersion: analysis.ai_analysis_runs?.model_version || 'unknown',
      nextSteps: analysis.next_steps || [],
      sections: sections || [],
      metrics: metrics || []
    }

    return res.json({
      success: true,
      analysis: result
    })
  } catch (error) {
    console.error('Error in single analysis endpoint:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Test endpoint to check ai_company_analysis table
app.get('/api/test-ai-table', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_company_analysis')
      .select('*')
      .limit(5)

    if (error) {
      console.error('Error querying ai_company_analysis:', error)
      return res.json({
        success: false,
        error: error.message,
        code: error.code
      })
    }

    return res.json({
      success: true,
      count: data?.length || 0,
      data: data || []
    })
  } catch (error) {
    console.error('Error in test endpoint:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Test endpoint to insert a simple record
app.post('/api/test-insert', async (req, res) => {
  try {
    // First create a run record
    const runId = crypto.randomUUID()
    const runRecord = {
      id: runId,
      initiated_by: 'test-user',
      status: 'completed',
      model_version: 'test',
      analysis_mode: 'deep',
      filters_json: null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_message: null
    }

    console.log('Creating run record:', runRecord)
    
    const { error: runError } = await supabase
      .from('ai_analysis_runs')
      .insert(runRecord)

    if (runError) {
      console.error('Error creating run record:', runError)
      return res.json({
        success: false,
        error: 'Failed to create run record',
        details: runError
      })
    }

    // Now create the analysis record
    const testRecord = {
      run_id: runId,
      orgnr: '1234567890',
      company_name: 'Test Company',
      summary: 'Test summary',
      recommendation: 'Håll',
      confidence: 80,
      risk_score: 30,
      financial_grade: 'B',
      commercial_grade: 'B',
      operational_grade: 'B',
      next_steps: ['Test step']
    }

    console.log('Attempting to insert test record:', testRecord)
    
    const { data, error } = await supabase
      .from('ai_company_analysis')
      .insert([testRecord])
      .select()

    if (error) {
      console.error('Error inserting test record:', error)
      return res.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      })
    }

    return res.json({
      success: true,
      inserted: data
    })
  } catch (error) {
    console.error('Error in test insert endpoint:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Delete analysis
app.delete('/api/analyzed-companies/:runId', async (req, res) => {
  try {
    const { runId } = req.params

    // Delete from all related tables
    await supabase.from('ai_analysis_sections').delete().eq('run_id', runId)
    await supabase.from('ai_analysis_metrics').delete().eq('run_id', runId)
    await supabase.from('ai_analysis_audit').delete().eq('run_id', runId)
    await supabase.from('ai_screening_results').delete().eq('run_id', runId)
    await supabase.from('ai_company_analysis').delete().eq('run_id', runId)
    await supabase.from('ai_analysis_runs').delete().eq('id', runId)

    return res.json({
      success: true,
      message: 'Analysis deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting analysis:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})