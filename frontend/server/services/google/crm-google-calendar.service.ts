import { google } from 'googleapis'
import type { GmailOutboundService } from '../gmail/gmail-outbound.service.js'

export type CrmCalendarEventRow = {
  id: string
  summary: string | null
  start: string | null
  end: string | null
  htmlLink: string | null
  calendarId: string
}

export class CrmGoogleCalendarService {
  constructor(private readonly gmail: GmailOutboundService) {}

  async listEvents(
    userId: string,
    opts: {
      timeMin: string
      timeMax: string
      calendarId?: string
      maxResults?: number
    },
  ): Promise<CrmCalendarEventRow[]> {
    const conn = await this.gmail.getConnection(userId)
    if (!conn) throw new Error('Google is not connected for this user')
    const flags = this.gmail.scopeFlags(conn.granted_scopes)
    if (!flags.calendar_events) {
      throw new Error(
        'Calendar access was not granted. Disconnect and connect Google again to approve Calendar.',
      )
    }
    const auth = await this.gmail.getOAuth2ClientForUser(userId)
    if (!auth) throw new Error('Google is not connected for this user')

    const calendar = google.calendar({ version: 'v3', auth })
    const calendarId = opts.calendarId?.trim() || 'primary'
    const maxResults = Math.min(Math.max(opts.maxResults ?? 100, 1), 250)

    const res = await calendar.events.list({
      calendarId,
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const items = res.data.items ?? []
    const out: CrmCalendarEventRow[] = []
    for (const ev of items) {
      if (!ev.id) continue
      const start =
        ev.start?.dateTime ?? ev.start?.date ?? null
      const end = ev.end?.dateTime ?? ev.end?.date ?? null
      out.push({
        id: ev.id,
        summary: ev.summary ?? null,
        start,
        end,
        htmlLink: ev.htmlLink ?? null,
        calendarId,
      })
    }
    return out
  }
}
