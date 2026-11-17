import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShowDatesToggle } from "@/components/show-dates-toggle";
import { WarehouseAddForm } from "@/components/warehouse-add";
import { getUiSettings } from "@/i18n/get-locale";
import { formatMoney } from "@/lib/money";
import { getShowDates } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/data-table";

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; add?: string }>;
}) {
  const params = await searchParams;
  const { locale, currency } = await getUiSettings();
  const t = await getTranslations({ locale, namespace: "warehouse" });
  const money = (value: number) => formatMoney(value, locale, currency);
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
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("intro")}
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">{t("category")}</span>
          <select
            name="category"
            defaultValue={categoryId ?? "all"}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{t("all")}</option>
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
          {t("show")}
        </button>
        <Link href="/admin/warehouse" className="text-sm text-muted-foreground underline">
          {t("reset")}
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
          <ShowDatesToggle initial={showDates} />
          <span className="text-muted-foreground">
            <Link href="/admin/catalog" className="underline">
              {t("catalog")}
            </Link>
            {" · "}
            <Link href="/admin/receive" className="underline">
              {t("receive")}
            </Link>
            {" · "}
            <Link href="/admin/distribute" className="underline">
              {t("distribute")}
            </Link>
            {" · "}
            <Link href="/admin/writeoff" className="underline">
              {t("writeoff")}
            </Link>
          </span>
        </div>
      </form>

      <WarehouseAddForm initialItemId={params.add} />

      <Card>
        <CardHeader>
          <CardTitle>{t("stockValue", { value: money(totalValue) })}</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <DataTable minWidth="820px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">{t("item")}</th>
                  <th className="py-2 font-medium">{t("category")}</th>
                  <th className="py-2 text-right font-medium">{t("stock")}</th>
                  <th className="py-2 text-right font-medium">{t("price")}</th>
                  <th className="py-2 text-right font-medium">{t("value")}</th>
                  {showDates ? <th className="whitespace-nowrap py-2 pl-4 font-medium">{t("receipt")}</th> : null}
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
                        {money(item.priceKopecks)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {money(qty * item.priceKopecks)}
                      </td>
                      {showDates ? (
                        <td className="whitespace-nowrap py-2 pl-4 text-muted-foreground">
                          {item.warehouse?.lastReceiptAt
                            ? new Intl.DateTimeFormat(locale).format(
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
