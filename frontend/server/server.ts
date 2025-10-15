import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local
config({ path: path.resolve(__dirname, '../.env.local') })

// Debug: Check if environment variables are loaded
console.log('Supabase URL:', process.env.VITE_SUPABASE_URL ? 'Loaded' : 'Missing')
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Loaded' : 'Missing')

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Basic AI analysis endpoints for development
app.post('/api/ai-analysis', async (req, res) => {
  try {
    const { companies, analysisType = 'screening' } = req.body || {}
    
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ success: false, error: 'No companies provided' })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API key not configured' })
    }

    console.log(`Processing ${analysisType} analysis for ${companies.length} companies`)

    // For now, return mock screening results to test the UI
    if (analysisType === 'screening') {
      const mockResults = companies.map((company: any, index: number) => ({
        orgnr: company.OrgNr || company.orgnr,
        companyName: company.name,
        screeningScore: Math.floor(Math.random() * 40) + 60, // 60-100
        riskFlag: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        briefSummary: `Mock screening result for ${company.name}. This is a placeholder response to test the UI workflow.`
      }))

      return res.status(200).json({
        success: true,
        run: {
          id: 'mock-screening-' + Date.now(),
          modelVersion: 'gpt-3.5-turbo',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: 'completed',
          analysisMode: 'screening'
        },
        analysis: {
          results: mockResults,
          mode: 'screening',
          totalCompanies: companies.length
        }
      })
    }

    // For deep analysis, return mock detailed results
    const mockDeepResults = companies.map((company: any) => ({
      orgnr: company.OrgNr || company.orgnr,
      name: company.name,
      executiveSummary: `Mock deep analysis for ${company.name}. This is a placeholder response.`,
      financialHealth: Math.floor(Math.random() * 4) + 6, // 6-10
      growthPotential: ['Hög', 'Medium', 'Låg'][Math.floor(Math.random() * 3)],
      marketPosition: ['Ledare', 'Utmanare', 'Följare', 'Nisch'][Math.floor(Math.random() * 4)],
      strengths: ['Mock styrka 1', 'Mock styrka 2', 'Mock styrka 3'],
      weaknesses: ['Mock svaghet 1', 'Mock svaghet 2', 'Mock svaghet 3'],
      opportunities: ['Mock möjlighet 1', 'Mock möjlighet 2', 'Mock möjlighet 3'],
      risks: ['Mock risk 1', 'Mock risk 2', 'Mock risk 3'],
      recommendation: ['Köp', 'Håll', 'Sälj'][Math.floor(Math.random() * 3)],
      targetPrice: Math.floor(Math.random() * 1000) + 100,
      confidence: Math.floor(Math.random() * 30) + 70, // 70-100
      // Add missing properties that the frontend expects
      nextSteps: [
        'Mock rekommendation 1: Analysera marknadsmöjligheter',
        'Mock rekommendation 2: Utvärdera operativa förbättringar',
        'Mock rekommendation 3: Genomför due diligence'
      ],
      financialGrade: Math.floor(Math.random() * 4) + 6, // 6-10
      commercialGrade: Math.floor(Math.random() * 4) + 6, // 6-10
      operationalGrade: Math.floor(Math.random() * 4) + 6, // 6-10
      riskScore: Math.floor(Math.random() * 40) + 20, // 20-60
      // Add sections and metrics arrays
      sections: [
        {
          section_type: 'financial_analysis',
          title: 'Finansiell Analys',
          content_md: 'Mock finansiell analys för ' + company.name + '. Detta är en placeholder för att testa UI:n.',
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

    return res.status(200).json({
      success: true,
      run: {
        id: 'mock-run-' + Date.now(),
        modelVersion: 'gpt-4',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: 'completed',
        analysisMode: 'deep'
      },
      analysis: {
        companies: mockDeepResults,
        mode: 'deep',
        totalCompanies: companies.length
      }
    })

  } catch (error: any) {
    console.error('AI Analysis API error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Unknown error' })
  }
})

app.get('/api/ai-analysis', async (req, res) => {
  try {
    // Return empty history for now
    return res.status(200).json({
      success: true,
      runs: [],
      total: 0
    })
  } catch (error: any) {
    console.error('AI Analysis GET API error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Unknown error' })
  }
})

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})


