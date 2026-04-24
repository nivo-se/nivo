import { z } from 'zod'

export const fromCompanySchema = z.object({ company_id: z.string().uuid() })

/** CRM company subtitle fields (industry + website link in workspace) */
export const patchCompanySchema = z
  .object({
    industry: z.string().max(500).nullable().optional(),
    website: z.string().max(2000).nullable().optional(),
  })
  .refine((obj) => obj.industry !== undefined || obj.website !== undefined, {
    message: 'Provide industry and/or website',
  })

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

export const updateDraftEmailSchema = z.object({
  subject: z.string().min(1).optional(),
  body_text: z.string().min(1).optional(),
  body_html: z.string().optional(),
})

export const addNoteSchema = z.object({ summary: z.string().min(1), metadata: z.record(z.any()).optional() })

export const updateStatusSchema = z.object({ status: z.string().min(1), summary: z.string().optional() })

export const enrollSequenceSchema = z.object({ sequence_id: z.string().uuid().optional() })

export const draftEmailSchema = z.object({
  company_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  subject: z.string().min(1),
  body_text: z.string().min(1),
  body_html: z.string().optional(),
})

export const patchDealSchema = z.object({
  next_action_at: z.union([z.string().min(1), z.null()]).optional(),
})

export const generateBatchEmailSchema = z.object({
  list_id: z.string().uuid(),
  user_instructions: z.string().max(1000).optional(),
  reason_for_interest: z.string().max(500).optional(),
})

/** Ad-hoc company for CRM (e.g. researched outside the app). orgnr optional — generated if omitted */
export const createExternalCompanySchema = z.object({
  name: z.string().min(1).max(500),
  orgnr: z.string().min(5).max(32).optional(),
  website: z.union([z.string().url(), z.literal('')]).optional(),
})

/**
 * Quick-send: paste subject+body, target a contact email at a company, and send in one shot.
 * Either `company_id` (existing CRM company) or `company_name` (auto-create) must be provided.
 */
export const quickSendSchema = z
  .object({
    to_email: z.string().email(),
    recipient_name: z.string().max(200).optional(),
    company_id: z.string().uuid().optional(),
    company_name: z.string().min(1).max(500).optional(),
    orgnr: z.string().min(5).max(32).optional(),
    website: z.union([z.string().url(), z.literal('')]).optional(),
    subject: z.string().min(1).max(998),
    body_text: z.string().min(1),
    body_html: z.string().optional(),
  })
  .refine((v) => !!v.company_id || !!v.company_name, {
    message: 'company_id or company_name is required',
    path: ['company_name'],
  })

export const sendCrmEmailSchema = z.object({
  send_provider: z.enum(['auto', 'resend', 'gmail']).optional(),
})

export const crmGoogleCalendarEventsQuerySchema = z.object({
  timeMin: z.string().min(1),
  timeMax: z.string().min(1),
  calendarId: z.string().min(1).max(300).optional(),
  maxResults: z.coerce.number().int().min(1).max(250).optional(),
})

export const crmGoogleDriveCreateFileSchema = z.object({
  name: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  contentBase64: z.string().min(1),
  parentIds: z.array(z.string().min(2).max(128)).max(10).optional(),
})
