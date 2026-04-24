/**
 * Build an RFC 822 message and return Gmail API `raw` body (base64url).
 */
export function buildGmailRawMessage(input: {
  from: string
  to: string
  subject: string
  text: string
  html?: string | null
  replyTo?: string | null
}): string {
  const boundary = `nivo_mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const subj = encodeSubject(input.subject)
  const hasHtml = Boolean(input.html && input.html.trim())
  const headers: string[] = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${subj}`,
    'MIME-Version: 1.0',
  ]
  if (input.replyTo?.trim()) {
    headers.push(`Reply-To: ${input.replyTo.trim()}`)
  }
  if (hasHtml) {
    // Must be a message header (RFC 2045/2046), not the first line of the body, or
    // Gmail and other clients may parse multipart structure incorrectly.
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
  } else {
    headers.push('Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit')
  }

  const text = (input.text ?? '').replace(/\r?\n/g, '\r\n')
  const html = (input.html ?? '').replace(/\r?\n/g, '\r\n')

  let body: string
  if (hasHtml) {
    body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n')
  } else {
    body = ['', text, ''].join('\r\n')
  }

  const raw = [...headers, '', body].join('\r\n')
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function encodeSubject(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`
}
