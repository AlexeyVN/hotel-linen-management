import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminShell, type NavEntry } from "@/components/admin-shell";
import { getConfiguredLocale } from "@/i18n/get-locale";
import { getCurrentUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { hasPermission, type PermissionCode } from "@/lib/rbac";

type NavConfig =
  | { href: string; labelKey: string; permission: PermissionCode }
  | {
      labelKey: string;
      items: Array<{ href: string; labelKey: string; permission: PermissionCode }>;
    };

const NAV: NavConfig[] = [
  { href: "/admin", labelKey: "overview", permission: "rooms.read" },
  {
    labelKey: "warehouseGroup",
    items: [
      { href: "/admin/catalog", labelKey: "catalog", permission: "catalog.manage" },
      { href: "/admin/warehouse", labelKey: "warehouse", permission: "warehouse.read" },
    ],
  },
  {
    labelKey: "documents",
    items: [
      { href: "/admin/receive", labelKey: "receive", permission: "warehouse.receive" },
      { href: "/admin/distribute", labelKey: "distribute", permission: "distribution.create" },
      { href: "/admin/return", labelKey: "return", permission: "return.create" },
      { href: "/admin/writeoff", labelKey: "writeoff", permission: "writeoff.create" },
      { href: "/admin/audit", labelKey: "audit", permission: "audit.create" },
      { href: "/admin/qr", labelKey: "qr", permission: "rooms.read" },
    ],
  },
  {
    labelKey: "cleaningGroup",
    items: [
      { href: "/admin/cleaning", labelKey: "cleaning", permission: "cleaning.manage" },
      { href: "/admin/maids", labelKey: "maids", permission: "cleaning.manage" },
      { href: "/admin/checklists", labelKey: "checklists", permission: "cleaning.manage" },
    ],
  },
  { href: "/admin/reports", labelKey: "reports", permission: "reports.view" },
  {
    labelKey: "settingsGroup",
    items: [
      { href: "/admin/settings", labelKey: "settings", permission: "settings.ui" },
      { href: "/admin/rooms", labelKey: "rooms", permission: "rooms.read" },
      { href: "/admin/users", labelKey: "users", permission: "users.manage" },
      { href: "/admin/roles", labelKey: "roles", permission: "roles.manage" },
      { href: "/admin/settings/1c", labelKey: "integration", permission: "settings.integration" },
      { href: "/admin/logs", labelKey: "logs", permission: "logs.view" },
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

  const locale = await getConfiguredLocale();
  const [t, tRoles] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "roles" }),
  ]);

  const nav: NavEntry[] = [];
  for (const node of NAV) {
    if ("items" in node) {
      const items = node.items
        .filter((item) => hasPermission(user, item.permission))
        .map(({ href, labelKey }) => ({ href, label: t(labelKey) }));
      if (items.length > 0) nav.push({ id: node.labelKey, label: t(node.labelKey), items });
    } else if (hasPermission(user, node.permission)) {
      nav.push({ href: node.href, label: t(node.labelKey) });
    }
  }
  const branding = await getBranding();

  return (
    <AdminShell
      user={{ fullName: user.fullName, roleName: tRoles(user.roleCode) }}
      nav={nav}
      branding={{ hotelName: branding.hotelName, logoUrl: branding.logoUrl }}
    >
      {children}
    </AdminShell>
  );
}
