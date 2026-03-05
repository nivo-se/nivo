# Dependabot and dependency vulnerabilities

This doc summarizes the **24 Dependabot alerts** (and local audit results) and how to fix them.

---

## 1. GitHub repo URL → `nivo.git`

**Repo is now:** **https://github.com/nivo-se/nivo** (renamed from `nivo-web`). Clone URL: `https://github.com/nivo-se/nivo.git`.

**Local:** `origin` is set to `https://github.com/nivo-se/nivo.git`. Push/pull use the new URL.

---

## 2. npm (Node) vulnerabilities

From `npm audit` (root and frontend):

| Severity | Package(s) | Issue | Fix |
|----------|------------|--------|-----|
| **High** | **minimatch** | ReDoS (regex denial of service) | `npm audit fix` (frontend and root) |
| **High** | **rollup** | Path traversal / arbitrary file write ([GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc)) | `npm audit fix` |
| **High** | **tar** | Hardlink path traversal ([GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96)) | `npm audit fix` (root) |
| **High** | **@vercel/node** (via @vercel/build-utils, minimatch, ajv) | Transitive: minimatch ReDoS, ajv ReDoS | `npm audit fix --force` **downgrades** to @vercel/node@2.1.0 (breaking); or wait for Vercel to update |
| **Moderate** | **ajv** | ReDoS when using `$data` ([GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6)) | Frontend: `npm audit fix`; root: same as @vercel/node |

**Commands to run:**

```bash
# Frontend – fix what can be fixed without breaking changes
cd frontend && npm audit fix && cd ..

# Root – safe fixes only (rollup, tar, etc.)
npm audit fix

# Optional: fix everything including breaking (downgrades @vercel/node to 2.1.0)
# npm audit fix --force   # only if you accept breaking changes
```

Re-run `npm audit` after fixes; some issues may remain until `@vercel/node` and its dependencies are updated by Vercel.

---

## 3. Python (backend) vulnerabilities

From `pip-audit` (backend / env):

| Package | Current | Fix version | CVE / note |
|---------|---------|-------------|------------|
| **aiohttp** | 3.13.2 | 3.13.3 | CVE-2025-69223 through 69230 |
| **cryptography** | 46.0.1 | 46.0.5 | CVE-2026-26007 |
| **filelock** | 3.17.0 | 3.20.3 | CVE-2025-68146, CVE-2026-22701 |
| **nltk** | 3.9.1 | 3.9.3 | CVE-2025-14009 |
| **pillow** | 11.1.0 | 12.1.1 | CVE-2026-25990 |
| **pip** | 25.0.1 | 26.0 | CVE-2025-8869, CVE-2026-1703 |
| **python-multipart** | 0.0.20 | 0.0.22 | CVE-2026-24486 |
| **requests** | 2.32.3 | 2.32.4 | CVE-2024-47081 |
| **starlette** | 0.48.0 | 0.49.1 | CVE-2025-62727 |
| **urllib3** | 2.3.0 | 2.6.3 | CVE-2025-50181, 50182, 66418, 66471, CVE-2026-21441 |

Many of these are **transitive** (pulled in by FastAPI, uvicorn, chromadb, etc.). To fix:

```bash
cd backend
source venv/bin/activate   # or your venv
pip install --upgrade pip
pip install --upgrade aiohttp cryptography filelock nltk pillow python-multipart requests starlette urllib3
pip install -r requirements.txt   # re-resolve
pip-audit
```

Then pin updated versions in `backend/requirements.txt` where possible (e.g. `urllib3>=2.6.0`, `requests>=2.32.4`, `aiohttp>=3.13.3`, `python-multipart>=0.0.22`, `starlette>=0.49.1`) so CI and fresh installs get safe versions.

---

## 4. Viewing Dependabot on GitHub

- **Security** → **Dependabot** → **Alerts**: https://github.com/nivo-se/nivo-web/security/dependabot (or `.../nivo/...` after rename).
- Each alert links to the advisory and often suggests a version bump or PR; you can “Dismiss” or “Create Dependabot security update” PRs from there.

---

## 5. One-time checklist

- [ ] Rename GitHub repo to `nivo` (Settings → General → Repository name).
- [ ] Run `cd frontend && npm audit fix && cd ..` and `npm audit fix` at repo root.
- [ ] Run backend upgrades and `pip-audit`; update `backend/requirements.txt` pins.
- [ ] Re-run `npm audit` and `pip-audit`; address any remaining alerts or document accepted risk.
