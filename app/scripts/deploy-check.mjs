/**
 * Проверка развёрнутого домена https://hotel (OSPanel + Node).
 * Админ-панель и PWA горничной проверяются в разных контекстах:
 * service worker регистрируется только в мобильном разделе /m.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium, devices } = await import("playwright");

const BASE = process.env.DEPLOY_URL ?? "https://hotel";
const shots = path.join(process.cwd(), "screenshots");
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const pageErrors = [];

async function login(page, login, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="login"]', login);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
}

try {
  // ---------- админ ----------
  const adminContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ru-RU" });
  const admin = await adminContext.newPage();
  admin.on("pageerror", (error) => pageErrors.push(`admin: ${error.message}`));

  const response = await admin.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (!response || response.status() !== 200) throw new Error(`login status: ${response?.status()}`);
  console.log("✔ HTTPS-домен отвечает 200, сертификат принят браузером");

  await login(admin, "admin", "Admin123!");
  await admin.getByRole("heading", { name: "Обзор" }).waitFor({ timeout: 20000 });
  await admin.screenshot({ path: path.join(shots, "31-deploy-admin.png"), fullPage: true });
  console.log("✔ вход администратора через https://hotel, панель «Обзор» открыта");

  await admin.goto(`${BASE}/admin/cleaning`, { waitUntil: "networkidle" });
  await admin.getByRole("heading", { name: "Уборка" }).waitFor();
  await admin.screenshot({ path: path.join(shots, "32-deploy-cleaning.png"), fullPage: true });
  console.log("✔ раздел «Уборка» открывается в домене");
  await adminContext.close();

  // ---------- горничная: PWA ----------
  const maidContext = await browser.newContext({ ...devices["iPhone 13"], locale: "ru-RU" });
  const maid = await maidContext.newPage();
  maid.on("pageerror", (error) => pageErrors.push(`maid: ${error.message}`));
  await login(maid, "maid", "Maid123!");
  await maid.waitForURL(/\/m$/, { timeout: 20000 });

  const pwa = await maid.evaluate(async () => {
    const result = { sw: false, manifest: false };
    if ("serviceWorker" in navigator) {
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then((registration) => Boolean(registration.active)),
        new Promise((resolve) => setTimeout(() => resolve(false), 10000)),
      ]);
      result.sw = Boolean(ready);
    }
    const manifest = await fetch("/api/manifest");
    result.manifest = manifest.ok;
    return result;
  });
  console.log(`✔ PWA в домене: service worker ${pwa.sw ? "активен" : "не активен"}, manifest ${pwa.manifest ? "доступен" : "нет"}`);
  await maid.screenshot({ path: path.join(shots, "33-deploy-maid.png"), fullPage: true });
  await maidContext.close();

  console.log(JSON.stringify({ ok: pwa.sw && pwa.manifest, base: BASE, pageErrors }, null, 2));
  if (!pwa.sw || !pwa.manifest) process.exit(2);
} finally {
  await browser.close();
}
