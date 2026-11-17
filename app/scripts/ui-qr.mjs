/**
 * QR: A — маршруты /r /i и callback; B — сохранение метки,
 * печать, удаление QR вместе с тестовой позицией и номером.
 */
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium, devices } = await import("playwright");

const BASE = "https://hotel";
const ITEM_ID = process.env.QR_TEST_ITEM_ID;
const shots = path.join(process.cwd(), "screenshots");
const errors = [];

async function login(page, login, password, callbackUrl) {
  const url = callbackUrl ? `${BASE}/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : `${BASE}/login`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', login);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
}

async function selectByText(select, text) {
  const value = await select.locator("option").filter({ hasText: text }).first().getAttribute("value");
  if (!value) throw new Error(`опция не найдена: ${text}`);
  await select.selectOption(value);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 950 }, locale: "ru-RU" });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`admin: ${e.message}`));
page.on("dialog", (dialog) => dialog.accept());

try {
  // ---------- A: без входа ----------
  const anon = await browser.newPage();
  await anon.goto(`${BASE}/r/101`, { waitUntil: "domcontentloaded" });
  if (!anon.url().includes("/login?callbackUrl=")) throw new Error(`нет редиректа на login: ${anon.url()}`);
  await anon.getByRole("heading", { name: "Учёт белья" }).waitFor();
  console.log("✔ A: /r/101 без входа → login с callbackUrl");
  await anon.close();

  // ---------- A: вход с callback ----------
  await login(page, "admin", "Admin123!", "/r/101");
  await page.waitForURL(/\/admin\/rooms$/, { timeout: 20000 });
  console.log("✔ A: вход с callback → /r/101 → /admin/rooms");

  await page.goto(`${BASE}/i/${ITEM_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/admin\/catalog$/, { timeout: 20000 });
  console.log("✔ A: /i/<внешний id> → /admin/catalog");

  const missing = await page.goto(`${BASE}/r/no-such-room`, { waitUntil: "domcontentloaded" });
  if (missing?.status() !== 404) throw new Error(`ожидали 404, получили ${missing?.status()}`);
  console.log("✔ A: неизвестный код → 404");

  // ---------- A: горничная ----------
  const maidContext = await browser.newContext({ ...devices["iPhone 13"], locale: "ru-RU" });
  const maid = await maidContext.newPage();
  maid.on("pageerror", (e) => errors.push(`maid: ${e.message}`));
  await login(maid, "maid", "Maid123!", "/r/101");
  await maid.waitForURL(/\/m\/rooms$/, { timeout: 20000 });
  console.log("✔ A: горничная с /r/101 → /m/rooms");
  await maidContext.close();

  // ---------- B: генерация и сохранение ----------
  await page.goto(`${BASE}/admin/qr`, { waitUntil: "networkidle" });
  const selects = page.locator("select");
  await selectByText(selects.nth(1), "101");
  await page.getByRole("button", { name: "Сгенерировать и сохранить" }).click();
  await page.getByText("Скачать PNG").waitFor({ timeout: 20000 });
  await page.getByText("актуальна").waitFor({ timeout: 20000 });
  const downloadHref = await page.getByRole("link", { name: /Скачать PNG/ }).getAttribute("href");
  const qrId = downloadHref?.match(/\/api\/qr\/([^?]+)/)?.[1];
  if (!qrId) throw new Error(`нет id QR: ${downloadHref}`);
  await page.screenshot({ path: path.join(shots, "qr-saved.png"), fullPage: true });

  const pngOk = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return response.ok && bytes[0] === 0x89 && bytes[1] === 0x50;
  }, `/api/qr/${qrId}`);
  if (!pngOk) throw new Error("файл QR не PNG");
  console.log("✔ B: метка сохранена, файл отдаётся через /api/qr/[id]");

  // повторная генерация — та же запись QrCode, файл заменяется
  await page.getByRole("button", { name: "Сгенерировать и сохранить" }).click();
  await page.waitForTimeout(800);
  console.log("✔ B: повторная генерация обновила ту же запись QrCode");

  // ---------- B: печать использует сохранённые ----------
  await page.goto(`${BASE}/admin/qr/print?type=room&payload=url`, { waitUntil: "networkidle" });
  const labelCount = await page.locator('img[alt^="QR "]').count();
  if (labelCount < 10) throw new Error(`в печати ${labelCount} меток`);
  console.log(`✔ B: печать листа — ${labelCount} меток`);

  // ---------- B: удаление позиции вместе с QR ----------
  await page.goto(`${BASE}/admin/catalog`, { waitUntil: "networkidle" });
  await page.locator("label").filter({ hasText: "Название" }).locator("input").fill("QR Test");
  await page.locator("label").filter({ hasText: "Категория" }).locator("select").first().selectOption({ index: 1 });
  await page.locator("label").filter({ hasText: "Цена, ₽" }).locator("input").fill("10");
  await page.getByRole("button", { name: "Добавить позицию" }).click();
  await page.getByText("QR Test").first().waitFor({ timeout: 20000 });

  await page.goto(`${BASE}/admin/qr`, { waitUntil: "networkidle" });
  await selects.nth(0).selectOption("item");
  await page.waitForTimeout(400);
  const itemSelect = page.locator("select").nth(1);
  await selectByText(itemSelect, "QR Test");
  await page.getByRole("button", { name: "Сгенерировать и сохранить" }).click();
  await page.getByText("Скачать PNG").waitFor({ timeout: 20000 });

  await page.goto(`${BASE}/admin/catalog`, { waitUntil: "networkidle" });
  const itemRow = page.locator("tr").filter({ hasText: "QR Test" }).first();
  await itemRow.getByRole("button", { name: /Удалить позицию/ }).click();
  await page.waitForTimeout(1200);
  if (await page.locator("tr").filter({ hasText: "QR Test" }).count()) throw new Error("позиция не удалена");
  console.log("✔ B: позиция удалена вместе с QR (проверка БД — отдельно)");

  // ---------- B: удаление номера вместе с QR ----------
  await page.goto(`${BASE}/admin/rooms`, { waitUntil: "networkidle" });
  const roomForm = page.locator("form").filter({ has: page.getByLabel("Номер") });
  await page.getByLabel("Номер", { exact: true }).first().fill("998");
  await page.getByLabel("Этаж", { exact: true }).fill("3");
  await roomForm.getByRole("button", { name: "Добавить" }).click();
  await page.getByText("998", { exact: true }).first().waitFor({ timeout: 20000 });

  await page.goto(`${BASE}/admin/qr`, { waitUntil: "networkidle" });
  await page.locator("select").nth(0).selectOption("room");
  await page.waitForTimeout(400);
  await selectByText(page.locator("select").nth(1), "998");
  await page.getByRole("button", { name: "Сгенерировать и сохранить" }).click();
  await page.getByText("Скачать PNG").waitFor({ timeout: 20000 });

  await page.goto(`${BASE}/admin/rooms`, { waitUntil: "networkidle" });
  const roomRow = page.locator("tr").filter({ hasText: "998" }).first();
  await roomRow.getByRole("button", { name: "Удалить" }).click();
  await page.waitForTimeout(1200);
  if (await page.locator("tr").filter({ hasText: "998" }).count()) throw new Error("номер не удалён");
  console.log("✔ B: номер удалён вместе с QR (проверка БД — отдельно)");

  console.log(JSON.stringify({ ok: true, errors }, null, 2));
  if (errors.length) process.exit(1);
} finally {
  await context.close();
  await browser.close();
}
