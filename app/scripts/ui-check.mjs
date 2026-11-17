/**
 * UI-проверка Playwright: скриншоты, PWA, офлайн-очередь раздачи.
 * Запуск: node scripts/ui-check.mjs   (сервер уже запущен на BASE_URL)
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium, devices } = await import("playwright");

const BASE = process.env.UI_BASE_URL ?? "http://127.0.0.1:3000";
const shotsDir = path.join(process.cwd(), "screenshots");
await mkdir(shotsDir, { recursive: true });

const results = [];
const pageErrors = [];

function pass(name, extra = {}) {
  results.push({ name, ok: true, ...extra });
  console.log("✔", name);
}

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: true });
}

function digits(text) {
  const match = String(text ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

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

async function expectHeading(page, text) {
  await page.locator("h1", { hasText: text }).first().waitFor({ timeout: 15000 });
}

const browser = await chromium.launch();

try {
  // ---------------- администратор: десктоп ----------------
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ru-RU" });
  const admin = await desktop.newPage();
  admin.on("pageerror", (error) => pageErrors.push(`admin: ${error.message}`));

  await admin.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await shot(admin, "01-login");
  await login(admin, "admin", "Admin123!");
  await expectHeading(admin, "Обзор");
  await shot(admin, "02-admin-dashboard");
  pass("вход администратора и обзор");

  const adminPages = [
    { path: "/admin/rooms", heading: "Номера и типы комнат", shot: "03-admin-rooms" },
    { path: "/admin/warehouse", heading: "Склад", shot: "04-admin-warehouse" },
    { path: "/admin/audit", heading: "Инвентаризация номеров", shot: "05-admin-audit" },
    { path: "/admin/users", heading: "Пользователи и роли", shot: "06-admin-users" },
    { path: "/admin/roles", heading: "Роли и права", shot: "07-admin-roles" },
  ];
  for (const entry of adminPages) {
    await admin.goto(`${BASE}${entry.path}`, { waitUntil: "domcontentloaded" });
    await expectHeading(admin, entry.heading);
    await admin.waitForLoadState("networkidle");
    await shot(admin, entry.shot);
  }
  pass("разделы админки отрисовываются", { pages: adminPages.length });

  // инвентаризация: старт из UI и сохранение черновика
  await admin.goto(`${BASE}/admin/audit`, { waitUntil: "domcontentloaded" });
  await admin.waitForFunction(
    () => document.querySelectorAll("select")[0]?.options.length > 1,
    null,
    { timeout: 15000 },
  );
  await admin.locator("select").first().selectOption({ index: 1 });
  await admin.getByRole("button", { name: "Начать" }).click();
  await admin.waitForURL(/\/admin\/audit\/[a-z0-9]+$/, { timeout: 20000 });
  await admin.waitForLoadState("networkidle");
  const factInputs = admin.locator('table input[type="number"]');
  await factInputs.first().waitFor({ timeout: 15000 });
  await factInputs.first().fill("1");
  await admin.getByRole("button", { name: "Сохранить черновик" }).click();
  await admin.getByText("Черновик сохранён").waitFor({ timeout: 15000 });
  await shot(admin, "08-admin-audit-session");
  pass("черновик инвентаризации сохранён из интерфейса");

  // ---------------- горничная: мобильный контекст + PWA ----------------
  const mobile = await browser.newContext({ ...devices["iPhone 13"], locale: "ru-RU" });
  const maid = await mobile.newPage();
  maid.on("pageerror", (error) => pageErrors.push(`maid: ${error.message}`));

  await login(maid, "maid", "Maid123!");
  await maid.waitForURL(/\/m$/, { timeout: 20000 });
  await expectHeading(maid, "Мой раздел");
  await shot(maid, "09-mobile-home");
  pass("вход горничной на /m");

  const swActive = await maid.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  });
  if (!swActive) throw new Error("service worker не активировался на localhost");
  pass("service worker активен (localhost — secure context)");

  const manifestHref = await maid.evaluate(() =>
    document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
  );
  if (manifestHref !== "/api/manifest") {
    throw new Error(`manifest не подключён: ${manifestHref}`);
  }
  const tabs = await maid.locator("nav a").count();
  if (tabs !== 3) throw new Error(`TabBar: ожидалось 3 вкладки, найдено ${tabs}`);
  pass("manifest подключён, TabBar из 3 вкладок");

  await maid.goto(`${BASE}/m/audit`, { waitUntil: "domcontentloaded" });
  await expectHeading(maid, "Инвентаризация");
  await maid.waitForLoadState("networkidle");
  await shot(maid, "10-mobile-audit-list");
  await maid.goto(`${BASE}/m/distribute`, { waitUntil: "domcontentloaded" });
  await expectHeading(maid, "Раздача");
  await maid.waitForLoadState("networkidle");
  await shot(maid, "11-mobile-distribute");
  pass("мобильные экраны инвентаризации и раздачи отрисовываются");

  // ---------------- офлайн: раздача в очередь ----------------
  await maid.waitForFunction(
    () =>
      document.querySelectorAll("select")[0]?.options.length > 1 &&
      document.querySelectorAll("select")[1]?.options.length > 1,
    null,
    { timeout: 20000 },
  );
  const roomSelect = maid.locator("select").nth(0);
  const itemSelect = maid.locator("select").nth(1);
  await roomSelect.selectOption({ index: 1 });
  await itemSelect.selectOption({ index: 1 });
  const roomLabel = await roomSelect.evaluate((el) => el.options[el.selectedIndex].text);
  const itemLabel = await itemSelect.evaluate((el) => el.options[el.selectedIndex].text);
  const stockBefore = digits(await maid.getByText(/на складе:/).first().textContent());
  if (stockBefore === null) throw new Error("не удалось прочитать остаток склада");

  await mobile.setOffline(true);
  await maid.getByText(/Офлайн: раздача уйдёт в очередь/).waitFor({ timeout: 10000 });
  await maid.getByRole("button", { name: "Поставить в очередь" }).click();
  await maid.getByText(/раздача в очереди/).waitFor({ timeout: 10000 });
  await shot(maid, "12-mobile-offline-queued");
  pass("офлайн-раздача поставлена в очередь", { roomLabel, itemLabel, stockBefore });

  // офлайн-навигация: оболочка из кеша SW
  try {
    await maid.goto(`${BASE}/m`, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch {
    // допустимо: главное — содержимое из кеша ниже
  }
  await expectHeading(maid, "Мой раздел");
  await maid.getByText(/ждёт отправки/).first().waitFor({ timeout: 15000 });
  await shot(maid, "13-mobile-offline-shell");
  pass("офлайн: оболочка /m из кеша, очередь показывает запись");

  // ---------------- снова онлайн: досыл ровно один раз ----------------
  await mobile.setOffline(false);
  await maid.getByText("Очередь пуста.").waitFor({ timeout: 30000 });
  pass("онлайн: очередь отправлена, панель пуста");

  await maid.goto(`${BASE}/m/distribute`, { waitUntil: "domcontentloaded" });
  await maid.waitForFunction(
    () =>
      document.querySelectorAll("select")[0]?.options.length > 1 &&
      document.querySelectorAll("select")[1]?.options.length > 1,
    null,
    { timeout: 20000 },
  );
  await maid.locator("select").nth(0).selectOption({ index: 1 });
  await maid.locator("select").nth(1).selectOption({ index: 1 });
  const stockAfter = digits(await maid.getByText(/на складе:/).first().textContent());
  if (stockAfter !== stockBefore - 1) {
    throw new Error(`остаток после досыла: ${stockAfter}, ожидалось ${stockBefore - 1}`);
  }
  await shot(maid, "14-mobile-after-sync");
  pass("остаток изменился ровно на 1 (нет дубля)", { stockAfter });

  await desktop.close();
  await mobile.close();
} finally {
  await browser.close();
}

const failed = results.filter((entry) => !entry.ok);
console.log(
  JSON.stringify(
    { base: BASE, checks: results, pageErrors, screenshots: shotsDir },
    null,
    2,
  ),
);
if (failed.length > 0) process.exit(1);
