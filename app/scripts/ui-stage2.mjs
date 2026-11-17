/**
 * Проверка этапа 2: декодирование QR, UI генерации/печати, сканер, Excel-скачивание.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium } = await import("playwright");
const QRCode = (await import("qrcode")).default;
const jsQR = (await import("jsqr")).default;
const ExcelJS = (await import("exceljs")).default;

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
  // ---------- 1. QR: генерация → растеризация → декодирование jsQR ----------
  const payloadText = "HOTEL:ROOM:101";
  const dataUrl = await QRCode.toDataURL(payloadText, { width: 320, margin: 1 });
  const decodePage = await browser.newPage();
  await decodePage.setContent(
    `<img id="qr" src="${dataUrl}" width="320" height="320" />`,
    { waitUntil: "load" },
  );
  const pixels = await decodePage.evaluate(async () => {
    const image = document.getElementById("qr");
    await (image.decode ? image.decode() : Promise.resolve());
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    return { data: Array.from(data.data), width: data.width, height: data.height };
  });
  const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
  if (decoded?.data !== payloadText) {
    throw new Error(`jsQR декодировал '${decoded?.data}', ожидалось '${payloadText}'`);
  }
  await decodePage.close();
  console.log("✔ QR: изображение декодируется jsQR обратно в payload");

  // ---------- 2. Админка: генерация и печать ----------
  const adminContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ru-RU" });
  const admin = await adminContext.newPage();
  admin.on("pageerror", (error) => pageErrors.push(`admin: ${error.message}`));
  await login(admin, "admin", "Admin123!");

  await admin.goto(`${BASE}/admin/qr`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: "QR-коды" }).waitFor();
  await admin.waitForFunction(
    () => document.querySelectorAll("select")[1]?.options.length > 1,
    null,
    { timeout: 15000 },
  );
  await admin.locator("select").nth(1).selectOption({ index: 1 });
  await admin.getByRole("button", { name: "Сгенерировать" }).click();
  await admin.locator('img[alt="QR-код"]').waitFor({ timeout: 15000 });
  const payloadShown = await admin.locator("code").first().textContent();
  await admin.screenshot({ path: path.join(shots, "17-admin-qr-generate.png"), fullPage: true });
  console.log("✔ UI: генерация QR в админке", payloadShown?.slice(0, 40));

  await admin.goto(`${BASE}/admin/qr/print?type=room&payload=url`, { waitUntil: "domcontentloaded" });
  await admin.getByRole("heading", { name: /Метки QR/ }).waitFor();
  const labelCount = await admin.locator(".qr-label").count();
  if (labelCount < 5) throw new Error(`лист меток пуст: ${labelCount}`);
  await admin.screenshot({ path: path.join(shots, "18-admin-qr-print.png"), fullPage: true });
  console.log(`✔ UI: лист печати, меток ${labelCount}`);

  // ---------- 3. Excel: скачивание из отчёта ----------
  await admin.goto(`${BASE}/admin/reports?report=movements&from=2026-10-01&to=2026-12-31`, {
    waitUntil: "domcontentloaded",
  });
  await admin.getByRole("link", { name: "Скачать Excel" }).waitFor();
  const exportHref = await admin.getByRole("link", { name: "Скачать Excel" }).getAttribute("href");
  if (!exportHref) throw new Error("ссылка Excel не найдена");
  const exportResponse = await admin.request.get(new URL(exportHref, BASE).toString());
  if (!exportResponse.ok()) {
    throw new Error(`Excel не скачался: HTTP ${exportResponse.status()}`);
  }
  const xlsxPath = path.join(process.cwd(), ".tmp", "ui-download.xlsx");
  await writeFile(xlsxPath, Buffer.from(await exportResponse.body()));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new Error(`Excel пуст: листов ${workbook.worksheets.length}, строк ${sheet?.rowCount}`);
  }
  console.log(`✔ UI: Excel скачан и открыт (${sheet.name}, строк ${sheet.rowCount})`);
  await admin.screenshot({ path: path.join(shots, "19-admin-reports-excel.png"), fullPage: true });

  // ---------- 4. Телефон: сканер, ручной ввод в трёх форматах ----------
  const mobileContext = await browser.newContext({
    ...(await import("playwright")).devices["iPhone 13"],
    locale: "ru-RU",
  });
  const maid = await mobileContext.newPage();
  maid.on("pageerror", (error) => pageErrors.push(`maid: ${error.message}`));
  await login(maid, "maid", "Maid123!");
  await maid.goto(`${BASE}/m/scan`, { waitUntil: "domcontentloaded" });
  await maid.getByRole("heading", { name: "Сканировать QR" }).waitFor();

  const formats = ["101", "HOTEL:ROOM:101", '{"v":1,"type":"room","code":"101"}'];
  for (const payload of formats) {
    await maid.locator('input[placeholder*="101"]').fill(payload);
    await maid.getByRole("button", { name: "Проверить код" }).click();
    await maid.getByText(/Номер 101/).first().waitFor({ timeout: 15000 });
  }
  await maid.screenshot({ path: path.join(shots, "20-mobile-qr-scan.png"), fullPage: true });
  console.log("✔ UI: сканер принимает голый код, текст и JSON");

  await adminContext.close();
  await mobileContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, pageErrors, screenshots: shots }, null, 2));
if (pageErrors.length > 0) process.exit(1);
