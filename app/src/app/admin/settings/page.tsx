import { BrandingSettings } from "@/components/branding-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShowDatesToggle } from "@/components/show-dates-toggle";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getShowDates } from "@/lib/settings";

export default async function SettingsPage() {
  const [showDates, user] = await Promise.all([getShowDates(), getCurrentUser()]);
  const canManageBranding = Boolean(user && hasPermission(user, "settings.branding"));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-sm text-muted-foreground">
          Общие параметры интерфейса. На расчёты скрытие дат не влияет.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Отображение</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ShowDatesToggle initial={showDates} />
          <p className="text-xs text-muted-foreground">
            При выключении колонки «Дата» скрываются в складе, документах и отчётах. Дата
            документа и дата поступления продолжают храниться и используются в расчётах.
          </p>
        </CardContent>
      </Card>

      {canManageBranding ? <BrandingSettings /> : null}
    </div>
  );
}
