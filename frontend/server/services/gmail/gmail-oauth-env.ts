const GMAIL_ENVS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GMAIL_OAUTH_ENCRYPTION_KEY',
] as const

export function gmailOAuthEnvMissing(): string[] {
  return GMAIL_ENVS.filter((name) => !process.env[name]?.trim())
}

export function isGmailOAuthEnvConfigured(): boolean {
  return gmailOAuthEnvMissing().length === 0
}
