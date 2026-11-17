/**
 * Генерация PNG-иконок PWA через Playwright (headless Chromium).
 * Запуск: node scripts/make-icons.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium } = await import("playwright");

const outDir = path.join(process.cwd(), "public", "icons");
await mkdir(outDir, { recursive: true });

function html(size, maskable) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  return `<!doctype html><html><body style="margin:0;background:transparent">
  <div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:linear-gradient(145deg,#2563eb,#1d4ed8);display:flex;align-items:center;justify-content:center">
    <span style="font-size:${Math.round(size * 0.52)}px;line-height:1;font-family:'Segoe UI Emoji',sans-serif">🧺</span>
  </div></body></html>`;
}

const browser = await chromium.launch();
const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-512-maskable.png", size: 512, maskable: true },
];

for (const target of targets) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(html(target.size, target.maskable));
  await page.screenshot({ path: path.join(outDir, target.name), omitBackground: false });
  await page.close();
  console.log("icon:", target.name, target.size + "px");
}

await browser.close();
