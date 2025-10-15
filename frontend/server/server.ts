import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') })

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Import the full AI analysis implementation
import { handlePost, handleGet } from '../../api/ai-analysis'

// Proxy the AI analysis endpoints
app.post('/api/ai-analysis', async (req, res) => {
  try {
    await handlePost(req, res)
  } catch (error) {
    console.error('AI Analysis API error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

app.get('/api/ai-analysis', async (req, res) => {
  try {
    await handleGet(req, res)
  } catch (error) {
    console.error('AI Analysis GET API error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})


