import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLowStock } from "@/lib/domain/reports";
import { getUiSettings } from "@/i18n/get-locale";
import { formatMoney } from "@/lib/money";
import { hasPermission } from "@/lib/rbac";
import { getShowDates } from "@/lib/settings";
import { DataTable } from "@/components/ui/data-table";

const TYPE_LABELS: Record<string, string> = {
  RECEIVE: "Приёмка",
  DISTRIBUTE: "Раздача",
  RETURN: "Возврат",
  WRITE_OFF: "Списание",
  AUDIT: "Инвентаризация",
};

const TABS = [
  { key: "stock", label: "Остатки склада" },
  { key: "movements", label: "Движения" },
  { key: "low", label: "Низкий остаток" },
  { key: "no-price", label: "Без цены" },
];

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function formatShortDate(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" }).format(value);
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  const { locale, currency } = await getUiSettings();
  if (!user || !hasPermission(user, "reports.view")) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Нет права на отчёты.
      </p>
    );
  }

  const params = await searchParams;
  const report = TABS.some((tab) => tab.key === params.report) ? params.report! : "stock";
  const range = defaultRange();
  const from = params.from ?? range.from;
  const to = params.to ?? range.to;
  const showDates = await getShowDates();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Отчёты</h1>
        <p className="text-sm text-muted-foreground">
          Остатки и движения с ценой и стоимостью, дефицит по минимальным остаткам,
          позиции без цены.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/reports?report=${tab.key}&from=${from}&to=${to}`}
            className={
              report === tab.key
                ? "rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                : "rounded-md border px-3 py-2 text-sm hover:bg-muted"
            }
          >
            {tab.label}
          </Link>
        ))}
        <a
          href={`/api/reports/export?report=${report}&from=${from}&to=${to}`}
          className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
        >
          Скачать Excel
        </a>
      </nav>

      {report === "stock" ? <StockReport showDates={showDates} /> : null}
      {report === "movements" ? (
        <MovementsReport from={from} to={to} showDates={showDates} />
      ) : null}
      {report === "low" ? <LowStockReport showDates={showDates} /> : null}
      {report === "no-price" ? <NoPriceReport /> : null}
    </div>
  );
}

async function StockReport({ showDates }: { showDates: boolean }) {
  const { locale, currency } = await getUiSettings();
  const money = (value: number) => formatMoney(value, locale, currency);
  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: { category: true, warehouse: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  const totalValue = items.reduce(
    (sum, item) => sum + (item.warehouse?.qty ?? 0) * item.priceKopecks,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Остатки склада ({items.length}) · стоимость {money(totalValue)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable minWidth="760px">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium">Позиция</th>
              <th className="py-2 font-medium">Категория</th>
              <th className="py-2 text-right font-medium">Остаток</th>
              <th className="py-2 text-right font-medium">Цена</th>
              <th className="py-2 text-right font-medium">Стоимость</th>
              {showDates ? <th className="whitespace-nowrap py-2 pl-4 font-medium">Поступление</th> : null}            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const qty = item.warehouse?.qty ?? 0;
              return (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.category.name}</td>
                  <td
                    className={`py-2 text-right tabular-nums ${qty === 0 ? "text-destructive" : ""}`}
                  >
                    {qty} {item.unit}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {money(item.priceKopecks)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {money(qty * item.priceKopecks)}
                  </td>
                  {showDates ? (
                    <td className="whitespace-nowrap py-2 pl-4 text-muted-foreground">
                      {item.warehouse?.lastReceiptAt
                        ? formatShortDate(item.warehouse.lastReceiptAt)
                        : "—"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </CardContent>
    </Card>
  );
}

async function MovementsReport({
  from,
  to,
  showDates,
}: {
  from: string;
  to: string;
  showDates: boolean;
}) {
  const { locale, currency } = await getUiSettings();
  const money = (value: number) => formatMoney(value, locale, currency);
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);

  const operations = await prisma.operation.findMany({
    where: { documentDate: { gte: fromDate, lte: toDate } },
    include: {
      items: { include: { item: { select: { name: true, unit: true, priceKopecks: true } } } },
      room: { select: { number: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { documentDate: "desc" },
    take: 500,
  });

  return (
    <div className="space-y-3">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="report" value="movements" />
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">С даты</span>
          <input type="date" name="from" defaultValue={from} className="h-10 rounded-md border bg-background px-3" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">По дату</span>
          <input type="date" name="to" defaultValue={to} className="h-10 rounded-md border bg-background px-3" />
        </label>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">
          Показать
        </button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>
            Движения по дате документа {from} — {to} ({operations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {operations.length === 0 ? (
            <p className="text-sm text-muted-foreground">За период операций нет.</p>
          ) : (
            <DataTable minWidth="760px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {showDates ? <th className="py-2 font-medium">Дата</th> : null}
                  <th className="py-2 font-medium">Операция</th>
                  <th className="py-2 font-medium">Номер</th>
                  <th className="py-2 font-medium">Позиции</th>
                  <th className="py-2 font-medium">Автор</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((operation) => (
                  <tr key={operation.id} className="border-b align-top last:border-0">
                    {showDates ? (
                      <td className="py-2 whitespace-nowrap">{formatShortDate(operation.documentDate)}</td>
                    ) : null}
                    <td className="py-2">
                      {TYPE_LABELS[operation.type] ?? operation.type}
                      {operation.reason ? (
                        <span className="block text-xs text-muted-foreground">{operation.reason}</span>
                      ) : null}
                    </td>
                    <td className="py-2">{operation.room?.number ?? "склад"}</td>
                    <td className="py-2">
                      {operation.items.map((line) => (
                        <span key={line.id} className="block">
                          {line.item.name}: {line.qty} {line.item.unit} ×{" "}
                          {money(line.item.priceKopecks)} ={" "}
                          {money(line.qty * line.item.priceKopecks)}
                          {line.delta !== null && line.delta !== undefined
                            ? ` (Δ ${line.delta > 0 ? "+" : ""}${line.delta})`
                            : ""}
                        </span>
                      ))}
                    </td>
                    <td className="py-2">{operation.user.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function LowStockReport({ showDates }: { showDates: boolean }) {
  const { locale, currency } = await getUiSettings();
  const money = (value: number) => formatMoney(value, locale, currency);
  const [rooms, inventory, rules] = await Promise.all([
    prisma.room.findMany({ where: { isActive: true }, include: { roomType: true } }),
    prisma.roomInventory.findMany(),
    prisma.minStock.findMany({ include: { item: { include: { warehouse: true } } } }),
  ]);

  const qty = new Map(inventory.map((row) => [`${row.roomId}:${row.itemId}`, row.qty]));
  const price = new Map(rules.map((rule) => [rule.itemId, rule.item.priceKopecks]));
  const lastReceipt = new Map(
    rules.map((rule) => [rule.itemId, rule.item.warehouse?.lastReceiptAt ?? null]),
  );
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
    rules.map((rule) => ({ roomTypeId: rule.roomTypeId, itemId: rule.itemId, minQty: rule.minQty })),
  );
  const totalValue = issues.reduce(
    (sum, issue) => sum + issue.missing * (price.get(issue.itemId) ?? 0),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Дефицит в номерах ({issues.length}) · стоимость {money(totalValue)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Дефицита нет — все остатки не ниже минимума.</p>
        ) : (
          <DataTable minWidth="760px">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Номер</th>
                <th className="py-2 font-medium">Позиция</th>
                <th className="py-2 text-right font-medium">Есть</th>
                <th className="py-2 text-right font-medium">Минимум</th>
                <th className="py-2 text-right font-medium">Не хватает</th>
                <th className="py-2 text-right font-medium">Цена</th>
                <th className="py-2 text-right font-medium">Стоимость</th>
                {showDates ? <th className="py-2 font-medium">Поступление</th> : null}
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={`${issue.roomNumber}:${issue.itemId}`} className="border-b last:border-0">
                  <td className="py-2 font-medium">{issue.roomNumber}</td>
                  <td className="py-2">{issue.itemName}</td>
                  <td className="py-2 text-right tabular-nums">{issue.have}</td>
                  <td className="py-2 text-right tabular-nums">{issue.min}</td>
                  <td className="py-2 text-right tabular-nums text-destructive">{issue.missing}</td>
                  <td className="py-2 text-right tabular-nums">
                    {money(price.get(issue.itemId) ?? 0)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {money(issue.missing * (price.get(issue.itemId) ?? 0))}
                  </td>
                  {showDates ? (
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {lastReceipt.get(issue.itemId)
                        ? formatShortDate(lastReceipt.get(issue.itemId)!)
                        : "—"}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </CardContent>
    </Card>
  );
}

async function NoPriceReport() {
  const items = await prisma.item.findMany({
    where: { isActive: true, priceKopecks: 0 },
    include: { category: true, warehouse: true },
    orderBy: [{ name: "asc" }],
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Позиции без цены ({items.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">У всех активных позиций задана цена.</p>
        ) : (
          <DataTable minWidth="760px">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Позиция</th>
                <th className="py-2 font-medium">Категория</th>
                <th className="py-2 text-right font-medium">Остаток</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2">
                    <Link href="/admin/catalog" className="text-primary underline">
                      {item.name}
                    </Link>
                  </td>
                  <td className="py-2">{item.category.name}</td>
                  <td className="py-2 text-right tabular-nums">
                    {item.warehouse?.qty ?? 0} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </CardContent>
    </Card>
  );
}
