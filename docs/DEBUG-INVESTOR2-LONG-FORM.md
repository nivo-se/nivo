# How to debug: investor2 long form showing old UX

**Note:** In-app debug badges have been removed. This doc is for historical reference and troubleshooting (e.g. if you need to re-enable debug labels in code).

Use these steps to see **what is actually rendering** when you open the long form on `/investor2`.

---

## 1. Confirm you're on the right URL

- Open **`/investor2`** (not `/investor`).
- Unlock the gate.
- Before clicking anything, check the address bar: it must show **`https://yoursite.com/investor2`** (or `http://localhost:8080/investor2`).
- If you see **`/investor`**, you're on the old page; the long form there will always be old UX. Go to `/investor2` and try again.

---

## 2. Turn on the debug labels (if not already)

In the repo:

**`frontend/src/pages/Investor2.tsx`** — find and set:

```ts
const DEBUG_INVESTOR2 = true;
```

**`frontend/src/pages/investor-deck/Investor2LongFormNivo.tsx`** — find and set:

```ts
const DEBUG_INVESTOR2 = true;
```

Save, then **hard refresh** the app (e.g. Cmd+Shift+R / Ctrl+Shift+R).

---

## 3. What you should see when it's correct

**Short form (after unlock, before opening long form):**

- One **amber** badge, top-left: **"INVESTOR2: SHORT FORM (NEW UX)"**.
- Header link: **"Long-form version"**.

**After you click "Long-form version" (header or CTA button):**

- **Amber** badge: **"INVESTOR2: LONG FORM (NEW UX)"**.
- **Blue** badge (a bit lower): **"INVESTOR2 LONGFORM NIVO COMPONENT"**.
- Header link: **"Summary"** (not "Long-form version").
- URL still **`/investor2`**.

Interpretation:

- If you see **both** badges → the **new UX long-form component is rendering**. If it still *looks* like old UX, the problem is styling (e.g. profile vs inv2 tokens, or shared layout).
- If you see **only the amber** badge and **no blue** badge → the Nivo long-form component is **not** mounting (crash or wrong branch). Check the console (step 5).
- If you see **no** badges at all → you're likely on the wrong route or an old bundle; confirm URL and do a clean build (step 6).

---

## 4. Inspect the DOM (which component is on the page)

With the long form open on `/investor2`:

1. Open **DevTools** (F12 or right‑click → Inspect).
2. Open the **Elements** (or **Inspector**) tab.
3. **Find the wrapper** that should only exist for the new UX long form:
   - Press Cmd+F (Mac) or Ctrl+F (Windows) in the Elements panel.
   - Search for: `data-investor2-view="long-form-nivo"`.
   - If you **find** it → the React tree that shows the long form is the one from `Investor2.tsx` (new UX).
   - If you **don’t** find it → the long-form view you’re looking at is probably from the old page or a different route.

4. **Check which long-form content is present:**
   - Search for: `INVESTOR2 LONGFORM NIVO COMPONENT` (the debug label text).
   - If it’s in the DOM → `Investor2LongFormNivo` is mounted.
   - Search for: `text-inv2-fg` or `inv2-olive`.
   - If those **are** present in the long-form content → the **old** long-form component (inv2) is on the page; something is rendering the wrong component or you’re on `/investor`.
   - If you see `text-profile-fg` / `profile-accent` etc. and **no** `inv2-*` in that section → the **new** Nivo component is there; the “old UX” feel is from styling/CSS, not from the wrong component.

---

## 5. Check the browser console for errors

1. Open **DevTools → Console**.
2. Reproduce: go to `/investor2`, unlock, click **"Long-form version"**.
3. Note any **red errors** (especially React component errors or "Cannot read property of undefined").
4. If there is an error **when** you switch to long form → the Nivo long-form component may be **crashing** before it paints; the page might then show a fallback or the old UI if the router or layout re-renders. Fix that error first.

---

## 6. Clean build and cache (rule out stale bundle)

From the **project root** (where `package.json` or `frontend/` lives):

```bash
# From repo root
cd frontend

# Remove build and Vite caches
rm -rf dist node_modules/.vite node_modules/.cache

# Optional: full reinstall
# rm -rf node_modules && npm install

# Fresh build
npm run build
```

Then:

- If you use **production build**: restart the server that serves the built app and open the app again.
- If you use **dev server**: stop it (Ctrl+C), run `npm run dev` again, then **hard refresh** the browser (Cmd+Shift+R / Ctrl+Shift+R).

---

## 7. Confirm which route is mounted (React DevTools)

If you use **React Developer Tools**:

1. Install the [React DevTools](https://react.dev/learn/react-developer-tools) extension.
2. Open the app, go to `/investor2`, unlock, then open the long form.
3. In the **Components** tab, find the component tree.
4. Check:
   - Is the top-level page component **`Investor2`** (and not `Investor`)?
   - When the long form is visible, do you see **`Investor2LongFormNivo`** in the tree (and not `Investor2LongForm`)?

If you see **`Investor`** or **`Investor2LongForm`** when you expect the new long form, the wrong route or wrong component is rendering.

---

## 8. Quick checklist

| Check | What to do |
|-------|------------|
| URL | Must be `/investor2` when viewing long form. |
| Amber badge | "INVESTOR2: LONG FORM (NEW UX)" visible when long form is open. |
| Blue badge | "INVESTOR2 LONGFORM NIVO COMPONENT" visible when long form is open. |
| DOM | `data-investor2-view="long-form-nivo"` present; no `inv2-*` in long-form content if new UX. |
| Console | No red errors when switching to long form. |
| Build | Fresh `rm -rf dist node_modules/.vite` and `npm run build` + hard refresh. |

---

## 9. What to report back

If it’s still wrong after these steps, please share:

1. **Exact URL** when you see the “old” long form (e.g. `http://localhost:8080/investor2` or `/investor`).
2. **Which badges you see** (amber short, amber long, blue Nivo — or none).
3. **DOM result**: do you find `data-investor2-view="long-form-nivo"`? Do you see `text-inv2-fg` / `inv2-*` in the long-form section?
4. **Console**: any errors when you click “Long-form version”? (screenshot or copy‑paste is enough.)
5. **React DevTools**: top-level component name when long form is open (`Investor2` vs `Investor`) and whether `Investor2LongFormNivo` or `Investor2LongForm` appears in the tree.

That will show whether the issue is wrong route, wrong component, or correct component with wrong styling.
