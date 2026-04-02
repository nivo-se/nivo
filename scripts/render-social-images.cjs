/**
 * Renders PNG social / PWA images into frontend/public/.
 * Requires: npm install (root) and npx playwright install chromium
 */
const path = require("path");
const { chromium } = require("playwright");

const OUT = path.join(__dirname, "..", "frontend", "public");

const N_PATHS = [
  "M410.65,417.25c-15.53-2.41-33.89-4.19-54.51-4.11-19.59.07-37.11,1.79-52.04,4.11-4.52-4.88-9.08-9.78-13.68-14.68-4.59-4.89-9.22-9.78-13.88-14.71L46.48,142.77v215.74c0,7.63.27,31.76.54,47.23.09,4.91.13,8.92.22,11.28-7.81-1.61-15.57-2.68-23.37-2.68-5.71,0-11.11.58-16.64,1.52-.85.13-1.69.27-2.54.45-1.56.27-3.08.58-4.68.94,6.42-54.73,9.9-160.65,9.9-317.25,0-26.18-.58-67.39-1.74-100h22.43c125.33,145.94,252.27,284.78,380.05,417.25Z",
  "M59.86,0c15.53,2.41,33.89,4.19,54.51,4.11,19.59-.07,37.11-1.79,52.04-4.11,4.52,4.88,9.08,9.78,13.68,14.68,4.59,4.89,9.22,9.78,13.88,14.71l230.05,245.09V58.74c0-7.63-.27-31.76-.54-47.23-.09-4.91-.13-8.92-.22-11.28,7.81,1.61,15.57,2.68,23.37,2.68,5.71,0,11.11-.58,16.64-1.52.85-.13,1.69-.27,2.54-.45,1.56-.27,3.08-.58,4.68-.94-6.42,54.73-9.9,160.65-9.9,317.25,0,26.18.58,67.39,1.74,100h-22.43C314.58,271.31,187.64,132.47,59.86,0Z",
];

function nMarkSvg(sizePx) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470.51 417.25" width="${sizePx}" height="${Math.round((sizePx * 417.25) / 470.51)}" aria-hidden="true">${N_PATHS.map(
    (d) => `<path fill="#596152" d="${d}"/>`
  ).join("")}</svg>`;
}

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#222;">
<div id="og-card" style="width:1200px;height:630px;background:#F7F5F2;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#2E2A2B;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;box-sizing:border-box;">
  <h1 style="font-size:108px;font-weight:700;margin:0;letter-spacing:-0.035em;line-height:1;">Nivo</h1>
  <div style="width:72px;height:4px;background:#596152;margin:26px 0 22px;"></div>
  <p style="font-size:28px;font-weight:500;margin:0;max-width:1000px;text-align:center;line-height:1.35;opacity:0.96;">Nivo - backing great companies</p>
  <p style="font-size:19px;font-weight:500;margin:20px 0 0;max-width:980px;text-align:center;line-height:1.42;opacity:0.78;">Nivo backing stable, profitable companies. We acquire with respect for what you&apos;ve built and focus on practical ways to strengthen the business together.</p>
</div>
<div id="og-square" style="width:512px;height:512px;background:#F7F5F2;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
  ${nMarkSvg(300)}
</div>
<div id="og-touch" style="width:180px;height:180px;background:#F7F5F2;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
  ${nMarkSvg(112)}
</div>
</body></html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });

  await page.locator("#og-card").screenshot({
    path: path.join(OUT, "og-share-1200x630.png"),
    type: "png",
  });
  await page.locator("#og-square").screenshot({
    path: path.join(OUT, "og-share-512.png"),
    type: "png",
  });
  await page.locator("#og-touch").screenshot({
    path: path.join(OUT, "apple-touch-icon.png"),
    type: "png",
  });

  await browser.close();
  console.log("Wrote og-share-1200x630.png, og-share-512.png, apple-touch-icon.png → frontend/public/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
