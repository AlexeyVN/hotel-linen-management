/**
 * M6 UI-проверка: админская доска уборки, мобильные задачи, офлайн-завершение задачи.
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
  // ---------- админ: доска уборки ----------
  const adminContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ru-RU" });
  const admin = await adminContext.newPage();
  admin.on("pageerror", (error) => pageErrors.push(`admin: ${error.message}`));
  await login(admin, "admin", "Admin123!");

  await admin.goto(`${BASE}/admin/cleaning`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "Уборка" }).waitFor();
  await admin.waitForFunction(
    () => document.querySelectorAll("select")[0]?.options.length > 1,
    null,
    { timeout: 15000 },
  );

  const roomSelect = admin.locator("select").nth(0);
  const roomValue = await roomSelect.evaluate((element) => {
    const select = element;
    return Array.from(select.options).find((option) => option.text.startsWith("104"))?.value ?? "";
  });
  if (!roomValue) throw new Error("номер 104 не найден в списке");
  await roomSelect.selectOption(roomValue);
  const assigneeSelect = admin.locator("select").nth(3);
  const assigneeValue = await assigneeSelect.evaluate((element) => {
    const select = element;
    return (
      Array.from(select.options).find((option) => option.text.includes("Горничная"))?.value ?? ""
    );
  });
  await assigneeSelect.selectOption(assigneeValue);
  await admin.getByRole("button", { name: "Создать задачу" }).click();
  await admin.getByText(/Задача создана/).waitFor({ timeout: 15000 });
  await admin.screenshot({ path: path.join(shots, "21-admin-cleaning.png"), fullPage: true });
  console.log("✔ UI: задача на уборку создана из админки");

  // ---------- горничная: задачи и смена ----------
  const mobileContext = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "ru-RU",
  });
  const maid = await mobileContext.newPage();
  maid.on("pageerror", (error) => pageErrors.push(`maid: ${error.message}`));
  await login(maid, "maid", "Maid123!");

  await maid.goto(`${BASE}/m/tasks`, { waitUntil: "domcontentloaded" });
  await maid.getByRole("heading", { name: "Мои задачи" }).waitFor();
  await maid.getByRole("button", { name: "Начать смену" }).click();
  await maid.getByText("Смена идёт").waitFor({ timeout: 15000 });
  await maid.screenshot({ path: path.join(shots, "22-mobile-tasks.png"), fullPage: true });
  console.log("✔ UI: смена начата, задачи видны");

  // берём первую задачу в работу (сортировка: активные, приоритет, время)
  await maid.getByRole("button", { name: "Взять в работу" }).first().click();
  await maid.getByText("Задача в работе").waitFor({ timeout: 15000 });

  // офлайн: завершение задачи уходит в очередь
  await mobileContext.setOffline(true);
  await maid.getByText(/Офлайн: статусы задач/).waitFor({ timeout: 10000 });
  await maid.getByRole("button", { name: "Готово" }).first().click();
  await maid.getByText(/статус задачи уйдёт в очередь/).waitFor({ timeout: 10000 });
  await maid.screenshot({ path: path.join(shots, "23-mobile-tasks-offline.png"), fullPage: true });
  console.log("✔ UI: офлайн-завершение задачи поставлено в очередь");

  // онлайн: QueueFlusher досылает без перехода на главную
  await mobileContext.setOffline(false);
  await maid.waitForTimeout(8000);
  await maid.reload({ waitUntil: "domcontentloaded" });
  await maid.getByRole("heading", { name: "Мои задачи" }).waitFor();
  await maid.waitForTimeout(1500);
  const stillThere = await maid.getByText("Номер 101").count();
  if (stillThere > 0) throw new Error("задача 101 не закрылась после досыла очереди");
  console.log("✔ UI: очередь досылается, задача закрыта, номер освободился");

  await adminContext.close();
  await mobileContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, pageErrors, screenshots: shots }, null, 2));
if (pageErrors.length > 0) process.exit(1);
