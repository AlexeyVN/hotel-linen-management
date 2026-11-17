import { getTranslations } from "next-intl/server";
import { BrandingSettings } from "@/components/branding-settings";
import { LanguageCurrencySettings } from "@/components/language-currency-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShowDatesToggle } from "@/components/show-dates-toggle";
import { getConfiguredLocale } from "@/i18n/get-locale";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getShowDates } from "@/lib/settings";

export default async function SettingsPage() {
  const [showDates, user, locale] = await Promise.all([
    getShowDates(),
    getCurrentUser(),
    getConfiguredLocale(),
  ]);
  const canManageBranding = Boolean(user && hasPermission(user, "settings.branding"));
  const t = await getTranslations({ locale, namespace: "settings" });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("display")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ShowDatesToggle initial={showDates} />
          <p className="text-xs text-muted-foreground">{t("showDatesHint")}</p>
        </CardContent>
      </Card>

      <LanguageCurrencySettings />

      {canManageBranding ? <BrandingSettings /> : null}
    </div>
  );
}
