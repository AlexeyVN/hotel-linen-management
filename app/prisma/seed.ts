/**
 * Seed по ТЗ v2.3 §5.2.8 и §0.1: 3 этажа, 10 номеров, 3 типа комнат,
 * 3 категории, ~10 позиций, 3 пользователя. Идемпотентен: повторный запуск
 * не создаёт дублей (upsert по естественным ключам).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ code: string; description: string }> = [
  { code: "rooms.read", description: "Просмотр номеров" },
  { code: "rooms.write", description: "Добавление и редактирование номеров и типов комнат" },
  { code: "rooms.manage", description: "Настройки номеров и типов (только ADMIN)" },
  { code: "warehouse.read", description: "Просмотр склада" },
  { code: "warehouse.receive", description: "Приёмка со склада" },
  { code: "catalog.manage", description: "Справочник позиций: цена, примечание, удаление" },
  { code: "distribution.create", description: "Раздача в номера" },
  { code: "return.create", description: "Возврат из номера" },
  { code: "writeoff.create", description: "Списание" },
  { code: "audit.create", description: "Инвентаризация" },
  { code: "cleaning.manage", description: "Уборка: постановка и распределение задач, статусы номеров" },
  { code: "cleaning.execute", description: "Уборка: выполнение своих задач" },
  { code: "reports.view", description: "Отчёты" },
  { code: "users.manage", description: "Управление пользователями" },
  { code: "roles.manage", description: "Управление ролями и правами" },
  { code: "settings.integration", description: "Настройки интеграции 1С" },
  { code: "settings.minstock", description: "Настройка минимальных остатков" },
  { code: "settings.ui", description: "Интерфейс: отображение дат" },
  { code: "settings.branding", description: "Брендинг: логотип отеля и печатные подписи" },
  { code: "photos.view", description: "Просмотр фотофиксации" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.code),
  MANAGER: PERMISSIONS.map((p) => p.code).filter(
    (c) =>
      c !== "users.manage" &&
      c !== "roles.manage" &&
      c !== "rooms.write" &&
      c !== "rooms.manage" &&
      c !== "settings.branding",
  ),
  MAID: ["rooms.read", "audit.create", "photos.view", "distribution.create", "cleaning.execute"],
};

const ROLE_NAMES: Record<string, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  MAID: "Горничная",
};

const ROOM_TYPES = [
  { code: "STANDARD", name: "Стандарт" },
  { code: "SUPERIOR", name: "Улучшенный" },
  { code: "SUITE", name: "Люкс" },
];

const ROOMS: Array<{ number: string; floor: number; type: string }> = [
  { number: "101", floor: 1, type: "STANDARD" },
  { number: "102", floor: 1, type: "STANDARD" },
  { number: "103", floor: 1, type: "SUPERIOR" },
  { number: "104", floor: 1, type: "SUITE" },
  { number: "201", floor: 2, type: "STANDARD" },
  { number: "202", floor: 2, type: "STANDARD" },
  { number: "203", floor: 2, type: "SUPERIOR" },
  { number: "301", floor: 3, type: "SUPERIOR" },
  { number: "302", floor: 3, type: "SUITE" },
  { number: "303", floor: 3, type: "SUITE" },
];

const CATEGORIES = [
  { code: "LINEN", name: "Бельё" },
  { code: "CHEMICAL", name: "Химия" },
  { code: "ITEM", name: "Инвентарь" },
];

const ITEMS: Array<{
  name: string;
  category: string;
  unit: string;
  warehouseQty: number;
  priceKopecks: number;
  note?: string;
}> = [
  { name: "Комплект белья 2-сп", category: "LINEN", unit: "компл", warehouseQty: 60, priceKopecks: 185000, note: "Хлопок 100%, белый" },
  { name: "Комплект белья 1.5-сп", category: "LINEN", unit: "компл", warehouseQty: 40, priceKopecks: 150000, note: "Хлопок 100%, белый" },
  { name: "Полотенце банное", category: "LINEN", unit: "шт", warehouseQty: 80, priceKopecks: 45000, note: "700 г/м²" },
  { name: "Полотенце для рук", category: "LINEN", unit: "шт", warehouseQty: 90, priceKopecks: 25000, note: "500 г/м²" },
  { name: "Наволочка", category: "LINEN", unit: "шт", warehouseQty: 120, priceKopecks: 30000 },
  { name: "Средство для стирки", category: "CHEMICAL", unit: "л", warehouseQty: 25, priceKopecks: 65000, note: "Концентрат" },
  { name: "Средство для мытья полов", category: "CHEMICAL", unit: "л", warehouseQty: 18, priceKopecks: 40000 },
  { name: "Дезинфектор", category: "CHEMICAL", unit: "л", warehouseQty: 12, priceKopecks: 90000 },
  { name: "Халат", category: "ITEM", unit: "шт", warehouseQty: 15, priceKopecks: 120000, note: "Махровый, белый" },
  { name: "Фен", category: "ITEM", unit: "шт", warehouseQty: 10, priceKopecks: 250000, note: "2200 Вт" },
];

/** Минимальные остатки в номере: по типам комнат (§5.1 MinStock). */
const MIN_STOCK: Record<string, Record<string, number>> = {
  STANDARD: {
    "Комплект белья 2-сп": 1,
    "Полотенце банное": 2,
    "Полотенце для рук": 2,
    "Наволочка": 2,
  },
  SUPERIOR: {
    "Комплект белья 2-сп": 1,
    "Полотенце банное": 3,
    "Полотенце для рук": 2,
    "Наволочка": 2,
    "Халат": 1,
  },
  SUITE: {
    "Комплект белья 2-сп": 2,
    "Полотенце банное": 4,
    "Полотенце для рук": 3,
    "Наволочка": 4,
    "Халат": 2,
    "Фен": 1,
  },
};

const USERS: Array<{ login: string; password: string; fullName: string; role: string }> = [
  { login: "admin", password: "Admin123!", fullName: "Администратор системы", role: "ADMIN" },
  { login: "manager", password: "Manager123!", fullName: "Менеджер службы", role: "MANAGER" },
  { login: "maid", password: "Maid123!", fullName: "Горничная (демо)", role: "MAID" },
];

async function main() {
  // 1. Права
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description },
      create: p,
    });
  }

  // 2. Роли и связи
  const permissionIds = new Map<string, string>();
  for (const p of await prisma.permission.findMany()) permissionIds.set(p.code, p.id);

  for (const [code, name] of Object.entries(ROLE_NAMES)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name, isSystem: true },
      create: { code, name, isSystem: true },
    });
    for (const permCode of ROLE_PERMISSIONS[code]) {
      const permissionId = permissionIds.get(permCode);
      if (!permissionId) throw new Error(`Нет права ${permCode}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  // MANAGER больше не управляет номерами: только просмотр.
  await prisma.rolePermission.deleteMany({
    where: {
      role: { code: "MANAGER" },
      permission: { code: { in: ["rooms.write", "rooms.manage"] } },
    },
  });

  // 3. Пользователи
  for (const u of USERS) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: u.role } });
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { login: u.login },
      update: { fullName: u.fullName, roleId: role.id, isActive: true },
      create: {
        login: u.login,
        passwordHash,
        fullName: u.fullName,
        roleId: role.id,
      },
    });
  }

  // 4. Типы комнат
  for (const rt of ROOM_TYPES) {
    await prisma.roomType.upsert({
      where: { code: rt.code },
      update: { name: rt.name },
      create: rt,
    });
  }

  // 5. Номера
  for (const r of ROOMS) {
    const roomType = await prisma.roomType.findUniqueOrThrow({ where: { code: r.type } });
    await prisma.room.upsert({
      where: { number: r.number },
      update: { floor: r.floor, roomTypeId: roomType.id },
      create: { number: r.number, floor: r.floor, roomTypeId: roomType.id },
    });
  }

  // 6. Категории и позиции
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
  }

  for (const it of ITEMS) {
    const category = await prisma.category.findUniqueOrThrow({ where: { code: it.category } });
    // У позиции нет естественного уникального ключа (name не уникален по модели),
    // поэтому upsert заменён на findFirst + update/create — seed остаётся идемпотентным.
    const existing = await prisma.item.findFirst({ where: { name: it.name } });
    const item = existing
      ? await prisma.item.update({
          where: { id: existing.id },
          data: {
            unit: it.unit,
            categoryId: category.id,
            isActive: true,
            priceKopecks: it.priceKopecks,
            note: it.note ?? null,
          },
        })
      : await prisma.item.create({
          data: {
            name: it.name,
            unit: it.unit,
            categoryId: category.id,
            priceKopecks: it.priceKopecks,
            note: it.note ?? null,
          },
        });
    await prisma.warehouseInventory.upsert({
      where: { itemId: item.id },
      update: {},
      create: { itemId: item.id, qty: it.warehouseQty },
    });
  }

  // 7. Минимальные остатки по типам комнат
  for (const [typeCode, items] of Object.entries(MIN_STOCK)) {
    const roomType = await prisma.roomType.findUniqueOrThrow({ where: { code: typeCode } });
    for (const [itemName, minQty] of Object.entries(items)) {
      const item = await prisma.item.findFirstOrThrow({ where: { name: itemName } });
      await prisma.minStock.upsert({
        where: { itemId_roomTypeId: { itemId: item.id, roomTypeId: roomType.id } },
        update: { minQty },
        create: { itemId: item.id, roomTypeId: roomType.id, minQty },
      });
    }
  }

  // 8. Привязка горничной к номерам (только свои номера)
  const maid = await prisma.user.findUniqueOrThrow({ where: { login: "maid" } });
  for (const number of ["101", "102", "103"]) {
    const room = await prisma.room.findUniqueOrThrow({ where: { number } });
    await prisma.userRoom.upsert({
      where: { userId_roomId: { userId: maid.id, roomId: room.id } },
      update: {},
      create: { userId: maid.id, roomId: room.id },
    });
  }

  // 9. Настройки
  const settings: Array<[string, string]> = [
    ["audit.photoRequired", "false"],
    ["integration.enabled", "false"],
    ["integration.syncIntervalMinutes", "5"],
    ["ui.showDates", "true"],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // 10. Причины списания (ТЗ v2.3 §5.1, §7.5)
  const writeOffReasons: Array<{ code: string; name: string }> = [
    { code: "DAMAGE", name: "Порча" },
    { code: "WEAR", name: "Износ" },
    { code: "STAINS", name: "Загрязнение" },
    { code: "LOSS", name: "Утеря" },
    { code: "BREAKAGE", name: "Бой" },
  ];
  for (const reason of writeOffReasons) {
    await prisma.writeOffReason.upsert({
      where: { code: reason.code },
      update: { name: reason.name, isActive: true },
      create: reason,
    });
  }

  // 11. Демо-задачи уборки (ТЗ v2.4) — только на пустой таблице, чтобы seed оставался идемпотентным
  const cleaningTasks = await prisma.cleaningTask.count();
  if (cleaningTasks === 0) {
    const maidUser = await prisma.user.findUniqueOrThrow({ where: { login: "maid" } });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { login: "admin" } });
    const room101 = await prisma.room.findUniqueOrThrow({ where: { number: "101" } });
    const room202 = await prisma.room.findUniqueOrThrow({ where: { number: "202" } });

    await prisma.cleaningTask.create({
      data: {
        roomId: room101.id,
        type: "DAILY",
        priority: "MEDIUM",
        assigneeId: maidUser.id,
        createdById: adminUser.id,
        plannedMinutes: 30,
        comment: "Демо-задача: ежедневная уборка",
      },
    });
    await prisma.cleaningTask.create({
      data: {
        roomId: room202.id,
        type: "ON_DEMAND",
        priority: "URGENT",
        createdById: adminUser.id,
        plannedMinutes: 45,
        comment: "Демо-задача: выездная уборка",
      },
    });
    await prisma.room.update({
      where: { id: room101.id },
      data: { cleaningStatus: "DIRTY" },
    });
  }

  // 12. Демо-чек-лист (ТЗ v2.5) и привязка к демо-задаче 101
  const checklistTemplates = await prisma.checklistTemplate.count();
  if (checklistTemplates === 0) {
    const template = await prisma.checklistTemplate.create({
      data: {
        name: "Стандартная уборка номера",
        description: "Базовый чек-лист: поверхность, санузел, полы, мусор",
        items: {
          create: [
            { text: "Пыль на поверхностях", sortOrder: 0 },
            { text: "Санузел вымыт", sortOrder: 1, photoRequired: true },
            { text: "Полы вымыты", sortOrder: 2 },
            { text: "Мусор вынесен", sortOrder: 3 },
          ],
        },
      },
      select: { id: true },
    });
    const demoTask = await prisma.cleaningTask.findFirst({
      where: { room: { number: "101" }, status: "NEW" },
      orderBy: { createdAt: "asc" },
    });
    if (demoTask) {
      await prisma.cleaningTask.update({
        where: { id: demoTask.id },
        data: { checklistTemplateId: template.id },
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    rooms: await prisma.room.count(),
    roomTypes: await prisma.roomType.count(),
    items: await prisma.item.count(),
    minStocks: await prisma.minStock.count(),
    writeOffReasons: await prisma.writeOffReason.count(),
  };
  console.log("Seed завершён:", JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error("Seed упал:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
