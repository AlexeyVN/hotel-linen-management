/**
 * Права и роли. Роли — данные (БД), но коды прав и пресеты фиксируются здесь,
 * чтобы сервер и seed не расходились. ТЗ v2.3 §6.
 */

export const PERMISSIONS = [
  "rooms.read",
  "rooms.write",
  "rooms.manage",
  "warehouse.read",
  "warehouse.receive",
  "catalog.manage",
  "distribution.create",
  "return.create",
  "writeoff.create",
  "audit.create",
  "cleaning.manage",
  "cleaning.execute",
  "reports.view",
  "users.manage",
  "roles.manage",
  "settings.integration",
  "settings.minstock",
  "settings.ui",
  "settings.branding",
  "photos.view",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export const ROLE_CODES = ["ADMIN", "MANAGER", "MAID"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_PRESETS: Record<RoleCode, readonly PermissionCode[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: PERMISSIONS.filter(
    (code) =>
      code !== "users.manage" &&
      code !== "roles.manage" &&
      code !== "rooms.write" &&
      code !== "rooms.manage" &&
      code !== "settings.branding",
  ),
  MAID: [
    "rooms.read",
    "audit.create",
    "photos.view",
    "distribution.create",
    "cleaning.execute",
  ],
};

export interface SessionUser {
  id: string;
  login: string;
  fullName: string;
  roleCode: string;
  roleName: string;
  permissions: PermissionCode[];
  roomIds: string[];
}

export function hasPermission(
  user: Pick<SessionUser, "permissions">,
  code: PermissionCode,
): boolean {
  return user.permissions.includes(code);
}

export function assertPermission(
  user: Pick<SessionUser, "permissions" | "login">,
  code: PermissionCode,
): void {
  if (!hasPermission(user, code)) {
    throw new Error(`Нет права ${code} (пользователь ${user.login})`);
  }
}

/** Горничная видит только назначенные номера; остальные роли — все. */
export function canAccessRoom(
  user: Pick<SessionUser, "roleCode" | "roomIds">,
  roomId: string,
): boolean {
  if (user.roleCode !== "MAID") return true;
  return user.roomIds.includes(roomId);
}

/** Маршрут по умолчанию после входа. */
export function defaultRouteForRole(roleCode: string): string {
  return roleCode === "MAID" ? "/m" : "/admin";
}
