import { z } from 'zod'

export const fromCompanySchema = z.object({ company_id: z.string().uuid() })

export const createContactSchema = z.object({
  company_id: z.string().uuid(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email(),
  linkedin_url: z.string().url().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  is_primary: z.boolean().optional(),
})

export const updateContactSchema = createContactSchema.partial().omit({ company_id: true })

export const generateEmailSchema = z.object({
  company_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  user_instructions: z.string().max(1000).optional(),
  reason_for_interest: z.string().max(500).optional(),
})

export const approveEmailSchema = z.object({
  subject: z.string().min(1).optional(),
  body_text: z.string().min(1).optional(),
  body_html: z.string().optional(),
})

export const addNoteSchema = z.object({ summary: z.string().min(1), metadata: z.record(z.any()).optional() })

export const updateStatusSchema = z.object({ status: z.string().min(1), summary: z.string().optional() })

export const enrollSequenceSchema = z.object({ sequence_id: z.string().uuid().optional() })
