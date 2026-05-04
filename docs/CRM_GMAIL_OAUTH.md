# CRM: send from your own Gmail (Google Workspace)

Each signed-in app user can connect a **separate** Google account. The app stores a **refresh token** in Postgres (encrypted with `GMAIL_OAUTH_ENCRYPTION_KEY`) and uses the **Gmail API** for **send** (`gmail.send`) and optional **inbox import** (`gmail.readonly`).

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
| `CRM_GMAIL_OUTBOUND_FROM_NAME` (optional) | **Fallback** display name in the **From** header if Google did not return a name (e.g. old connections before profile scope). At connect, the server stores **`google_display_name` from Google userinfo** (`name` or given + family) and uses that for send. Reconnect “Connect Gmail” after upgrading so profile is granted. |
| `CRM_GMAIL_OAUTH_SUCCESS_URL` (optional) | Where the browser lands after a successful connect (default: `APP_BASE_URL` or your Vite dev URL, e.g. `http://localhost:8080`) |

OAuth scopes include **`userinfo.profile`** so we can read the account **display name** (same as in the Google account profile) and store it in `google_display_name` for the outbound `From: "Name" <email>` line.

## 5. Send behaviour

- `POST /crm/emails/:id/send` with body `{ "send_provider": "auto" }` (default) uses **Gmail** if the current user has connected and **Resend** otherwise. Use `"gmail"` or `"resend"` to force a path.
- If you use **only Gmail**, you can rely on **inbox import** (below) for replies instead of Resend webhooks.

## 6. Inbox import (Gmail API; team-visible in CRM)

OAuth includes **`gmail.readonly`**. Teammates who linked **before** that scope was added should **disconnect and Connect Gmail** again so Google reissues a token that includes read access.

Behaviour:

- The enhanced server lists recent **Inbox** mail for each connected account (periodic poll + optional manual sync in the CRM banner).
- Only messages whose **From** matches a CRM **contact email**, or whose **domain** matches a company **website** host, are copied into `deep_research.crm_email_messages` (inbound, `provider = gmail`) on the deal/contact thread. Everything else stays **only in Gmail**.

Environment variables (enhanced server):

| Variable | Purpose |
|----------|--------|
| `CRM_GMAIL_INBOUND_POLL_SECONDS` | Seconds between automatic syncs for **all** linked mailboxes (default **180**). Set **`0`** to disable background polling. |
| `CRM_GMAIL_INBOUND_QUERY` | Gmail search string (default `in:inbox newer_than:60d -category:promotions`). |
| `CRM_GMAIL_INBOUND_MAX_MESSAGES` | Max messages per mailbox per run (default **50**, cap **100**). |

API: **`POST /crm/gmail/sync-inbound`** (Bearer auth) syncs the **current user’s** connected mailbox once.

## 7. Security notes

- Treat `GMAIL_OAUTH_ENCRYPTION_KEY` like a production secret; rotating it **invalidates** existing stored refresh tokens (users must connect again) unless you re-encrypt.
- Restrict the OAuth client redirect URIs to known hosts; keep the consent screen in Testing or a tight Internal audience for a three-user deployment.
- **Read-only Gmail** can be revoked by the user from their Google account at any time.
