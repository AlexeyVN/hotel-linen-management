import { getTranslations } from "next-intl/server";
import { OperationForm } from "@/components/operation-form";

export default async function OperationPage() {
  const t = await getTranslations("operations");
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{t("distributeTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("distributeIntro")}
        </p>
      </header>
      <OperationForm mode="DISTRIBUTE" />
    </div>
  );
}
