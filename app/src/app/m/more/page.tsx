import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { OfflineQueuePanel } from "@/components/offline-queue-panel";
import { getCurrentUser } from "@/lib/auth";

const LINKS = [
  { href: "/m/audit", title: "Инвентаризация", subtitle: "Остатки и расхождения по номеру" },
  { href: "/m/distribute", title: "Раздача", subtitle: "Бельё и химия со склада" },
  { href: "/m/scan", title: "Сканировать QR", subtitle: "Номер или позиция по метке" },
];

export default async function MaidMorePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Ещё</h1>
        <p className="text-sm text-muted-foreground">{user?.fullName}</p>
      </header>

      <section className="space-y-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between rounded-xl border bg-card p-4 active:bg-muted"
          >
            <span>
              <span className="block text-sm font-medium">{link.title}</span>
              <span className="text-xs text-muted-foreground">{link.subtitle}</span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        ))}
      </section>

      <OfflineQueuePanel />

      <LogoutButton />

      <p className="text-center text-xs text-muted-foreground">
        Учёт белья · версия 1.3
      </p>
    </div>
  );
}
