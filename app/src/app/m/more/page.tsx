import Link from "next/link";
import { getTranslations } from "next-intl/server";
import packageJson from "../../../../package.json";
import { OfflineQueuePanel } from "@/components/offline-queue-panel";
import { getCurrentUser } from "@/lib/auth";
import { MobileLogoutButton } from "./logout-button";

export default async function MaidMorePage() {
  const user = await getCurrentUser();
  const t = await getTranslations("mobile");

  const links = [
    { href: "/m/audit", title: t("more.audit"), subtitle: t("more.auditSubtitle") },
    {
      href: "/m/distribute",
      title: t("more.distribute"),
      subtitle: t("more.distributeSubtitle"),
    },
    { href: "/m/scan", title: t("more.scan"), subtitle: t("more.scanSubtitle") },
  ];

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{t("more.title")}</h1>
        <p className="text-sm text-muted-foreground">{user?.fullName}</p>
      </header>

      <section className="space-y-2">
        {links.map((link) => (
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

      <MobileLogoutButton />

      <p className="text-center text-xs text-muted-foreground">
        {t("more.footer", { version: packageJson.version })}
      </p>
    </div>
  );
}
