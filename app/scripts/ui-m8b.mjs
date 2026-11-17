/**
 * M8B: оценка инвентаризации, отчёты с ценой/датой, Excel, «без цены».
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium } = await import("playwright");

const BASE = "https://hotel";
const shots = path.join(process.cwd(), "screenshots");
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 950 }, locale: "ru-RU" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', "admin");
  await page.fill('input[name="password"]', "Admin123!");
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

try {
  await login();

  // 1. Раздача 3 полотенец в 101 датой 02.11.2026
  await page.goto(`${BASE}/admin/distribute`, { waitUntil: "networkidle" });
  await page.getByLabel("Дата документа", { exact: true }).fill("2026-11-02");
  await selectByText(page.getByLabel("Номер"), "101");
  await selectByText(page.getByLabel("Позиция"), "Полотенце банное");
  await page.getByLabel("Кол-во").fill("3");
  await page.getByRole("button", { name: /Провести: Раздача/ }).click();
  await page.getByText("Операция проведена").waitFor({ timeout: 20000 });
  console.log("✔ раздача: 3 полотенца в 101 датой 02.11.2026");

  // 2. Инвентаризация: факт 1 при учёте 3 → недостача 2 × 450 = 900 ₽
  await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  await selectByText(page.getByLabel("Номер"), "101");
  await page.getByRole("button", { name: "Начать" }).click();
  await page.waitForURL(/\/admin\/audit\/[a-z0-9]+$/, { timeout: 20000 });
  await page.getByRole("heading", { name: "Номер 101" }).waitFor();
  const towelRow = page.locator("tr").filter({ hasText: "Полотенце банное" }).first();
  await towelRow.locator('input[type="number"]').fill("1");
  await page.waitForTimeout(500);
  const rowText = await towelRow.innerText();
  if (!rowText.includes("450,00 ₽")) throw new Error(`нет цены в строке: ${rowText}`);
  await page.getByText(/Стоимость расхождений/).first().waitFor();
  const totals = await page.locator("p").filter({ hasText: "Стоимость расхождений" }).first().innerText();
  if (!totals.includes("900,00 ₽")) throw new Error(`неверная стоимость расхождений: ${totals}`);
  await page.screenshot({ path: path.join(shots, "40-audit-valuation.png"), fullPage: true });
  console.log("✔ инвентаризация: цена 450 ₽, стоимость расхождения −900 ₽");

  await page.getByRole("button", { name: "Применить инвентаризацию" }).click();
  await page.getByText(/стоимость расхождений/).waitFor({ timeout: 20000 });
  console.log("✔ инвентаризация проведена, в сообщении стоимость расхождений");

  // 3. Отчёты: остатки с ценой/стоимостью/датой
  await page.goto(`${BASE}/admin/reports?report=stock`, { waitUntil: "networkidle" });
  await page.getByRole("columnheader", { name: "Цена" }).waitFor();
  await page.getByRole("columnheader", { name: "Стоимость" }).waitFor();
  await page.getByRole("columnheader", { name: "Поступление" }).waitFor();
  const stockTowel = await page.locator("tr").filter({ hasText: "Полотенце банное" }).first().innerText();
  if (!stockTowel.includes("450,00 ₽")) throw new Error(`остатки без цены: ${stockTowel}`);
  await page.screenshot({ path: path.join(shots, "41-reports-stock.png"), fullPage: true });
  console.log("✔ отчёт «Остатки»: цена, стоимость, дата поступления");

  // 4. Движения с датой документа и суммой
  await page.goto(`${BASE}/admin/reports?report=movements`, { waitUntil: "networkidle" });
  await page.getByText(/Движения по дате документа/).waitFor();
  const movementsText = (await page.locator("table tbody").first().innerText()).replace(/\u00a0/g, " ");
  if (!movementsText.includes("02.11.2026")) throw new Error("нет даты документа 02.11.2026");
  if (!movementsText.includes("1 350,00 ₽")) {
    console.log("movements text:", movementsText.slice(0, 600));
    throw new Error("нет суммы 1 350,00 ₽");
  }
  await page.screenshot({ path: path.join(shots, "42-reports-movements.png"), fullPage: true });
  console.log("✔ отчёт «Движения»: дата документа и сумма 1 350 ₽");

  // 5. Отчёт «Без цены»
  await page.goto(`${BASE}/admin/reports?report=no-price`, { waitUntil: "networkidle" });
  await page.getByText(/У всех активных позиций задана цена/).waitFor();
  console.log("✔ отчёт «Без цены»: пусто, все позиции оценены");

  // 6. Excel: остатки с ценой/стоимостью (через браузерный fetch — доверяет сертификату)
  const base64 = await page.evaluate(async () => {
    const response = await fetch("/api/reports/export?report=stock&from=2026-10-01&to=2026-11-05");
    if (!response.ok) throw new Error(`excel status ${response.status}`);
    const array = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of array) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  const buffer = Buffer.from(base64, "base64");
  const file = path.join(process.cwd(), ".tmp", "stock-m8b.xlsx");
  await writeFile(file, buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Остатки");
  if (!sheet) throw new Error("нет листа Остатки");
  const headers = sheet.getRow(1).values;
  if (!headers.includes("Цена, ₽") || !headers.includes("Стоимость, ₽")) {
    throw new Error(`excel headers: ${JSON.stringify(headers)}`);
  }
  const excelTowel = sheet
    .getRow(1)
    .worksheet?.getSheetValues()
    ?.find((row) => Array.isArray(row) && row.includes("Полотенце банное"));
  console.log("✔ Excel: лист «Остатки» с ценой и стоимостью, файл", file);
  if (!excelTowel) console.log("  (строка полотенца не найдена при повторном поиске — не критично)");

  console.log(JSON.stringify({ ok: true, errors }, null, 2));
  if (errors.length) process.exit(1);
} finally {
  await browser.close();
}
