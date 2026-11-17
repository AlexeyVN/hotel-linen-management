/**
 * Excel-выгрузки отчётов (этап 2 + M8B): цена, стоимость, дата документа.
 * Строки собираются чистыми функциями, книга — ExcelJS.
 */
import ExcelJS from "exceljs";
import {
  CLEANING_TYPE_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain/cleaning";

const TYPE_LABELS: Record<string, string> = {
  RECEIVE: "Приёмка",
  DISTRIBUTE: "Раздача",
  RETURN: "Возврат",
  WRITE_OFF: "Списание",
  AUDIT: "Инвентаризация",
};

function rubles(kopecks: number): number {
  return kopecks / 100;
}

function shortDate(value: Date | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" }).format(value);
}

export interface StockRowInput {
  name: string;
  categoryName: string;
  unit: string;
  qty: number;
  priceKopecks: number;
  lastReceiptAt: Date | null;
}

export interface MovementRowInput {
  documentDate: Date;
  type: string;
  roomNumber: string | null;
  reason: string | null;
  userFullName: string;
  items: Array<{
    name: string;
    unit: string;
    qty: number;
    delta: number | null;
    priceKopecks: number;
  }>;
}

export interface IssueRowInput {
  roomNumber: string;
  itemName: string;
  unit: string;
  have: number;
  min: number;
  missing: number;
  priceKopecks: number;
}

export interface NoPriceRowInput {
  name: string;
  categoryName: string;
  unit: string;
  qty: number;
}

export interface MaidTaskRowInput {
  createdAt: Date;
  maidName: string;
  roomNumber: string;
  type: string;
  priority: string;
  status: string;
  plannedMinutes: number | null;
  durationMinutes: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export function maidTaskRows(
  tasks: readonly MaidTaskRowInput[],
): Array<Array<string | number>> {
  return tasks.map((task) => [
    new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
      task.createdAt,
    ),
    task.maidName,
    task.roomNumber,
    CLEANING_TYPE_LABELS[task.type] ?? task.type,
    PRIORITY_LABELS[task.priority] ?? task.priority,
    TASK_STATUS_LABELS[task.status] ?? task.status,
    task.plannedMinutes ?? "",
    task.durationMinutes ?? "",
    task.startedAt
      ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
          task.startedAt,
        )
      : "",
    task.finishedAt
      ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
          task.finishedAt,
        )
      : "",
  ]);
}

export function stockRows(items: readonly StockRowInput[]): Array<Array<string | number>> {
  return items.map((item) => [
    item.name,
    item.categoryName,
    item.unit,
    item.qty,
    rubles(item.priceKopecks),
    rubles(item.qty * item.priceKopecks),
    shortDate(item.lastReceiptAt),
  ]);
}

export function movementsRows(
  operations: readonly MovementRowInput[],
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [];
  for (const operation of operations) {
    for (const line of operation.items) {
      rows.push([
        shortDate(operation.documentDate),
        TYPE_LABELS[operation.type] ?? operation.type,
        operation.roomNumber ?? "склад",
        line.name,
        line.qty,
        rubles(line.priceKopecks),
        rubles(line.qty * line.priceKopecks),
        line.delta ?? "",
        operation.reason ?? "",
        operation.userFullName,
      ]);
    }
  }
  return rows;
}

export function lowStockRows(issues: readonly IssueRowInput[]): Array<Array<string | number>> {
  return issues.map((issue) => [
    issue.roomNumber,
    issue.itemName,
    issue.unit,
    issue.have,
    issue.min,
    issue.missing,
    rubles(issue.priceKopecks),
    rubles(issue.missing * issue.priceKopecks),
  ]);
}

export function noPriceRows(items: readonly NoPriceRowInput[]): Array<Array<string | number>> {
  return items.map((item) => [item.name, item.categoryName, item.unit, item.qty]);
}

export interface CleaningTaskRowInput {
  createdAt: Date;
  roomNumber: string;
  type: string;
  priority: string;
  status: string;
  assigneeName: string | null;
  plannedMinutes: number | null;
  durationMinutes: number | null;
}

export function taskRows(
  tasks: readonly CleaningTaskRowInput[],
): Array<Array<string | number>> {
  return tasks.map((task) => [
    new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
      task.createdAt,
    ),
    task.roomNumber,
    CLEANING_TYPE_LABELS[task.type] ?? task.type,
    PRIORITY_LABELS[task.priority] ?? task.priority,
    TASK_STATUS_LABELS[task.status] ?? task.status,
    task.assigneeName ?? "—",
    task.plannedMinutes ?? "",
    task.durationMinutes ?? "",
  ]);
}

export interface ReportBranding {
  hotelName: string;
  reportTitle: string;
  subtitle?: string;
  generatedAt: Date;
  preparedBy: string;
  responsibleName?: string;
  responsiblePosition?: string;
  logo?: { buffer: Buffer; width: number; height: number };
  locale?: string;
  currency?: string;
}

function columnLetter(column: number): string {
  let result = "";
  let value = column;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function logoExt(logo: { width: number; height: number }): { width: number; height: number } {
  const scale = Math.min(160 / Math.max(1, logo.width), 60 / Math.max(1, logo.height));
  return {
    width: Math.max(16, Math.round(logo.width * scale)),
    height: Math.max(16, Math.round(logo.height * scale)),
  };
}

export async function buildWorkbook(
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  branding?: ReportBranding,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "hotel-linen-management";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  const lastCol = Math.max(headers.length, 1);
  let headerRowNumber = 1;

  if (branding) {
    const hotelName = branding.hotelName || "Отель";
    const logo = branding.logo;
    sheet.getRow(1).height = logo ? 52 : 30;
    if (logo) {
      const imageId = workbook.addImage({
        // ExcelJS типизирует buffer старым Buffer (без generic-совместимости Node 24)
        buffer: logo.buffer as never,
        extension: "png",
      });
      sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: logoExt(logo) });
      const nameCell = lastCol >= 3 ? 3 : 1;
      if (lastCol > nameCell) sheet.mergeCells(1, nameCell, 1, lastCol);
      sheet.getCell(1, nameCell).value = hotelName;
      sheet.getCell(1, nameCell).font = { bold: true, size: 14 };
      sheet.getCell(1, nameCell).alignment = { vertical: "middle" };
    } else {
      if (lastCol > 1) sheet.mergeCells(1, 1, 1, lastCol);
      sheet.getCell(1, 1).value = hotelName;
      sheet.getCell(1, 1).font = { bold: true, size: 14 };
    }

    sheet.getRow(2).height = 24;
    if (lastCol > 1) sheet.mergeCells(2, 1, 2, lastCol);
    sheet.getCell(2, 1).value = branding.reportTitle;
    sheet.getCell(2, 1).font = { bold: true, size: 16 };

    if (branding.subtitle) {
      if (lastCol > 1) sheet.mergeCells(3, 1, 3, lastCol);
      sheet.getCell(3, 1).value = branding.subtitle;
      sheet.getCell(3, 1).font = { italic: true, size: 11 };
    }

    const generated = new Intl.DateTimeFormat(branding.locale ?? "ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(branding.generatedAt);
    if (lastCol > 1) sheet.mergeCells(4, 1, 4, lastCol);
    sheet.getCell(4, 1).value = `Дата формирования: ${generated}    Составил: ${branding.preparedBy}`;
    sheet.getCell(4, 1).font = { size: 10 };
    sheet.getRow(5).height = 6;
    headerRowNumber = 6;
  }

  const headerRow = branding ? sheet.getRow(headerRowNumber) : sheet.addRow(headers);
  if (branding) {
    headers.forEach((header, index) => {
      headerRow.getCell(index + 1).value = header;
    });
  }
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
  };

  for (const row of rows) sheet.addRow(row);

  sheet.columns.forEach((column, index) => {
    const widest = Math.max(
      headers[index]?.length ?? 10,
      ...rows.map((row) => String(row[index] ?? "").length),
    );
    column.width = Math.min(40, Math.max(12, widest + 2));
  });

  if (branding) {
    const lastDataRow = headerRowNumber + rows.length;
    const signatureRow = lastDataRow + 2;
    const put = (row: number, col: number, value: string, bold = false) => {
      const cell = sheet.getRow(row).getCell(col);
      cell.value = value;
      if (bold) cell.font = { bold: true };
    };
    put(signatureRow, 1, "Составил:", true);
    put(signatureRow, 2, branding.preparedBy);
    put(signatureRow + 1, 1, "Ответственный:", true);
    put(signatureRow + 1, 2, branding.responsibleName || "________________");
    put(signatureRow + 2, 1, "Должность:", true);
    put(signatureRow + 2, 2, branding.responsiblePosition || "________________");
    put(signatureRow + 3, 1, "Подпись:", true);
    put(signatureRow + 3, 2, "________________");
    put(signatureRow + 3, 3, "Дата:", true);
    put(signatureRow + 3, 4, "«___» __________ 20___ г.");

    const lastRow = signatureRow + 3;
    sheet.pageSetup = {
      paperSize: 9,
      orientation: lastCol > 7 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printArea: `A1:${columnLetter(lastCol)}${lastRow}`,
      printTitlesRow: `${headerRowNumber}:${headerRowNumber}`,
    };
    sheet.headerFooter.oddFooter = "&CСтр. &P из &N";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export const STOCK_HEADERS = [
  "Позиция",
  "Категория",
  "Единица",
  "Остаток",
  "Цена, ₽",
  "Стоимость, ₽",
  "Дата поступления",
];
export const MOVEMENTS_HEADERS = [
  "Дата документа",
  "Операция",
  "Номер",
  "Позиция",
  "Количество",
  "Цена, ₽",
  "Сумма, ₽",
  "Расхождение",
  "Причина",
  "Автор",
];
export const LOW_STOCK_HEADERS = [
  "Номер",
  "Позиция",
  "Единица",
  "Есть",
  "Минимум",
  "Не хватает",
  "Цена, ₽",
  "Стоимость дефицита, ₽",
];
export const NO_PRICE_HEADERS = ["Позиция", "Категория", "Единица", "Остаток"];
export const MAID_TASK_HEADERS = [
  "Дата создания",
  "Горничная",
  "Номер",
  "Тип",
  "Приоритет",
  "Статус",
  "План, мин",
  "Факт, мин",
  "Начало",
  "Завершение",
];
export const TASK_HEADERS = [
  "Создана",
  "Номер",
  "Тип",
  "Приоритет",
  "Статус",
  "Исполнитель",
  "План, мин",
  "Факт, мин",
];
