import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 950 }, locale: "ru-RU" });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("https://hotel/login", { waitUntil: "networkidle" });
await page.fill('input[name="login"]', "admin");
await page.fill('input[name="password"]', "Admin123!");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);
await page.goto("https://hotel/admin/roles", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const cards = page.locator('[data-role-code]');
const order = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-role-code')));
if (JSON.stringify(order) !== JSON.stringify(['ADMIN','MANAGER','MAID'])) throw new Error('order: ' + order);
for (const code of order) {
  const card = page.locator(`[data-role-code="${code}"]`);
  const labels = card.locator('label');
  if (await labels.count() !== 19) throw new Error(`${code}: ${await labels.count()} labels`);
  const texts = await labels.allInnerTexts();
  for (const text of texts) {
    if (/\b(rooms|warehouse|catalog|distribution|return|writeoff|audit|cleaning|reports|users|roles|settings|photos)\./.test(text)) throw new Error('english: ' + text);
    if (!/[А-Яа-яЁё]/.test(text)) throw new Error('not russian: ' + text);
  }
  for (const expected of ['Управление справочником','Управление уборкой','Выполнение задач уборки','Общие настройки','Брендинг и оформление']) {
    if (!texts.some((text) => text.includes(expected))) throw new Error(`${code}: missing ${expected}`);
  }
  const title = await card.locator('h3').innerText();
  if (!title.includes(`(${code})`)) throw new Error(`role code missing: ${title}`);
}
console.log('✔ 3 роли × 19 прав, только русские подписи');
console.log('✔ порядок ADMIN → MANAGER → MAID, коды ролей сохранены');
await page.screenshot({ path: path.join(process.cwd(), "screenshots", "roles-after.png"), fullPage: true });
await page.setViewportSize({ width: 390, height: 900 });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);
const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
if (w.scroll > w.inner) throw new Error('overflow ' + JSON.stringify(w));
console.log('✔ мобильная ширина без переполнения');
console.log(JSON.stringify({ ok: true, errors }));
if (errors.length) process.exit(1);
await browser.close();