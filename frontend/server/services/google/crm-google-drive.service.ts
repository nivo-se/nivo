import { Readable } from 'node:stream'
import { google } from 'googleapis'
import type { GmailOutboundService } from '../gmail/gmail-outbound.service.js'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

export type CrmDriveFileCreated = {
  id: string
  name: string
  webViewLink: string | null
  mimeType: string
}

export class CrmGoogleDriveService {
  constructor(private readonly gmail: GmailOutboundService) {}

  async createFile(
    userId: string,
    input: {
      name: string
      mimeType: string
      body: Buffer
      parentIds?: string[]
    },
  ): Promise<CrmDriveFileCreated> {
    if (input.body.length > MAX_UPLOAD_BYTES) {
      throw new Error(`File too large (max ${MAX_UPLOAD_BYTES} bytes for this endpoint)`)
    }
    const conn = await this.gmail.getConnection(userId)
    if (!conn) throw new Error('Google is not connected for this user')
    const flags = this.gmail.scopeFlags(conn.granted_scopes)
    if (!flags.drive_file) {
      throw new Error(
        'Google Drive access was not granted. Disconnect and connect Google again to approve Drive.',
      )
    }
    const auth = await this.gmail.getOAuth2ClientForUser(userId)
    if (!auth) throw new Error('Google is not connected for this user')

    const drive = google.drive({ version: 'v3', auth })
    const parents = input.parentIds?.length ? input.parentIds : undefined

    const created = await drive.files.create({
      requestBody: {
        name: input.name.trim() || 'untitled',
        parents,
      },
      media: {
        mimeType: input.mimeType,
        body: Readable.from(input.body),
      },
      fields: 'id, name, mimeType, webViewLink',
    })

    const id = created.data.id
    const name = created.data.name
    if (!id || !name) throw new Error('Drive create returned incomplete file metadata')

    return {
      id,
      name,
      mimeType: created.data.mimeType ?? input.mimeType,
      webViewLink: created.data.webViewLink ?? null,
    }
  }
}
