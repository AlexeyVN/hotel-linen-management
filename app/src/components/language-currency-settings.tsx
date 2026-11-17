"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc-client";
import { CURRENCIES, LOCALES, LOCALE_COOKIE, type Currency, type Locale } from "@/i18n/config";

export function LanguageCurrencySettings() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tLocale = useTranslations("locale");
  const tCurrency = useTranslations("currency");
  const query = trpc.settings.get.useQuery();
  const setLocale = trpc.settings.setLocale.useMutation();
  const setCurrency = trpc.settings.setCurrency.useMutation();

  const [locale, setLocaleState] = useState<Locale>("en");
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = query.data;

  useEffect(() => {
    if (!data) return;
    setLocaleState(data.locale);
    setCurrencyState(data.currency);
  }, [data]);

  async function save() {
    setError(null);
    setNotice(null);
    if (!data) return;
    try {
      if (locale !== data.locale) {
        await setLocale.mutateAsync({ locale });
        document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      }
      if (currency !== data.currency) {
        if (data.currencyLocked) {
          throw new Error(t("currencyLocked"));
        }
        if (!window.confirm(t("currencyConfirm"))) return;
        await setCurrency.mutateAsync({ currency });
      }
      await utils.settings.get.invalidate();
      router.refresh();
      setNotice(locale !== data.locale ? t("languageSaved") : t("currencySaved"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("languageCurrency")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">{t("language")}</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={locale}
              onChange={(event) => setLocaleState(event.target.value as Locale)}
            >
              {LOCALES.map((value) => (
                <option key={value} value={value}>
                  {tLocale(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">{t("currency")}</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 disabled:opacity-60"
              value={currency}
              disabled={Boolean(data?.currencyLocked)}
              onChange={(event) => setCurrencyState(event.target.value as Currency)}
            >
              {CURRENCIES.map((value) => (
                <option key={value} value={value}>
                  {tCurrency(value)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
        {data?.currencyLocked ? (
          <p className="text-sm text-amber-700">{t("currencyLocked")}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("operationsLock")}</p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

        <Button onClick={save} disabled={setLocale.isPending || setCurrency.isPending || !data}>
          {setLocale.isPending || setCurrency.isPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
