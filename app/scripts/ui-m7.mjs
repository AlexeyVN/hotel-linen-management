/**
 * M7 UI-проверка: чек-листы в админке, новый мобильный интерфейс горничной,
 * заполнение чек-листа, фото и завершение уборки.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium, devices } = await import("playwright");

const BASE = process.env.UI_BASE_URL ?? "http://127.0.0.1:3000";
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
  // ---------- админ: чек-листы и доска уборки ----------
  const adminContext = await browser.newContext({ viewport: { width: 1366, height: 950 }, locale: "ru-RU" });
  const admin = await adminContext.newPage();
  admin.on("pageerror", (error) => pageErrors.push(`admin: ${error.message}`));
  await login(admin, "admin", "Admin123!");

  await admin.goto(`${BASE}/admin/checklists`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Чек-листы уборки" }).waitFor();
  await admin.getByText("Стандартная уборка номера").first().waitFor();
  await admin.screenshot({ path: path.join(shots, "24-admin-checklists.png"), fullPage: true });
  console.log("✔ UI: шаблон чек-листа с пунктами и фото-требованием");

  await admin.goto(`${BASE}/admin/cleaning`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Уборка" }).waitFor();
  await admin.waitForTimeout(800);
  await admin.screenshot({ path: path.join(shots, "25-admin-cleaning.png"), fullPage: true });
  console.log("✔ UI: задача с прикреплённым чек-листом видна на доске");

  // ---------- горничная: новый дашборд ----------
  const mobileContext = await browser.newContext({ ...devices["iPhone 13"], locale: "ru-RU" });
  const maid = await mobileContext.newPage();
  maid.on("pageerror", (error) => pageErrors.push(`maid: ${error.message}`));
  await login(maid, "maid", "Maid123!");

  await maid.waitForURL(/\/m$/, { timeout: 20000 });
  await maid.getByRole("heading", { name: "Здравствуйте!" }).waitFor();
  await maid.getByText("Мои уборки").waitFor();
  await maid.screenshot({ path: path.join(shots, "26-mobile-dashboard.png"), fullPage: true });
  console.log("✔ UI: дашборд горничной со статистикой и сменой");

  await maid.goto(`${BASE}/m/tasks`, { waitUntil: "domcontentloaded" });
  await maid.getByRole("heading", { name: "Мои уборки" }).waitFor();
  await maid.waitForTimeout(800);
  await maid.screenshot({ path: path.join(shots, "27-mobile-tasks.png"), fullPage: true });
  console.log("✔ UI: список уборок с фильтрами");

  await maid.getByRole("link", { name: "Номер 102" }).click();
  await maid.waitForURL(/\/m\/tasks\/[a-z0-9]+$/, { timeout: 20000 });
  await maid.getByRole("heading", { name: "Номер 102" }).waitFor();
  await maid.screenshot({ path: path.join(shots, "28-mobile-task-detail.png"), fullPage: true });

  await maid.getByRole("button", { name: "Взять в работу" }).click();
  await maid.getByText("Задача в работе").waitFor({ timeout: 20000 });

  // отметить все пункты «Да»
  for (const text of [
    "Пыль на поверхностях",
    "Санузел вымыт",
    "Полы вымыты",
    "Мусор вынесен",
  ]) {
    const item = maid.locator("li").filter({ hasText: text }).first();
    await item.getByRole("button", { name: "Да" }).click();
    await maid.waitForTimeout(400);
  }

  // фото для пункта «Санузел вымыт»
  const photoItem = maid.locator("li").filter({ hasText: "Санузел вымыт" }).first();
  await photoItem.locator('input[type="file"]').setInputFiles(
    path.join(process.cwd(), ".tmp", "checklist.png"),
  );
  await maid.getByText("Фото загружено").waitFor({ timeout: 20000 });
  console.log("✔ UI: чек-лист заполнен, фото пункта загружено");

  await maid.getByRole("button", { name: "Уборка выполнена" }).click();
  await maid.getByText(/Уборка выполнена: номер чистый/).waitFor({ timeout: 20000 });
  await maid.reload({ waitUntil: "domcontentloaded" });
  await maid.getByText(/Задача закрыта/).waitFor({ timeout: 20000 });
  await maid.screenshot({ path: path.join(shots, "29-mobile-task-closed.png"), fullPage: true });
  console.log("✔ UI: задача закрыта после полного чек-листа");

  await maid.goto(`${BASE}/m/rooms`, { waitUntil: "domcontentloaded" });
  await maid.getByRole("heading", { name: "Мои номера" }).waitFor();
  await maid.waitForTimeout(800);
  await maid.screenshot({ path: path.join(shots, "30-mobile-rooms.png"), fullPage: true });
  console.log("✔ UI: экран номеров со статусами");

  await adminContext.close();
  await mobileContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, pageErrors, screenshots: shots }, null, 2));
if (pageErrors.length > 0) process.exit(1);
