/**
 * Брендинг: загрузка прозрачного PNG (2000×1000 → 1600×800),
 * отображение на логине/в админке, права, Excel с логотипом и подписями, удаление.
 */
import path from "node:path";
import ExcelJS from "exceljs";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium } = await import("playwright");

const BASE = "https://hotel";
const LOGO = path.join(process.cwd(), ".tmp", "logo-test.png");
const errors = [];

async function login(page, login, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', login);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle");
}

const browser = await chromium.launch();
const adminContext = await browser.newContext({ viewport: { width: 1366, height: 950 }, locale: "ru-RU" });
const admin = await adminContext.newPage();
admin.on("pageerror", (e) => errors.push(`admin: ${e.message}`));
admin.on("dialog", (dialog) => dialog.accept());

try {
  await login(admin, "admin", "Admin123!");
  await admin.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  await admin.getByRole("heading", { name: "Настройки" }).waitFor();

  // загрузка большого прозрачного PNG
  await admin.locator('input[type="file"]').setInputFiles(LOGO);
  await admin.getByText(/Логотип сохранён: 1600×800 px/).waitFor({ timeout: 30000 });
  await admin.getByText("Текущий размер: 1600×800 px").waitFor();
  console.log("✔ загрузка: 2000×1000 → 1600×800, PNG");

  // прозрачность: color type 6 (RGBA)
  const colorType = await admin.evaluate(async () => {
    const response = await fetch("/api/branding/logo");
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { ok: response.ok, colorType: bytes[25] };
  });
  if (!colorType.ok || colorType.colorType !== 6) {
    throw new Error(`PNG без альфа-канала: ${JSON.stringify(colorType)}`);
  }
  console.log("✔ прозрачность сохранена (PNG color type 6)");

  // реквизиты
  await admin.locator("label").filter({ hasText: "Название отеля" }).locator("input").fill("Отель Тест");
  await admin.locator("label").filter({ hasText: "Ответственный: ФИО" }).locator("input").fill("Петров П.П.");
  await admin.locator("label").filter({ hasText: "Ответственный: должность" }).locator("input").fill("Главный менеджер");
  await admin.getByRole("button", { name: "Сохранить реквизиты" }).click();
  await admin.getByText("Реквизиты сохранены").waitFor({ timeout: 20000 });
  console.log("✔ реквизиты сохранены");

  // логотип в админке
  if ((await admin.locator('aside img[alt="Логотип отеля"]').count()) === 0) {
    throw new Error("логотип не появился в сайдбаре");
  }

  // логин без сессии
  const anonContext = await browser.newContext({ viewport: { width: 800, height: 900 }, locale: "ru-RU" });
  const anon = await anonContext.newPage();
  await anon.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await anon.getByRole("heading", { name: "Отель Тест" }).waitFor();
  await anon.getByAltText("Логотип отеля").waitFor();
  await anon.screenshot({ path: path.join(process.cwd(), "screenshots", "branding-login.png"), fullPage: true });
  console.log("✔ логотип и название на странице входа");
  await anonContext.close();

  // права менеджера
  const managerContext = await browser.newContext({ viewport: { width: 1366, height: 950 }, locale: "ru-RU" });
  const manager = await managerContext.newPage();
  await login(manager, "manager", "Manager123!");
  await manager.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  if ((await manager.getByText("Логотип и печатные реквизиты").count()) !== 0) {
    throw new Error("менеджер видит блок логотипа");
  }
  const forbidden = await manager.evaluate(async () => {
    const response = await fetch("/api/admin/branding/logo", { method: "POST", body: new FormData() });
    return response.status;
  });
  if (forbidden !== 403) throw new Error(`менеджеру не 403, а ${forbidden}`);
  console.log("✔ менеджер: блок скрыт, загрузка → 403");
  await managerContext.close();

  // Excel с логотипом и подписями
  const base64 = await admin.evaluate(async () => {
    const response = await fetch("/api/reports/export?report=stock&from=2026-10-01&to=2026-11-05");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  const buffer = Buffer.from(base64, "base64");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Остатки");
  if (!sheet) throw new Error("нет листа Остатки");
  const values = [];
  sheet.eachRow((row) => row.eachCell((cell) => values.push(String(cell.value ?? ""))));
  if (!values.includes("Отель Тест")) throw new Error("в Excel нет названия отеля");
  if (!values.includes("Остатки склада")) throw new Error("в Excel нет заголовка");
  if (!values.some((value) => value.includes("Составил: Администратор системы"))) {
    throw new Error("в Excel нет «Составил»");
  }
  if (!values.includes("Петров П.П.")) throw new Error("в Excel нет ответственного");
  if (!values.includes("Главный менеджер")) throw new Error("в Excel нет должности");
  if ((workbook.media?.length ?? 0) === 0) throw new Error("в Excel нет изображения логотипа");
  console.log("✔ Excel: логотип, дата, составил, ответственный, подпись");
  await admin.screenshot({ path: path.join(process.cwd(), "screenshots", "branding-settings.png"), fullPage: true });

  // удаление логотипа
  await admin.getByRole("button", { name: "Удалить", exact: true }).click();
  await admin.getByText("Логотип удалён").waitFor({ timeout: 20000 });
  const afterContext = await browser.newContext({ viewport: { width: 800, height: 900 }, locale: "ru-RU" });
  const after = await afterContext.newPage();
  await after.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if ((await after.locator('img[alt="Логотип отеля"]').count()) !== 0) {
    throw new Error("логотип остался на логине");
  }
  await afterContext.close();
  console.log("✔ удаление: логотип убран с логина");

  console.log(JSON.stringify({ ok: true, errors }));
  if (errors.length) process.exit(1);
} finally {
  await adminContext.close();
  await browser.close();
}
