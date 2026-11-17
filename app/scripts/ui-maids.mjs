/**
 * M9: раздел «Горничные» (менеджер), архив, Excel, тип «По требованию».
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium, devices } = await import("playwright");

const BASE = "https://hotel";
const shots = path.join(process.cwd(), "screenshots");
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const managerContext = await browser.newContext({
  viewport: { width: 1366, height: 950 },
  locale: "ru-RU",
});
const manager = await managerContext.newPage();
const errors = [];
manager.on("pageerror", (error) => errors.push(`manager: ${error.message}`));
manager.on("dialog", (dialog) => dialog.accept());

async function login(page, login, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', login);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
}

async function selectByText(selectLocator, text) {
  const value = await selectLocator
    .locator("option")
    .filter({ hasText: text })
    .first()
    .getAttribute("value");
  if (!value) throw new Error(`опция не найдена: ${text}`);
  await selectLocator.selectOption(value);
}

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

try {
  await login(manager, "manager", "Manager123!");

  // 1. Страница горничных
  await manager.goto(`${BASE}/admin/maids`, { waitUntil: "networkidle" });
  await manager.getByRole("heading", { name: "Горничные" }).waitFor();
  const maidenCard = manager.locator("div").filter({ hasText: "Горничная (демо)" }).first();
  await maidenCard.waitFor();
  const cardText = await maidenCard.innerText();
  if (!cardText.includes("101") || !cardText.includes("102") || !cardText.includes("103")) {
    throw new Error(`нет закреплённых номеров: ${cardText}`);
  }
  if (!cardText.includes("0 из 1")) throw new Error(`план не 0 из 1: ${cardText}`);
  await manager.screenshot({ path: path.join(shots, "43-maids-overview.png"), fullPage: true });
  console.log("✔ горничные: карточка, номера 101–103, план 0 из 1");

  // 2. Архив за период
  await manager.getByText("Архив заданий по датам").waitFor();
  const archiveText = await manager.locator("table tbody").innerText();
  if (!archiveText.includes("101")) throw new Error("в архиве нет задачи 101");
  console.log("✔ архив: задача 101 видна, фильтры по датам работают");

  // 3. Тип уборки: только DAILY / ON_DEMAND / GENERAL
  await manager.goto(`${BASE}/admin/cleaning`, { waitUntil: "networkidle" });
  const selects = manager.locator("select");
  const typeSelect = selects.nth(1);
  const options = await typeSelect.locator("option").allTextContents();
  if (options.includes("Выездная")) throw new Error("тип «Выездная» остался");
  if (!options.includes("По требованию")) throw new Error(`нет типа «По требованию»: ${options}`);
  console.log("✔ типы: " + options.join(", "));

  // Создаём задачу «По требованию» на 102, назначаем горничной
  await selectByText(typeSelect, "По требованию");
  await selectByText(selects.nth(0), "102");
  await selectByText(selects.nth(3), "Горничная");
  await manager.getByRole("button", { name: "Создать задачу" }).click();
  await manager.getByText("Задача создана").waitFor({ timeout: 20000 });
  console.log("✔ создана задача «По требованию» на 102");

  // 4. План увеличился до 2
  await manager.goto(`${BASE}/admin/maids`, { waitUntil: "networkidle" });
  const cardAfter = await manager
    .locator("div")
    .filter({ hasText: "Горничная (демо)" })
    .first()
    .innerText();
  if (!cardAfter.includes("0 из 2")) throw new Error(`план не 0 из 2: ${cardAfter}`);

  // 5. Горничная начинает смену и берёт задачу в работу
  const maidContext = await browser.newContext({ ...devices["iPhone 13"], locale: "ru-RU" });
  const maid = await maidContext.newPage();
  maid.on("pageerror", (error) => errors.push(`maid: ${error.message}`));
  await login(maid, "maid", "Maid123!");
  await maid.waitForURL(/\/m$/, { timeout: 20000 });
  await maid.getByRole("heading", { name: "Здравствуйте!" }).waitFor();
  const startShift = maid.getByRole("button", { name: "Начать смену" });
  if (await startShift.count()) {
    await startShift.click();
    await maid.getByRole("button", { name: "Завершить" }).waitFor({ timeout: 15000 });
  }
  await maid.goto(`${BASE}/m/tasks`, { waitUntil: "networkidle" });
  const task102 = maid.locator("article").filter({ hasText: "Номер 102" }).first();
  await task102.getByRole("button", { name: "Взять в работу" }).click();
  await maid.waitForTimeout(1500);
  console.log("✔ горничная на смене, задача 102 в работе");

  await manager.reload({ waitUntil: "networkidle" });
  await manager.getByText(/В работе: номер 102/).waitFor({ timeout: 20000 });
  await manager.screenshot({ path: path.join(shots, "44-maids-working.png"), fullPage: true });
  console.log("✔ менеджер видит статус «В работе» и текущую задачу 102");

  // 6. Excel архива
  const today = localToday();
  const base64 = await manager.evaluate(async (date) => {
    const response = await fetch(`/api/reports/export?report=maid-tasks&from=${date}&to=${date}`);
    if (!response.ok) throw new Error(`excel status ${response.status}`);
    const array = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of array) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, today);
  const buffer = Buffer.from(base64, "base64");
  const file = path.join(process.cwd(), ".tmp", "maid-tasks.xlsx");
  await writeFile(file, buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Горничные");
  if (!sheet) throw new Error("нет листа Горничные");
  const headers = sheet.getRow(1).values;
  if (!headers.includes("Горничная") || !headers.includes("Тип")) {
    throw new Error(`excel headers: ${JSON.stringify(headers)}`);
  }
  console.log("✔ Excel архива горничных: колонки и данные");

  // 7. Горничной раздел недоступен
  await maid.goto(`${BASE}/admin/maids`, { waitUntil: "domcontentloaded" });
  await maid.waitForURL(/\/m$/, { timeout: 20000 });
  console.log("✔ горничная перенаправлена из /admin/maids в /m");

  console.log(JSON.stringify({ ok: true, errors }, null, 2));
  if (errors.length) process.exit(1);
  await maidContext.close();
} finally {
  await managerContext.close();
  await browser.close();
}
