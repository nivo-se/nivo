#!/usr/bin/env node
/**
 * Quick browser test for localhost:8080 — checks if page renders.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:8080';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') consoleErrors.push(text);
    else consoleLogs.push(`[${type}] ${text}`);
  });

  try {
    const res = await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
    console.log('Status:', res?.status());
  } catch (e) {
    console.log('Navigation error:', e.message);
  }

  // Wait for React to render — try Dashboard, Loading, or Deep Research
  try {
    await page.waitForSelector('#root aside, #root main, #root [class*="flex"], #root :has-text("Dashboard"), #root :has-text("Loading"), #root :has-text("Deep Research")', { timeout: 8000 });
    console.log('Content appeared');
  } catch {
    console.log('No expected content within 8s');
  }
  await page.waitForTimeout(1000);

  const root = await page.locator('#root');
  const rootHtml = await root.evaluate((el) => el?.innerHTML?.slice(0, 2000) || '(empty)');
  const rootText = await root.evaluate((el) => el?.innerText?.slice(0, 500) || '(empty)');
  const hasContent = (await root.locator('aside, main, .flex, [role="main"]').count()) > 0;

  console.log('\n--- Root innerHTML (first 2000 chars) ---');
  console.log(rootHtml || '(empty)');
  console.log('\n--- Root visible text (first 500 chars) ---');
  console.log(rootText || '(empty)');
  console.log('\n--- Has layout elements (aside/main/flex)? ---', hasContent);
  console.log('\n--- Console errors ---');
  consoleErrors.forEach((e) => console.log(e));
  if (consoleErrors.length === 0) console.log('(none)');

  await page.screenshot({ path: '/Users/jesper/nivo/nivo-browser-test.png' });
  console.log('\nScreenshot saved: nivo-browser-test.png');

  await browser.close();
}

main().catch(console.error);
