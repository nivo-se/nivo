/** Helpers for Gmail inbound → CRM matching (no new runtime deps). */

export function parseFromHeader(from: string | null | undefined): { email: string; name?: string } | null {
  if (!from?.trim()) return null
  const trimmed = from.trim()
  const m = trimmed.match(/<([^>]+)>/)
  const rawAddr = (m ? m[1] : trimmed).trim().replace(/^"|"$/g, '')
  const addr = rawAddr.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return null
  let name: string | undefined
  if (m) {
    const left = trimmed.slice(0, trimmed.indexOf('<')).trim().replace(/^"|"$/g, '')
    if (left) name = left
  }
  return { email: addr, name }
}

export function websiteHost(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  const w = website.trim()
  try {
    const u = new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`)
    return u.hostname.replace(/^www\./i, '').toLowerCase() || null
  } catch {
    const t = w.replace(/^https?:\/\//i, '').split('/')[0] ?? ''
    const h = t.replace(/^www\./i, '').toLowerCase().trim()
    return h || null
  }
}

export function emailDomainMatchesWebsite(emailHost: string, siteHost: string): boolean {
  const e = emailHost.toLowerCase().replace(/^www\./i, '')
  const s = siteHost.toLowerCase().replace(/^www\./i, '')
  if (!e || !s) return false
  return e === s || e.endsWith(`.${s}`)
}

export function decodeBase64Url(data: string | undefined | null): string {
  if (!data) return ''
  const s = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(s, 'base64').toString('utf-8')
}

type GmailPart = { mimeType?: string | null; body?: { data?: string | null }; parts?: GmailPart[] }

export function extractBodiesFromPayload(payload: GmailPart | undefined): {
  text: string | null
  html: string | null
} {
  const out: { text: string | null; html: string | null } = { text: null, html: null }
  const walk = (parts: GmailPart[] | undefined) => {
    if (!parts) return
    for (const p of parts) {
      if (p.parts?.length) walk(p.parts)
      const mime = p.mimeType ?? ''
      const data = p.body?.data
      if (mime === 'text/plain' && data) out.text = decodeBase64Url(data)
      if (mime === 'text/html' && data) out.html = decodeBase64Url(data)
    }
  }
  if (payload?.parts?.length) walk(payload.parts)
  if (payload?.body?.data) {
    const mime = payload.mimeType ?? ''
    if (mime === 'text/plain') out.text = decodeBase64Url(payload.body.data)
    if (mime === 'text/html') out.html = decodeBase64Url(payload.body.data)
  }
  return { text: out.text, html: out.html }
}
