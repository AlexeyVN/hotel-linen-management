import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  MAID_TASK_HEADERS,
  MOVEMENTS_HEADERS,
  STOCK_HEADERS,
  TASK_HEADERS,
  buildWorkbook,
  lowStockRows,
  maidTaskRows,
  movementsRows,
  noPriceRows,
  stockRows,
  taskRows,
} from "../src/server/reports/excel";

test("строки остатков сохраняют порядок колонок", () => {
  const rows = stockRows([
    {
      name: "Полотенце",
      categoryName: "Бельё",
      unit: "шт",
      qty: 12,
      priceKopecks: 45000,
      lastReceiptAt: new Date("2026-11-01T10:00:00Z"),
    },
  ]);
  assert.deepEqual(rows, [["Полотенце", "Бельё", "шт", 12, 450, 5400, "01.11.2026"]]);
});

test("движения разворачиваются по строкам позиций", () => {
  const rows = movementsRows([
    {
      documentDate: new Date("2026-11-05T10:00:00Z"),
      type: "AUDIT",
      roomNumber: "101",
      reason: null,
      userFullName: "Администратор",
      items: [
        { name: "Наволочка", unit: "шт", qty: 3, delta: -1, priceKopecks: 30000 },
        { name: "Халат", unit: "шт", qty: 2, delta: 2, priceKopecks: 120000 },
      ],
    },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][1], "Инвентаризация");
  assert.equal(rows[0][3], "Наволочка");
  assert.equal(rows[0][5], 300);
  assert.equal(rows[0][7], -1);
  assert.equal(rows[1][3], "Халат");
});

test("дефицит считается в строках отчёта", () => {
  const rows = lowStockRows([
    {
      roomNumber: "101",
      itemName: "Полотенце",
      unit: "шт",
      have: 1,
      min: 2,
      missing: 1,
      priceKopecks: 45000,
    },
  ]);
  assert.deepEqual(rows, [["101", "Полотенце", "шт", 1, 2, 1, 450, 450]]);
});

test("позиции без цены выгружаются отдельным списком", () => {
  const rows = noPriceRows([
    { name: "Фен", categoryName: "Инвентарь", unit: "шт", qty: 10 },
  ]);
  assert.deepEqual(rows, [["Фен", "Инвентарь", "шт", 10]]);
});

test("книга Excel открывается обратно и содержит заголовки и данные", async () => {
  const rows = stockRows([
    {
      name: "Комплект белья",
      categoryName: "Бельё",
      unit: "компл",
      qty: 60,
      priceKopecks: 185000,
      lastReceiptAt: null,
    },
    {
      name: "Дезинфектор",
      categoryName: "Химия",
      unit: "л",
      qty: 11,
      priceKopecks: 90000,
      lastReceiptAt: null,
    },
  ]);
  const buffer = await buildWorkbook("Остатки", STOCK_HEADERS, rows);
  assert.ok(buffer.length > 1000);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Остатки");
  assert.ok(sheet);
  assert.equal(sheet.rowCount, 3);
  assert.equal(sheet.getRow(1).getCell(1).value, "Позиция");
  assert.equal(sheet.getRow(2).getCell(1).value, "Комплект белья");
  assert.equal(sheet.getRow(3).getCell(4).value, 11);
  assert.equal(sheet.getRow(2).getCell(6).value, 111000);
});

test("лист движений использует свои заголовки", async () => {
  const rows = movementsRows([
    {
      documentDate: new Date("2026-11-05T10:00:00Z"),
      type: "RECEIVE",
      roomNumber: null,
      reason: null,
      userFullName: "Администратор",
      items: [{ name: "Халат", unit: "шт", qty: 5, delta: null, priceKopecks: 120000 }],
    },
  ]);
  const buffer = await buildWorkbook("Движения", MOVEMENTS_HEADERS, rows);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Движения");
  assert.equal(sheet?.getRow(2).getCell(3).value, "склад");
  assert.equal(sheet?.getRow(2).getCell(8).value, "");
  assert.equal(sheet?.getRow(2).getCell(7).value, 6000);
});

test("строки архива горничных переводят коды и время", () => {
  const rows = maidTaskRows([
    {
      createdAt: new Date("2026-11-05T09:00:00Z"),
      maidName: "Горничная (демо)",
      roomNumber: "101",
      type: "ON_DEMAND",
      priority: "URGENT",
      status: "DONE",
      plannedMinutes: 30,
      durationMinutes: 22,
      startedAt: new Date("2026-11-05T09:05:00Z"),
      finishedAt: new Date("2026-11-05T09:27:00Z"),
    },
  ]);
  assert.equal(rows[0][1], "Горничная (демо)");
  assert.equal(rows[0][3], "По требованию");
  assert.equal(rows[0][4], "Срочно");
  assert.equal(rows[0][5], "Выполнена");
  assert.equal(rows[0][6], 30);
  assert.equal(rows[0][7], 22);
});

test("лист архива горничных использует свои заголовки", async () => {
  const rows = maidTaskRows([
    {
      createdAt: new Date("2026-11-05T09:00:00Z"),
      maidName: "Горничная",
      roomNumber: "101",
      type: "DAILY",
      priority: "MEDIUM",
      status: "NEW",
      plannedMinutes: 30,
      durationMinutes: null,
      startedAt: null,
      finishedAt: null,
    },
  ]);
  const buffer = await buildWorkbook("Горничные", MAID_TASK_HEADERS, rows);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Горничные");
  assert.equal(sheet?.getRow(1).getCell(3).value, "Номер");
  assert.equal(sheet?.getRow(2).getCell(2).value, "Горничная");
});

test("печатная форма: логотип, дата, составил и место для подписи", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const rows = stockRows([
    {
      name: "Полотенце",
      categoryName: "Бельё",
      unit: "шт",
      qty: 10,
      priceKopecks: 45000,
      lastReceiptAt: null,
    },
  ]);
  const buffer = await buildWorkbook("Остатки", STOCK_HEADERS, rows, {
    hotelName: "Отель Тест",
    reportTitle: "Остатки склада",
    subtitle: "на 05.11.2026",
    generatedAt: new Date("2026-11-05T10:00:00Z"),
    preparedBy: "Администратор",
    responsibleName: "Петров П.П.",
    responsiblePosition: "Главный менеджер",
    logo: { buffer: png, width: 1, height: 1 },
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Остатки");
  assert.ok(sheet);
  assert.equal(sheet.getCell(1, 3).value, "Отель Тест");
  assert.equal(sheet.getCell(2, 1).value, "Остатки склада");
  assert.match(String(sheet.getCell(4, 1).value), /Дата формирования/);
  assert.match(String(sheet.getCell(4, 1).value), /Составил: Администратор/);
  assert.equal(sheet.getCell(9, 1).value, "Составил:");
  assert.equal(sheet.getCell(10, 2).value, "Петров П.П.");
  assert.ok((sheet.getImages()?.length ?? 0) > 0);
  assert.equal(sheet.pageSetup.orientation, "portrait");
});

test("строки задач уборки переводят коды в подписи", () => {
  const rows = taskRows([
    {
      createdAt: new Date("2026-11-05T09:00:00Z"),
      roomNumber: "101",
      type: "DAILY",
      priority: "URGENT",
      status: "DONE",
      assigneeName: "Горничная",
      plannedMinutes: 30,
      durationMinutes: 22,
    },
    {
      createdAt: new Date("2026-11-05T10:00:00Z"),
      roomNumber: "202",
      type: "ON_DEMAND",
      priority: "LOW",
      status: "NEW",
      assigneeName: null,
      plannedMinutes: null,
      durationMinutes: null,
    },
  ]);
  assert.equal(rows[0][2], "Ежедневная");
  assert.equal(rows[0][3], "Срочно");
  assert.equal(rows[0][4], "Выполнена");
  assert.equal(rows[0][7], 22);
  assert.equal(rows[1][5], "—");
  assert.equal(rows[1][6], "");
});

test("книга задач открывается обратно", async () => {
  const rows = taskRows([
    {
      createdAt: new Date("2026-11-05T09:00:00Z"),
      roomNumber: "101",
      type: "GENERAL",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      assigneeName: "Горничная",
      plannedMinutes: 60,
      durationMinutes: null,
    },
  ]);
  const buffer = await buildWorkbook("Уборка", TASK_HEADERS, rows);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Уборка");
  assert.equal(sheet?.rowCount, 2);
  assert.equal(sheet?.getRow(1).getCell(3).value, "Тип");
  assert.equal(sheet?.getRow(2).getCell(2).value, "101");
});
