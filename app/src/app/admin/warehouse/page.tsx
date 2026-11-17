import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShowDatesToggle } from "@/components/show-dates-toggle";
import { WarehouseAddForm } from "@/components/warehouse-add";
import { formatKopecks } from "@/lib/money";
import { getShowDates } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/data-table";

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; add?: string }>;
}) {
  const params = await searchParams;
  const categoryId = params.category && params.category !== "all" ? params.category : undefined;

  const [categories, items, showDates] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: { isActive: true, ...(categoryId ? { categoryId } : {}) },
      include: { category: true, warehouse: true },
      orderBy: { name: "asc" },
    }),
    getShowDates(),
  ]);

  const totalValue = items.reduce(
    (sum, item) => sum + (item.warehouse?.qty ?? 0) * item.priceKopecks,
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Склад</h1>
        <p className="text-sm text-muted-foreground">
          Остатки по позициям, цена из справочника и дата последнего поступления.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Категория</span>
          <select
            name="category"
            defaultValue={categoryId ?? "all"}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Все</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Показать
        </button>
        <Link href="/admin/warehouse" className="text-sm text-muted-foreground underline">
          Сбросить
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
          <ShowDatesToggle initial={showDates} />
          <span className="text-muted-foreground">
            <Link href="/admin/catalog" className="underline">
              Справочник
            </Link>
            {" · "}
            <Link href="/admin/receive" className="underline">
              Принять
            </Link>
            {" · "}
            <Link href="/admin/distribute" className="underline">
              Раздать
            </Link>
            {" · "}
            <Link href="/admin/writeoff" className="underline">
              Списать
            </Link>
          </span>
        </div>
      </form>

      <WarehouseAddForm initialItemId={params.add} />

      <Card>
        <CardHeader>
          <CardTitle>Остатки · стоимость {formatKopecks(totalValue)}</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Позиций нет.</p>
          ) : (
            <DataTable minWidth="820px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Позиция</th>
                  <th className="py-2 font-medium">Категория</th>
                  <th className="py-2 text-right font-medium">Остаток</th>
                  <th className="py-2 text-right font-medium">Цена</th>
                  <th className="py-2 text-right font-medium">Стоимость</th>
                  {showDates ? <th className="whitespace-nowrap py-2 pl-4 font-medium">Поступление</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const qty = item.warehouse?.qty ?? 0;
                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">
                        {item.name}
                        {item.note ? (
                          <span className="block text-xs text-muted-foreground">{item.note}</span>
                        ) : null}
                      </td>
                      <td className="py-2">{item.category.name}</td>
                      <td
                        className={`py-2 text-right tabular-nums ${qty === 0 ? "text-destructive" : ""}`}
                      >
                        {qty} {item.unit}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatKopecks(item.priceKopecks)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatKopecks(qty * item.priceKopecks)}
                      </td>
                      {showDates ? (
                        <td className="whitespace-nowrap py-2 pl-4 text-muted-foreground">
                          {item.warehouse?.lastReceiptAt
                            ? new Intl.DateTimeFormat("ru-RU").format(
                                item.warehouse.lastReceiptAt,
                              )
                            : "—"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
