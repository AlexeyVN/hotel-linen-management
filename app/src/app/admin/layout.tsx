import { redirect } from "next/navigation";
import { AdminShell, type NavEntry } from "@/components/admin-shell";
import { getCurrentUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { hasPermission, type PermissionCode } from "@/lib/rbac";

type NavConfig =
  | { href: string; label: string; permission: PermissionCode }
  | {
      label: string;
      items: Array<{ href: string; label: string; permission: PermissionCode }>;
    };

const NAV: NavConfig[] = [
  { href: "/admin", label: "Обзор", permission: "rooms.read" },
  {
    label: "Склад",
    items: [
      { href: "/admin/catalog", label: "Справочник", permission: "catalog.manage" },
      { href: "/admin/warehouse", label: "Склад", permission: "warehouse.read" },
    ],
  },
  {
    label: "Документы",
    items: [
      { href: "/admin/receive", label: "Приёмка", permission: "warehouse.receive" },
      { href: "/admin/distribute", label: "Раздача", permission: "distribution.create" },
      { href: "/admin/return", label: "Возврат", permission: "return.create" },
      { href: "/admin/writeoff", label: "Списание", permission: "writeoff.create" },
      { href: "/admin/audit", label: "Инвентаризация", permission: "audit.create" },
      { href: "/admin/qr", label: "QR-коды", permission: "rooms.read" },
    ],
  },
  {
    label: "Уборка",
    items: [
      { href: "/admin/cleaning", label: "Уборка", permission: "cleaning.manage" },
      { href: "/admin/maids", label: "Горничные", permission: "cleaning.manage" },
      { href: "/admin/checklists", label: "Чек-листы", permission: "cleaning.manage" },
    ],
  },
  { href: "/admin/reports", label: "Отчёты", permission: "reports.view" },
  {
    label: "Настройки",
    items: [
      { href: "/admin/settings", label: "Общие настройки", permission: "settings.ui" },
      { href: "/admin/rooms", label: "Номера и типы комнат", permission: "rooms.read" },
      { href: "/admin/users", label: "Пользователи", permission: "users.manage" },
      { href: "/admin/roles", label: "Роли", permission: "roles.manage" },
      { href: "/admin/settings/1c", label: "Интеграция 1С", permission: "settings.integration" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.roleCode === "MAID") redirect("/m");

  const nav: NavEntry[] = [];
  for (const node of NAV) {
    if ("items" in node) {
      const items = node.items
        .filter((item) => hasPermission(user, item.permission))
        .map(({ href, label }) => ({ href, label }));
      if (items.length > 0) nav.push({ label: node.label, items });
    } else if (hasPermission(user, node.permission)) {
      nav.push({ href: node.href, label: node.label });
    }
  }
  const branding = await getBranding();

  return (
    <AdminShell
      user={{ fullName: user.fullName, roleName: user.roleName }}
      nav={nav}
      branding={{ hotelName: branding.hotelName, logoUrl: branding.logoUrl }}
    >
      {children}
    </AdminShell>
  );
}
