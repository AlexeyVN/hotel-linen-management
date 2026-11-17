import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { getConfiguredLocale } from "@/i18n/get-locale";
import { getCurrentUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { defaultRouteForRole } from "@/lib/rbac";
import { safeInternalPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(defaultRouteForRole(user.roleCode));

  const params = await searchParams;
  const callbackUrl = safeInternalPath(params.callbackUrl);
  const locale = await getConfiguredLocale();
  const [branding, t] = await Promise.all([
    getBranding(),
    getTranslations({ locale, namespace: "login" }),
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex justify-center">
          <BrandMark
            logoUrl={branding.logoUrl}
            fallback=""
            className="max-h-14 w-auto max-w-[220px] object-contain"
          />
        </div>
        <h1 className="text-xl font-semibold">{branding.hotelName || t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("heading")}</p>
        <div className="mt-6">
          <LoginForm callbackUrl={callbackUrl} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t("hint")}</p>
      </div>
    </main>
  );
}
