export const LOCALES = ["ru", "en", "es", "it", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const DEFAULT_CURRENCY = "USD" as const;
export const CURRENCIES = ["USD", "EUR", "RUB"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_SETTING_KEY = "ui.locale";
export const CURRENCY_SETTING_KEY = "ui.currency";

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  es: "Español",
  it: "Italiano",
  de: "Deutsch",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  RUB: "RUB — российский рубль",
  USD: "USD — US dollar",
  EUR: "EUR — euro",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isCurrency(value: string | undefined | null): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function fallbackLocaleFromEnv(): Locale {
  const value = process.env.APP_DEFAULT_LOCALE;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function fallbackCurrencyFromEnv(): Currency {
  const value = process.env.APP_DEFAULT_CURRENCY;
  return isCurrency(value) ? value : DEFAULT_CURRENCY;
}
