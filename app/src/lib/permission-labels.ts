import type { PermissionCode } from "./rbac";

/** Единственный источник русских подписей прав для UI. */
export const PERMISSION_LABELS = {
  "rooms.read": "Просмотр номеров",
  "rooms.write": "Управление номерами и типами",
  "rooms.manage": "Настройки номеров и типов (ADMIN)",
  "warehouse.read": "Просмотр склада",
  "warehouse.receive": "Приёмка",
  "catalog.manage": "Управление справочником",
  "distribution.create": "Раздача",
  "return.create": "Возврат",
  "writeoff.create": "Списание",
  "audit.create": "Инвентаризация",
  "cleaning.manage": "Управление уборкой",
  "cleaning.execute": "Выполнение задач уборки",
  "reports.view": "Отчёты",
  "users.manage": "Управление пользователями",
  "roles.manage": "Управление ролями",
  "settings.integration": "Настройки 1С",
  "settings.minstock": "Минимальные остатки",
  "settings.ui": "Общие настройки",
  "settings.branding": "Брендинг и оформление",
  "photos.view": "Просмотр фото",
  "logs.view": "Журнал событий",
} satisfies Record<PermissionCode, string>;
