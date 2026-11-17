import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getConfiguredLocale } from "@/i18n/get-locale";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const OPERATION_TYPES = new Set(["RECEIVE", "DISTRIBUTE", "RETURN", "WRITE_OFF", "AUDIT"]);

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  const locale = await getConfiguredLocale();
  const [t, tRoles, tOperations] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "roles" }),
    getTranslations({ locale, namespace: "operations" }),
  ]);

  const [roomsCount, roomTypesCount, itemsCount, warehouseSum, operationsCount, lastOperations] =
    await Promise.all([
      prisma.room.count({ where: { isActive: true } }),
      prisma.roomType.count({ where: { isActive: true } }),
      prisma.item.count({ where: { isActive: true } }),
      prisma.warehouseInventory.aggregate({ _sum: { qty: true } }),
      prisma.operation.count(),
      prisma.operation.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { fullName: true } }, room: { select: { number: true } } },
      }),
    ]);

  const cards = [
    { title: t("activeRooms"), value: roomsCount },
    { title: t("roomTypes"), value: roomTypesCount },
    { title: t("items"), value: itemsCount },
    { title: t("warehouseUnits"), value: warehouseSum._sum.qty ?? 0 },
    { title: t("operations"), value: operationsCount },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {user ? `${user.fullName} · ${tRoles(user.roleCode)}` : null}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("lastOperations")}</CardTitle>
        </CardHeader>
        <CardContent>
          {lastOperations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {lastOperations.map((op) => (
                <li key={op.id} className="flex justify-between py-2">
                  <span>
                    {OPERATION_TYPES.has(op.type) ? tOperations(op.type) : op.type}
                    {op.room ? ` · ${t("roomNumber", { number: op.room.number })}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {op.user.fullName} ·{" "}
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(op.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
