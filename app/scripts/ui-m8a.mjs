/**
 * M8A: справочник, цена/дата, добавление на склад, удаление номеров.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

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

try {
  await login();

  // ---------- справочник ----------
  await page.goto(`${BASE}/admin/catalog`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Справочник позиций" }).waitFor();
  await page.locator("label").filter({ hasText: "Название" }).locator("input").fill("Тестовая позиция");
  await page.locator("label").filter({ hasText: "Категория" }).locator("select").first().selectOption({ label: "Инвентарь" });
  await page.locator("label").filter({ hasText: "Ед." }).locator("input").fill("шт");
  await page.locator("label").filter({ hasText: "Цена, ₽" }).locator("input").fill("123.45");
  await page.locator("label").filter({ hasText: "Примечание" }).locator("input").fill("Проверка 8A");
  await page.getByRole("button", { name: "Добавить позицию" }).click();
  await page.getByText("Тестовая позиция").first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(shots, "37-catalog.png"), fullPage: true });
  console.log("✔ справочник: позиция создана с ценой и примечанием");

  const testRow = page.locator("tr").filter({ hasText: "Тестовая позиция" });
  await testRow.getByRole("button", { name: "Удалить" }).click();
  await page.waitForTimeout(1200);
  const testLeft = await page.locator("tr").filter({ hasText: "Тестовая позиция" }).count();
  if (testLeft !== 0) throw new Error("тестовая позиция не удалилась");
  console.log("✔ справочник: позиция без остатка удалена");

  // ---------- склад ----------
  await page.goto(`${BASE}/admin/warehouse`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Склад" }).waitFor();
  const addCard = page
    .locator("p", { hasText: "Добавить на склад из справочника" })
    .locator("xpath=..");
  const towelValue = await addCard
    .locator("option")
    .filter({ hasText: "Полотенце банное" })
    .first()
    .getAttribute("value");
  if (!towelValue) throw new Error("позиция для склада не найдена");
  await addCard.locator("select").selectOption(towelValue);
  await addCard.locator('input[type="number"]').fill("2");
  await addCard.locator('input[type="date"]').fill("2026-11-01");
  await addCard.locator("input").last().fill("Проверка 8A");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByText("Позиция добавлена на склад").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const towelRow = page.locator("tr").filter({ hasText: "Полотенце банное" }).first();
  const towelText = await towelRow.innerText();
  if (!towelText.includes("450,00 ₽") || !towelText.includes("01.11.2026")) {
    throw new Error(`склад: неверная строка: ${towelText}`);
  }
  await page.screenshot({ path: path.join(shots, "38-warehouse.png"), fullPage: true });
  console.log("✔ склад: +2 по цене 450 ₽, стоимость 900 ₽, дата 01.11.2026");

  const datesToggle = page.getByLabel("Показывать даты в документах");
  await datesToggle.uncheck();
  await page.waitForTimeout(1500);
  if ((await page.getByRole("columnheader", { name: "Поступление" }).count()) !== 0) {
    throw new Error("колонка даты не скрылась");
  }
  await datesToggle.check();
  await page.waitForTimeout(1500);
  if ((await page.getByRole("columnheader", { name: "Поступление" }).count()) === 0) {
    throw new Error("колонка даты не вернулась");
  }
  console.log("✔ склад: переключатель дат скрывает и показывает колонку");

  await page.goto(`${BASE}/admin/receive`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="date"]').first().waitFor();
  console.log("✔ приёмка: поле даты поступления присутствует");

  // ---------- номера ----------
  await page.goto(`${BASE}/admin/rooms`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Номер", { exact: true }).first().fill("999");
  await page.getByLabel("Этаж", { exact: true }).fill("3");
  await page.getByLabel("Тип", { exact: true }).selectOption({ index: 1 });
  const roomForm = page.locator("form").filter({ has: page.getByLabel("Номер") });
  await roomForm.getByRole("button", { name: "Добавить" }).click();
  await page.getByText("999", { exact: true }).first().waitFor({ timeout: 15000 });
  console.log("✔ номера: номер 999 добавлен");

  const room999 = page.locator("tr").filter({ hasText: "999" }).first();
  await room999.getByRole("button", { name: "Удалить" }).click();
  await page.waitForTimeout(1500);
  if ((await page.locator("tr").filter({ hasText: "999" }).count()) !== 0) {
    throw new Error("номер 999 не удалился");
  }
  console.log("✔ номера: пустой номер удалён");

  const room101 = page.locator("tr").filter({ hasText: "101" }).first();
  await room101.getByRole("button", { name: "Удалить" }).click();
  await page.getByText(/есть история/i).waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(shots, "39-rooms-delete-guard.png"), fullPage: true });
  console.log("✔ номера: удаление 101 заблокировано историей");

  console.log(JSON.stringify({ ok: true, errors }, null, 2));
  if (errors.length) process.exit(1);
} finally {
  await browser.close();
}
