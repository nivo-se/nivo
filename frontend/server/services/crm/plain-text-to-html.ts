/** Escape for HTML text nodes / innerHTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wrap plain text as minimal HTML for email. Uses explicit &lt;br /&gt; for line
 * breaks — Gmail strips or ignores `white-space: pre-wrap` in many cases, which
 * collapses newlines inside a &lt;div&gt;.
 */
export function plainTextToSimpleEmailHtml(plain: string): string {
  const normalized = plain.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const withBreaks = escapeHtml(normalized).replace(/\n/g, '<br />')
  return (
    '<div dir="ltr" ' +
    'style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#202124;">' +
    withBreaks +
    '</div>'
  )
}

/** True when HTML is empty or only the CRM open-pixel (and optional whitespace / wrapping tags with nothing). */
export function isOpenPixelOnlyOrEmpty(html: string | null | undefined): boolean {
  if (html == null) return true
  const t = html.trim()
  if (!t) return true
  const noPixel = t.replace(/<img[^>]*track\/open[^>]*>[\r\n]*/gi, '')
  return !noPixel.replace(/&nbsp;|\s|<br\s*\/?>/gi, '').trim()
}
