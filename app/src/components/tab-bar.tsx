"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/m", key: "home", icon: "🏠" },
  { href: "/m/tasks", key: "tasks", icon: "🧹" },
  { href: "/m/rooms", key: "rooms", icon: "🚪" },
  { href: "/m/more", key: "more", icon: "⋯" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function TabBar() {
  const t = useTranslations("mobile");
  const pathname = usePathname();
  const labels: Record<TabKey, string> = {
    home: t("tab.home"),
    tasks: t("tab.tasks"),
    rooms: t("tab.rooms"),
    more: t("tab.more"),
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t bg-card pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active =
            tab.href === "/m" ? pathname === "/m" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span aria-hidden className="text-lg leading-none">
                  {tab.icon}
                </span>
                {labels[tab.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
