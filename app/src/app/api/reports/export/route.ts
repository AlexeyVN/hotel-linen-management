import type { NextRequest } from "next/server";
import { computeLowStock } from "@/lib/domain/reports";
import { getCurrentUser } from "@/lib/auth";
import { getExcelBranding } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import {
  LOW_STOCK_HEADERS,
  MAID_TASK_HEADERS,
  MOVEMENTS_HEADERS,
  NO_PRICE_HEADERS,
  STOCK_HEADERS,
  TASK_HEADERS,
  buildWorkbook,
  lowStockRows,
  maidTaskRows,
  movementsRows,
  noPriceRows,
  stockRows,
  taskRows,
} from "@/server/reports/excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateRange(searchParams: URLSearchParams): { from: Date; to: Date } {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const from = searchParams.get("from") ?? defaultFrom.toISOString().slice(0, 10);
  const to = searchParams.get("to") ?? now.toISOString().slice(0, 10);
  return {
    from: new Date(`${from}T00:00:00`),
    to: new Date(`${to}T23:59:59`),
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  if (!hasPermission(user, "reports.view")) {
    return Response.json({ error: "Нет права reports.view" }, { status: 403 });
  }

  const url = new URL(request.url);
  const report = url.searchParams.get("report") ?? "stock";
  const excelBranding = await getExcelBranding(user.fullName);
  const brandingFor = (reportTitle: string, subtitle?: string) => ({
    ...excelBranding,
    reportTitle,
    subtitle,
    generatedAt: new Date(),
  });

  let buffer: Buffer;
  let filename: string;

  if (report === "movements") {
    const { from, to } = dateRange(url.searchParams);
    const operations = await prisma.operation.findMany({
      where: { documentDate: { gte: from, lte: to } },
      include: {
        items: { include: { item: { select: { name: true, unit: true, priceKopecks: true } } } },
        room: { select: { number: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { documentDate: "desc" },
      take: 5000,
    });
    buffer = await buildWorkbook(
      "Движения",
      MOVEMENTS_HEADERS,
      movementsRows(
        operations.map((operation) => ({
          documentDate: operation.documentDate,
          type: operation.type,
          roomNumber: operation.room?.number ?? null,
          reason: operation.reason,
          userFullName: operation.user.fullName,
          items: operation.items.map((line) => ({
            name: line.item.name,
            unit: line.item.unit,
            qty: line.qty,
            delta: line.delta,
            priceKopecks: line.item.priceKopecks,
          })),
        })),
      ),
      brandingFor(
        "Движения",
        `Период: ${url.searchParams.get("from") ?? "—"} — ${url.searchParams.get("to") ?? "—"}`,
      ),
    );
    filename = `movements-${url.searchParams.get("from") ?? ""}-${url.searchParams.get("to") ?? ""}.xlsx`;
  } else if (report === "low") {
    const [rooms, inventory, rules] = await Promise.all([
      prisma.room.findMany({ where: { isActive: true }, include: { roomType: true } }),
      prisma.roomInventory.findMany(),
      prisma.minStock.findMany({ include: { item: true } }),
    ]);
    const qty = new Map(inventory.map((row) => [`${row.roomId}:${row.itemId}`, row.qty]));
    const rows = [];
    for (const rule of rules) {
      if (rule.minQty <= 0) continue;
      for (const room of rooms) {
        if (room.roomTypeId !== rule.roomTypeId) continue;
        rows.push({
          roomId: room.id,
          roomNumber: room.number,
          roomTypeId: room.roomTypeId,
          itemId: rule.itemId,
          itemName: rule.item.name,
          unit: rule.item.unit,
          qty: qty.get(`${room.id}:${rule.itemId}`) ?? 0,
        });
      }
    }
    const issues = computeLowStock(
      rows,
      rules.map((rule) => ({
        roomTypeId: rule.roomTypeId,
        itemId: rule.itemId,
        minQty: rule.minQty,
      })),
    );
    const price = new Map(rules.map((rule) => [rule.itemId, rule.item.priceKopecks]));
    buffer = await buildWorkbook(
      "Дефицит",
      LOW_STOCK_HEADERS,
      lowStockRows(
        issues.map((issue) => ({
          ...issue,
          priceKopecks: price.get(issue.itemId) ?? 0,
        })),
      ),
      brandingFor("Дефицит по минимальным остаткам"),
    );
    filename = "low-stock.xlsx";
  } else if (report === "maid-tasks") {
    const { from, to } = dateRange(url.searchParams);
    const maidId = url.searchParams.get("maidId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const tasks = await prisma.cleaningTask.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(maidId ? { assigneeId: maidId } : { assignee: { role: { code: "MAID" } } }),
        ...(status ? { status } : {}),
      },
      include: {
        room: { select: { number: true } },
        assignee: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    buffer = await buildWorkbook(
      "Горничные",
      MAID_TASK_HEADERS,
      maidTaskRows(
        tasks.map((task) => ({
          createdAt: task.createdAt,
          maidName: task.assignee?.fullName ?? "Не назначено",
          roomNumber: task.room.number,
          type: task.type,
          priority: task.priority,
          status: task.status,
          plannedMinutes: task.plannedMinutes,
          durationMinutes:
            task.startedAt && task.finishedAt
              ? Math.max(
                  0,
                  Math.round((task.finishedAt.getTime() - task.startedAt.getTime()) / 60_000),
                )
              : null,
          startedAt: task.startedAt,
          finishedAt: task.finishedAt,
        })),
      ),
      brandingFor(
        "Задания горничных",
        `Период: ${url.searchParams.get("from") ?? "—"} — ${url.searchParams.get("to") ?? "—"}`,
      ),
    );
    filename = "maid-tasks.xlsx";
  } else if (report === "tasks") {
    const { from, to } = dateRange(url.searchParams);
    const tasks = await prisma.cleaningTask.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        room: { select: { number: true } },
        assignee: { select: { fullName: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });
    buffer = await buildWorkbook(
      "Уборка",
      TASK_HEADERS,
      taskRows(
        tasks.map((task) => ({
          createdAt: task.createdAt,
          roomNumber: task.room.number,
          type: task.type,
          priority: task.priority,
          status: task.status,
          assigneeName: task.assignee?.fullName ?? null,
          plannedMinutes: task.plannedMinutes,
          durationMinutes:
            task.startedAt && task.finishedAt
              ? Math.max(
                  0,
                  Math.round(
                    (task.finishedAt.getTime() - task.startedAt.getTime()) / 60_000,
                  ),
                )
              : null,
        })),
      ),
      brandingFor(
        "Задания на уборку",
        `Период: ${url.searchParams.get("from") ?? "—"} — ${url.searchParams.get("to") ?? "—"}`,
      ),
    );
    filename = "cleaning-tasks.xlsx";
  } else if (report === "no-price") {
    const items = await prisma.item.findMany({
      where: { isActive: true, priceKopecks: 0 },
      include: { category: true, warehouse: true },
      orderBy: [{ name: "asc" }],
    });
    buffer = await buildWorkbook(
      "Без цены",
      NO_PRICE_HEADERS,
      noPriceRows(
        items.map((item) => ({
          name: item.name,
          categoryName: item.category.name,
          unit: item.unit,
          qty: item.warehouse?.qty ?? 0,
        })),
      ),
      brandingFor("Позиции без цены"),
    );
    filename = "no-price.xlsx";
  } else {
    const items = await prisma.item.findMany({
      where: { isActive: true },
      include: { category: true, warehouse: true },
      orderBy: [{ name: "asc" }],
    });
    buffer = await buildWorkbook(
      "Остатки",
      STOCK_HEADERS,
      stockRows(
        items.map((item) => ({
          name: item.name,
          categoryName: item.category.name,
          unit: item.unit,
          qty: item.warehouse?.qty ?? 0,
          priceKopecks: item.priceKopecks,
          lastReceiptAt: item.warehouse?.lastReceiptAt ?? null,
        })),
      ),
      brandingFor("Остатки склада"),
    );
    filename = "warehouse-stock.xlsx";
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
