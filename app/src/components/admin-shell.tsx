"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

export function AdminShell({
  user,
  nav,
  branding,
  children,
}: {
  user: { fullName: string; roleName: string };
  nav: NavEntry[];
  branding?: { hotelName: string; logoUrl: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tCommon = useTranslations("common");
  const activeGroup = nav
    .filter(isGroup)
    .find((group) => group.items.some((item) => isActive(pathname, item.href)))?.label;

  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup] : []);
  useEffect(() => {
    if (activeGroup) {
      setOpenGroups((previous) =>
        previous.includes(activeGroup) ? previous : [...previous, activeGroup],
      );
    }
  }, [activeGroup]);

  function toggleGroup(label: string) {
    setOpenGroups((previous) =>
      previous.includes(label) ? previous.filter((value) => value !== label) : [...previous, label],
    );
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-64 md:border-r md:bg-card">
        <div className="border-b px-4 py-4">
          <BrandMark
            logoUrl={branding?.logoUrl}
            fallback={branding?.hotelName || "Учёт белья"}
            className="h-10 w-auto max-w-[160px] object-contain"
          />
          {branding?.logoUrl && branding.hotelName ? (
            <p className="mt-1 text-xs font-medium">{branding.hotelName}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {user.fullName} · {user.roleName}
          </p>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {nav.map((entry) => {
            if (!isGroup(entry)) {
              const active = isActive(pathname, entry.href);
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {entry.label}
                </Link>
              );
            }

            const open = openGroups.includes(entry.label);
            const groupActive = entry.items.some((item) => isActive(pathname, item.href));
            return (
              <div key={entry.label}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleGroup(entry.label)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                    groupActive && !open
                      ? "bg-muted font-medium"
                      : "hover:bg-muted",
                  )}
                >
                  <span>{entry.label}</span>
                  <span aria-hidden className="text-xs text-muted-foreground">
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open ? (
                  <div className="mt-1 space-y-1 border-l pl-2">
                    {entry.items.map((item) => {
                      const active = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "block rounded-md px-3 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            {tCommon("logout")}
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
