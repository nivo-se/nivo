/** Escape for HTML text nodes / innerHTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wrap plain text as minimal HTML (preserves newlines) for email clients
 * that prefer multipart HTML alongside text/plain.
 */
export function plainTextToSimpleEmailHtml(plain: string): string {
  const esc = escapeHtml(plain)
  return `<div style="white-space:pre-wrap;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;">${esc}</div>`
}

/** True when HTML is empty or only the CRM open-pixel (and optional whitespace / wrapping tags with nothing). */
export function isOpenPixelOnlyOrEmpty(html: string | null | undefined): boolean {
  if (html == null) return true
  const t = html.trim()
  if (!t) return true
  const noPixel = t.replace(/<img[^>]*track\/open[^>]*>[\r\n]*/gi, '')
  return !noPixel.replace(/&nbsp;|\s|<br\s*\/?>/gi, '').trim()
}
