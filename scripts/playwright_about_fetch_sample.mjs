#!/usr/bin/env node
/**
 * Playwright smoke: fetch homepage + same-origin About/Om oss link (mirrors site_about_fetch heuristics).
 *
 * Usage:
 *   cd /path/to/nivo && node scripts/playwright_about_fetch_sample.mjs
 *   node scripts/playwright_about_fetch_sample.mjs --input scripts/fixtures/gpt_website_retrieval_runs/about_search_20260325T100504Z.json
 *   node scripts/playwright_about_fetch_sample.mjs --limit 5
 *   node scripts/playwright_about_fetch_sample.mjs --limit 15 --offset 20   # slice input JSON
 *
 * Requires: npm install (playwright is devDependency) and: npx playwright install chromium
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const ABOUT_RE =
  /about|om-oss|omoss|om\s+oss|company|företag|foretag|who-we|our-story|varum|historia/i;
const MAX_PREVIEW = 1200;
const NAV_TIMEOUT_MS = 35_000;

function normHost(netloc) {
  let h = netloc.toLowerCase().split("@").pop().split(":")[0];
  if (h.startsWith("www.")) h = h.slice(4);
  return h;
}

function sameSite(netlocA, netlocB) {
  return normHost(netlocA) === normHost(netlocB);
}

function scoreAbout(href, label) {
  const s = `${href} ${label}`;
  return ABOUT_RE.test(s) ? 3 : 0;
}

function parseArgs(argv) {
  const out = { input: null, limit: 20, offset: 0, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input" && argv[i + 1]) {
      out.input = argv[++i];
    } else if (a === "--limit" && argv[i + 1]) {
      out.limit = Math.max(1, parseInt(argv[++i], 10) || 20);
    } else if (a === "--offset" && argv[i + 1]) {
      out.offset = Math.max(0, parseInt(argv[++i], 10) || 0);
    } else if (a === "--out" && argv[i + 1]) {
      out.out = argv[++i];
    }
  }
  return out;
}

function previewText(t) {
  const s = (t || "").replace(/\s+/g, " ").trim();
  if (s.length <= MAX_PREVIEW) return s;
  return s.slice(0, MAX_PREVIEW) + "…";
}

async function extractInternalLinks(page, baseUrl) {
  return page.evaluate((base) => {
    let bu;
    try {
      bu = new URL(base);
    } catch {
      return [];
    }
    const official = bu.hostname;
    const norm = (h) => (h || "").toLowerCase().replace(/^www\./, "");

    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = (a.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) continue;
      if (/\.(pdf|zip|jpg|png|gif)$/i.test(href)) continue;
      let abs;
      try {
        abs = new URL(href, base).href;
      } catch {
        continue;
      }
      const u = new URL(abs);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (norm(u.hostname) !== norm(official)) continue;
      const key = abs.split("#")[0].replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      const label = (a.textContent || "").replace(/\s+/g, " ").trim();
      out.push({ url: key, label });
    }
    return out;
  }, baseUrl);
}

function pickAboutUrl(cands, excludeNormalized) {
  let best = null;
  let bestScore = 0;
  for (const { url, label } of cands) {
    const u = url.split("#")[0].replace(/\/$/, "");
    if (excludeNormalized.has(u)) continue;
    const sc = scoreAbout(url, label);
    if (sc > bestScore) {
      bestScore = sc;
      best = url;
    }
  }
  return bestScore > 0 ? best : null;
}

async function fetchOne(browser, startUrl) {
  const t0 = Date.now();
  const context = await browser.newContext({
    userAgent: "NivoPlaywrightAboutSample/1.0 (+https://nivogroup.se)",
    locale: "sv-SE",
  });
  const page = await context.newPage();
  const item = {
    input_url: startUrl,
    final_home_url: "",
    http_status: null,
    title: "",
    error: null,
    home_text_len: 0,
    home_text_preview: "",
    about_chosen_url: "",
    about_text_len: 0,
    about_text_preview: "",
    status: "unknown",
    duration_ms: 0,
  };

  try {
    const res = await page.goto(startUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    item.http_status = res?.status() ?? null;
    item.final_home_url = page.url().split("#")[0].replace(/\/$/, "") || startUrl;
    item.title = (await page.title()) || "";

    const homeText = await page.evaluate(() => {
      try {
        return document.body ? document.body.innerText || "" : "";
      } catch {
        return "";
      }
    });
    const homeNorm = homeText.replace(/\s+/g, " ").trim();
    item.home_text_len = homeNorm.length;
    item.home_text_preview = previewText(homeNorm);

    if (!homeNorm.length) {
      item.status = "empty_text";
      item.duration_ms = Date.now() - t0;
      await context.close();
      return item;
    }

    const finalUrl = page.url();
    const cands = await extractInternalLinks(page, finalUrl);
    const exclude = new Set([new URL(finalUrl).href.split("#")[0].replace(/\/$/, "")]);
    const aboutU = pickAboutUrl(cands, exclude);

    if (!aboutU) {
      item.status = "home_only";
      item.duration_ms = Date.now() - t0;
      await context.close();
      return item;
    }

    item.about_chosen_url = aboutU;
    await page.goto(aboutU, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    const aboutText = await page.evaluate(() => {
      try {
        return document.body ? document.body.innerText || "" : "";
      } catch {
        return "";
      }
    });
    const aboutNorm = aboutText.replace(/\s+/g, " ").trim();
    item.about_text_len = aboutNorm.length;
    item.about_text_preview = previewText(aboutNorm);
    item.status = aboutNorm.length ? "ok" : "home_only";
  } catch (e) {
    item.error = `${e.name || "Error"}: ${e.message || String(e)}`.slice(0, 400);
    item.status = "error";
  }

  item.duration_ms = Date.now() - t0;
  await context.close();
  return item;
}

async function main() {
  const args = parseArgs(process.argv);
  const defaultInput = path.join(
    REPO_ROOT,
    "scripts/fixtures/gpt_website_retrieval_runs/about_search_20260325T100504Z.json",
  );
  const inputPath = path.resolve(REPO_ROOT, args.input || defaultInput);
  if (!fs.existsSync(inputPath)) {
    console.error("Input not found:", inputPath);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const companies = raw.input_companies || raw.companies || [];
  const slice = companies.slice(args.offset, args.offset + args.limit);

  if (!slice.length) {
    console.error(
      `No companies in input (offset=${args.offset}, limit=${args.limit}; file has ${companies.length}).`,
    );
    process.exit(1);
  }

  console.error(
    `Playwright: ${slice.length} URL(s) from ${inputPath} (offset=${args.offset}, limit=${args.limit})`,
  );

  const browser = await chromium.launch({ headless: true });
  const items = [];
  try {
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const url = (c.official_website_url || c.url || "").trim();
      if (!url) {
        items.push({
          input_url: "",
          orgnr: c.orgnr,
          company_name: c.company_name,
          status: "no_url",
          error: "missing url",
        });
        continue;
      }
      process.stderr.write(`[${i + 1}/${slice.length}] ${url}\n`);
      const row = await fetchOne(browser, url);
      row.orgnr = c.orgnr;
      row.company_name = c.company_name;
      items.push(row);
    }
  } finally {
    await browser.close();
  }

  const out = {
    schema_version: 1,
    script: "playwright_about_fetch_sample.mjs",
    created_at_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    input_file: path.relative(REPO_ROOT, inputPath),
    limit: args.limit,
    offset: args.offset,
    items,
  };

  const outPath = args.out
    ? path.resolve(REPO_ROOT, args.out)
    : path.join(
        REPO_ROOT,
        "scripts/fixtures/gpt_website_retrieval_runs",
        `playwright_about_sample_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}Z.json`,
      );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.error(`Wrote ${outPath}`);

  const ok = items.filter((x) => x.status === "ok").length;
  const homeOnly = items.filter((x) => x.status === "home_only").length;
  const err = items.filter((x) => x.status === "error" || x.status === "empty_text").length;
  console.error(`Summary: ok=${ok} home_only=${homeOnly} empty/error=${err}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
