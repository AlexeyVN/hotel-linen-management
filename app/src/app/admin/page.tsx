import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const OPERATION_LABELS: Record<string, string> = {
  RECEIVE: "Приёмка",
  DISTRIBUTE: "Раздача",
  RETURN: "Возврат",
  WRITE_OFF: "Списание",
  AUDIT: "Инвентаризация",
};

export default async function AdminDashboard() {
  const user = await getCurrentUser();

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
    { title: "Активных номеров", value: roomsCount },
    { title: "Типов комнат", value: roomTypesCount },
    { title: "Позиций учёта", value: itemsCount },
    { title: "Единиц на складе", value: warehouseSum._sum.qty ?? 0 },
    { title: "Операций в журнале", value: operationsCount },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Обзор</h1>
        <p className="text-sm text-muted-foreground">
          {user ? `${user.fullName} · ${user.roleName}` : null}
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
          <CardTitle>Последние операции</CardTitle>
        </CardHeader>
        <CardContent>
          {lastOperations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Операций пока нет — журнал пуст.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {lastOperations.map((op) => (
                <li key={op.id} className="flex justify-between py-2">
                  <span>
                    {OPERATION_LABELS[op.type] ?? op.type}
                    {op.room ? ` · номер ${op.room.number}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {op.user.fullName} ·{" "}
                    {new Intl.DateTimeFormat("ru-RU", {
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
