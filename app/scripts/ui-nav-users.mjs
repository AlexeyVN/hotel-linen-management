/**
 * Проверка: группы меню, цвет темы, пользователи (ФИО/логин), мобильная ширина.
 */
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium } = await import("playwright");

const BASE = "https://hotel";
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
const context = await browser.newContext({ viewport: { width: 1366, height: 950 }, locale: "ru-RU" });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (dialog) => dialog.accept());

try {
  await login(page, "admin", "Admin123!");

  // группы меню
  await page.locator("nav button").first().waitFor({ timeout: 20000 });
  const groupButtons = await page.locator("nav button").allInnerTexts();
  for (const expected of ["Склад", "Документы", "Уборка"]) {
    if (!groupButtons.some((text) => text.includes(expected))) {
      throw new Error(`нет группы ${expected}: ${groupButtons.join(", ")}`);
    }
  }
  await page.getByRole("button", { name: "Склад" }).click();
  await page.getByRole("link", { name: "Справочник" }).waitFor();
  await page.getByRole("link", { name: "Склад", exact: true }).waitFor();
  await page.getByRole("button", { name: "Документы" }).click();
  for (const label of ["Приёмка", "Раздача", "Возврат", "Списание", "Инвентаризация", "QR-коды"]) {
    await page.getByRole("link", { name: label, exact: true }).waitFor();
  }
  console.log("✔ группы «Склад» и «Документы», порядок документов");

  // настройки: группы 1С/Пользователи/Роли и загрузка логотипа
  await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
  await page.getByText("Оформление: логотип, цвет, реквизиты").waitFor();
  await page.getByRole("button", { name: /Загрузить логотип|Заменить логотип/ }).waitFor();
  await page.getByRole("link", { name: "1С", exact: true }).waitFor();
  await page.getByRole("link", { name: "Пользователи", exact: true }).waitFor();
  await page.getByRole("link", { name: "Роли", exact: true }).waitFor();
  console.log("✔ настройки: логотип, 1С, пользователи, роли");

  // цвет: пресет
  await page.getByRole("button", { name: "Цвет: Бирюзовый" }).click();
  await page.getByRole("button", { name: "Применить цвет" }).click();
  await page.getByText("Цвет интерфейса сохранён").waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  const primary = await page.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue("--primary").trim(),
  );
  if (primary !== "175 77% 26%") throw new Error(`--primary = ${primary}`);
  console.log("✔ цвет из палитры применён: " + primary);

  // цвет виден на логине
  const anonContext = await browser.newContext({ viewport: { width: 800, height: 900 } });
  const anon = await anonContext.newPage();
  await anon.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const loginPrimary = await anon.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue("--primary").trim(),
  );
  if (loginPrimary !== "175 77% 26%") throw new Error(`логин --primary = ${loginPrimary}`);
  await anon.screenshot({ path: path.join(process.cwd(), "screenshots", "accent-login.png"), fullPage: true });
  await anonContext.close();
  console.log("✔ цвет применён на странице входа");

  // слишком светлый цвет
  await page.getByRole("textbox", { name: "HEX цвета" }).fill("#ffff00");
  await page.getByRole("button", { name: "Применить цвет" }).click();
  await page.getByText(/слишком светлый для белого текста/).waitFor({ timeout: 20000 });
  console.log("✔ светлый цвет отклонён");

  // вернуть синий
  await page.getByRole("button", { name: "Цвет: Синий" }).click();
  await page.getByRole("button", { name: "Применить цвет" }).click();
  await page.getByText("Цвет интерфейса сохранён").waitFor({ timeout: 20000 });

  // пользователи: переименование списка и редактирование
  await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
  await page.getByText("Пользователи (3)").waitFor();
  const original = "Менеджер службы";
  let row = page.locator('[data-login="manager"]');
  await row.getByRole("button", { name: "Изменить ФИО / логин" }).click();
  let inputs = row.locator("input");
  await inputs.nth(0).fill("Менеджер службы (тест)");
  await inputs.nth(1).fill("manager");
  await row.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByText("Данные пользователя обновлены").waitFor({ timeout: 20000 });
  await page.getByText("Менеджер службы (тест)", { exact: true }).waitFor();
  console.log("✔ ФИО изменено");

  row = page.locator('[data-login="manager"]');
  await row.getByRole("button", { name: "Изменить ФИО / логин" }).click();
  inputs = row.locator("input");
  await inputs.nth(1).fill("admin");
  await row.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByText("Пользователь с таким логином уже есть").waitFor({ timeout: 20000 });
  console.log("✔ занятый логин отклонён");

  await inputs.nth(0).fill(original);
  await inputs.nth(1).fill("manager");
  await row.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByText("Данные пользователя обновлены").waitFor({ timeout: 20000 });
  await page.getByText(original, { exact: true }).waitFor();
  console.log("✔ исходные ФИО и логин восстановлены");

  // мобильная ширина
  await page.setViewportSize({ width: 390, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  if (widths.scroll > widths.inner) throw new Error(`горизонтальное переполнение: ${JSON.stringify(widths)}`);
  console.log("✔ мобильная ширина без переполнения");
  await page.screenshot({ path: path.join(process.cwd(), "screenshots", "nav-mobile.png"), fullPage: true });

  console.log(JSON.stringify({ ok: true, errors }));
  if (errors.length) process.exit(1);
} finally {
  await context.close();
  await browser.close();
}
