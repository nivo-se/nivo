import type { Express, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { CrmDb } from '../services/crm/db-interface.js'
import type { GmailOutboundService } from '../services/gmail/gmail-outbound.service.js'
import { listPlaybooksForPage } from '../services/copilot/playbooks.js'
import { runNivoCopilot } from '../services/copilot/copilot-runner.js'

function requireCrmDb(res: Response, db: CrmDb | null): db is CrmDb {
  if (!db) {
    res.status(503).json({ success: false, error: 'CRM database is not configured' })
    return false
  }
  return true
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(24_000),
      })
    )
    .min(1)
    .max(40),
  playbookId: z.string().max(64).optional(),
  context: z
    .object({
      page: z.enum(['crm', 'crm_workspace', 'universe', 'deep_research', 'sourcing']).optional(),
      companyId: z.string().max(80).optional(),
      orgnr: z.string().max(32).optional(),
    })
    .optional(),
})

export function registerCopilotRoutes(
  app: Express,
  getCrmDb: () => CrmDb | null,
  getGmailOutbound: () => GmailOutboundService | null
) {
  app.get('/crm/copilot/playbooks', (req, res) => {
    const page = typeof req.query.page === 'string' ? req.query.page : undefined
    return res.json({ success: true, data: listPlaybooksForPage(page) })
  })

  app.post(
    '/crm/copilot/chat',
    asyncHandler(async (req, res) => {
      const parsed = chatBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.flatten() })
      }
      const db = getCrmDb()
      if (!requireCrmDb(res, db)) return

      try {
        const result = await runNivoCopilot({
          messages: parsed.data.messages,
          playbookId: parsed.data.playbookId,
          context: parsed.data.context,
          db,
          getGmailOutbound,
        })
        return res.json({ success: true, data: result })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const code = msg.includes('OPENAI_API_KEY') ? 503 : 500
        return res.status(code).json({ success: false, error: msg })
      }
    })
  )
}
