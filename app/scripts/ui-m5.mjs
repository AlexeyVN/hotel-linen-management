/**
 * M5 UI-проверка: кнопки интеграции в админке + отчёты. Снимает скриншоты.
 * Требует запущенных приложения и мока 1С; конфигурация интеграции — снаружи.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium } = await import("playwright");

const BASE = process.env.UI_BASE_URL ?? "http://127.0.0.1:3000";
const shots = path.join(process.cwd(), "screenshots");
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ru-RU" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "Admin123!");
await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForLoadState("networkidle");

await page.goto(`${BASE}/admin/settings/1c`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Настройки 1С" }).waitFor();
await page.waitForLoadState("networkidle");

await page.getByRole("button", { name: "Проверить соединение" }).click();
await page.getByText("1С ответила").waitFor({ timeout: 15000 });
console.log("✔ UI: проверка соединения с 1С");

await page.getByRole("button", { name: "Синхронизировать номенклатуру" }).click();
await page.getByText(/Номенклатура:/).waitFor({ timeout: 15000 });
console.log("✔ UI: синхронизация номенклатуры из интерфейса");

await page.screenshot({ path: path.join(shots, "15-admin-integration.png"), fullPage: true });

for (const report of ["stock", "low"]) {
  await page.goto(`${BASE}/admin/reports?report=${report}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Отчёты" }).waitFor();
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(shots, `16-admin-report-${report}.png`),
    fullPage: true,
  });
}
console.log("✔ UI: отчёты остатков и дефицита");

await browser.close();
console.log(JSON.stringify({ ok: true, pageErrors: errors, screenshots: shots }, null, 2));
if (errors.length > 0) process.exit(1);
