import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  CURRENCY_SETTING_KEY,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_SETTING_KEY,
  fallbackCurrencyFromEnv,
  fallbackLocaleFromEnv,
  isCurrency,
  isLocale,
  type Currency,
  type Locale,
} from "./config";

/**
 * Глобальный locale установки.
 * Приоритет: Setting → cookie → env DEFAULT_LOCALE → en.
 * Cookie нужен для страницы входа и первого рендера; Setting — главный
 * источник для глобального выбора администратора.
 */
export const getConfiguredLocale = cache(async (): Promise<Locale> => {
  const setting = await prisma.setting.findUnique({ where: { key: LOCALE_SETTING_KEY } });
  if (isLocale(setting?.value)) return setting.value;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;

  return fallbackLocaleFromEnv();
});

export const getConfiguredCurrency = cache(async (): Promise<Currency> => {
  const setting = await prisma.setting.findUnique({ where: { key: CURRENCY_SETTING_KEY } });
  if (isCurrency(setting?.value)) return setting.value;
  return fallbackCurrencyFromEnv();
});

export async function getCurrencyLocked(): Promise<boolean> {
  const count = await prisma.operation.count();
  return count > 0;
}

export async function getUiSettings(): Promise<{
  locale: Locale;
  currency: Currency;
  currencyLocked: boolean;
}> {
  const [locale, currency, currencyLocked] = await Promise.all([
    getConfiguredLocale(),
    getConfiguredCurrency(),
    getCurrencyLocked(),
  ]);
  return { locale, currency, currencyLocked };
}

export async function setConfiguredLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) throw new Error("Unsupported locale");
  await prisma.setting.upsert({
    where: { key: LOCALE_SETTING_KEY },
    update: { value: locale },
    create: { key: LOCALE_SETTING_KEY, value: locale },
  });
}

export async function setConfiguredCurrency(currency: Currency): Promise<void> {
  if (!isCurrency(currency)) throw new Error("Unsupported currency");
  const used = await prisma.operation.count();
  if (used > 0) {
    throw new Error("Currency cannot be changed after the first operation");
  }
  await prisma.setting.upsert({
    where: { key: CURRENCY_SETTING_KEY },
    update: { value: currency },
    create: { key: CURRENCY_SETTING_KEY, value: currency },
  });
}

export { DEFAULT_CURRENCY, DEFAULT_LOCALE };
