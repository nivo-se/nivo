# CRM: send from your own Gmail (Google Workspace)

Each signed-in app user can connect a **separate** Google account. The app stores a **refresh token** in Postgres (encrypted with `GMAIL_OAUTH_ENCRYPTION_KEY`) and sends with the **Gmail API** (`gmail.send` scope) so the message appears in that user’s **Sent** mail.

## 1. Google Cloud

1. Create or pick a project → **APIs & Services** → **Enable** the **Gmail API**.
2. **Credentials** → **Create credentials** → **OAuth client ID** → type **Web application**.
3. **Authorized redirect URIs** (must match the server exactly), for example:
   - Local: `http://localhost:3001/crm/gmail/oauth/callback`
   - Production: `https://<your-crm-api-host>/crm/gmail/oauth/callback`
4. If the app is in **Testing**, add each teammate’s Google account under **OAuth consent screen** → **Test users**. For an internal org-only app, you can use **Internal** (Workspace users) instead.

## 2. Database

Run migration `050_user_gmail_oauth.sql` (table `deep_research.user_gmail_credentials`).

## 3. Auth0 (required before “Connect Gmail”)

`POST /crm/gmail/oauth/url` only accepts requests that include `Authorization: Bearer` from **Auth0** (we attach the Gmail refresh token to the same user id as your Nivo login).

1. Set in **repo root** `.env` (uncomment or add real values):
   - `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`
   - `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` — **same** domain and audience as above (the enhanced server uses these to verify the JWT).
2. **Local dev:** `frontend/.env.development` sets `VITE_DISABLE_AUTH=true`, so **no token** is sent and you will see “Authentication required”. Either:
   - Add **`frontend/.env.local`** with `VITE_DISABLE_AUTH=false` (overrides; this repo can ship an example), **restart** `npm run dev`, then **log in** to Nivo, **then** click Connect Gmail; or
   - Temporarily set `VITE_DISABLE_AUTH=false` in `.env.development`.
3. After Google consent, you return to the app already logged in to Nivo + Gmail linked for your user.

## 4. Environment variables (Google + encryption — repo root `.env`)

| Variable | Purpose |
|----------|--------|
| `GOOGLE_OAUTH_CLIENT_ID` | Web client ID from Google Cloud |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Web client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | Same string as the redirect URI registered in step 1 |
| `GMAIL_OAUTH_ENCRYPTION_KEY` | 32 bytes as **base64** (e.g. `openssl rand -base64 32`) or 64 hex chars; used to encrypt stored refresh tokens and to sign the OAuth `state` JWT |
| `CRM_GMAIL_OUTBOUND_FROM_NAME` (optional) | Display name in the **From** header for outbound CRM mail (e.g. `Firstname Lastname`), so the inbox shows a person’s name before the address. Still sends as the connected Gmail address. |
| `CRM_GMAIL_OAUTH_SUCCESS_URL` (optional) | Where the browser lands after a successful connect (default: `APP_BASE_URL` or your Vite dev URL, e.g. `http://localhost:8080`) |

## 5. Send behaviour

- `POST /crm/emails/:id/send` with body `{ "send_provider": "auto" }` (default) uses **Gmail** if the current user has connected and **Resend** otherwise. Use `"gmail"` or `"resend"` to force a path.
- Inbound reply tracking (Resend `reply+…` → webhook) still needs **Resend** env when you want replies in the CRM inbox; Gmail sends can still set that **Reply-To** when `RESEND_REPLY_DOMAIN` (or an inferred From domain) is set.

## 6. Security notes

- Treat `GMAIL_OAUTH_ENCRYPTION_KEY` like a production secret; rotating it **invalidates** existing stored refresh tokens (users must connect again) unless you re-encrypt.
- Restrict the OAuth client redirect URIs to known hosts; keep the consent screen in Testing or a tight Internal audience for a three-user deployment.
