# Auth0 setup for nivogroup.se

Login works on Vercel (`*.vercel.app`) but not on nivogroup.se — Auth0 needs the exact URLs.

---

## 1. Verify your actual origin

On **nivogroup.se**, open DevTools (F12) → Console and run:

```js
window.location.origin
```

You’ll see either `https://nivogroup.se` or `https://www.nivogroup.se`. Use that value everywhere below.

---

## 2. Auth0 Dashboard → Applications → your SPA → Settings

Add these URLs exactly (no trailing slashes, correct protocol):

### Application Login URI
```
https://nivogroup.se/auth
```
If you use www, add: `https://www.nivogroup.se/auth`

### Allowed Callback URLs (comma-separated)
```
https://nivogroup.se/auth/callback,
https://www.nivogroup.se/auth/callback,
https://nivo-web-git-mini-setup-jesper-kreugers-projects.vercel.app/auth/callback,
http://localhost:5173/auth/callback
```

### Allowed Logout URLs
```
https://nivogroup.se,
https://www.nivogroup.se,
https://nivo-web.vercel.app,
http://localhost:5173
```

### Allowed Web Origins
Same list as Logout URLs (no paths).

---

## 3. Backend CORS (Mac mini `.env`)

```
CORS_ORIGINS=http://localhost:5173,http://localhost:8080,https://nivogroup.se,https://www.nivogroup.se,https://nivo-web.vercel.app
```

Then: `docker compose restart api`

---

## 4. Checklist

- [ ] Added `https://nivogroup.se/auth/callback` to Allowed Callback URLs
- [ ] Added `https://www.nivogroup.se/auth/callback` if you use www
- [ ] Added `https://nivogroup.se` to Allowed Logout URLs
- [ ] Added `https://nivogroup.se` to Allowed Web Origins
- [ ] Set Application Login URI to `https://nivogroup.se/auth`
- [ ] Saved changes in Auth0
- [ ] Added `https://nivogroup.se` to backend `CORS_ORIGINS`
- [ ] Restarted API: `docker compose restart api`
- [ ] Cleared browser cache or tried incognito on nivogroup.se
