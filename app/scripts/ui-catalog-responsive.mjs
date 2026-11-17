import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(process.cwd(), ".playwright-browsers");
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const results = [];
for (const width of [1440, 1280, 1024, 768, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 950 } });
  await page.goto("https://hotel/login", { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', "admin");
  await page.fill('input[name="password"]', "Admin123!");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);
  await page.goto("https://hotel/admin/catalog", { waitUntil: "networkidle" });
  const data = await page.evaluate(() => {
    const table = document.querySelector("table");
    const wrap = table?.parentElement;
    const headers = [...table.querySelectorAll("thead th")].map((th) => ({
      text: th.textContent.trim(),
      hidden: th.offsetParent === null,
      width: Math.round(th.getBoundingClientRect().width),
      left: Math.round(th.getBoundingClientRect().left),
      right: Math.round(th.getBoundingClientRect().right),
    }));
    const visibleHeaders = headers.filter((h) => !h.hidden);
    let overlap = false;
    for (let i = 0; i < visibleHeaders.length - 1; i++) {
      if (visibleHeaders[i].right > visibleHeaders[i + 1].left + 1) overlap = true;
    }
    const firstRow = table.querySelector("tbody tr");
    const cells = firstRow ? [...firstRow.querySelectorAll("td")].map((td) => Math.round(td.getBoundingClientRect().width)) : [];
    const mobileNote = firstRow?.querySelector("td span.md\\:hidden");
    return {
      viewport: window.innerWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      tableWidth: Math.round(table.getBoundingClientRect().width),
      wrapClientWidth: wrap ? wrap.clientWidth : null,
      wrapScrollWidth: wrap ? wrap.scrollWidth : null,
      wrapOverflowX: wrap ? getComputedStyle(wrap).overflowX : null,
      fontSize: getComputedStyle(table).fontSize,
      headers,
      overlap,
      cells,
      mobileNoteVisible: mobileNote ? getComputedStyle(mobileNote).display !== "none" : false,
    };
  });
  if (width === 1024) {
    await page.getByRole("button", { name: /Изменить позицию/ }).first().click();
    const inputs = await page.locator('table input[aria-label="Цена, рубли"]').count();
    const selects = await page.locator('table select[aria-label="Категория"]').count();
    if (inputs === 0 || selects === 0) throw new Error("режим редактирования не открылся");
    await page.getByRole("button", { name: /Отменить редактирование/ }).first().click();
  }
  if (width === 1440 || width === 1024 || width === 390) {
    await page.screenshot({ path: path.join(process.cwd(), "screenshots", `catalog-${width}.png`), fullPage: true });
  }
  results.push({ width, ...data });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
for (const result of results) {
  if (result.pageScrollWidth > result.viewport + 1) throw new Error(`page overflow at ${result.width}: ${result.pageScrollWidth}`);
  if (result.overlap) throw new Error(`header overlap at ${result.width}`);
  if (result.wrapOverflowX !== "auto" && result.wrapOverflowX !== "scroll") throw new Error(`no scroll container at ${result.width}`);
}
if (!results.find((r) => r.width === 390)?.mobileNoteVisible) throw new Error("mobile note not visible");
console.log("ALL WIDTH CHECKS PASSED");