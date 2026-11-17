import type { Currency } from "@/i18n/config";

/** Деньги в проекте хранятся в целых минорных единицах (копейки/центы). */
const formatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(locale: string, currency: Currency): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  const existing = formatters.get(key);
  if (existing) return existing;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  formatters.set(key, formatter);
  return formatter;
}

export function formatMoney(minorUnits: number, locale: string, currency: Currency): string {
  return moneyFormatter(locale, currency).format(minorUnits / 100);
}

/** Обратная совместимость для старых вызовов; новые места — formatMoney. */
export function formatKopecks(kopecks: number): string {
  return formatMoney(kopecks, "ru", "RUB");
}

/**
 * Строка из формы → целые минорные единицы.
 * Поддерживает 1 850,50 / 1,850.50 / 1.850,50 / 1850.5.
 * Возвращает null при ошибке.
 */
export function parseRublesToKopecks(value: string): number | null {
  let normalized = value
    .replace(/[^\d.,-]/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!normalized || normalized === "-") return null;

  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  let decimal = -1;
  if (comma >= 0 && dot >= 0) {
    decimal = Math.max(comma, dot);
  } else if (comma >= 0 || dot >= 0) {
    const index = comma >= 0 ? comma : dot;
    const after = normalized.length - index - 1;
    const digits = normalized.replace(/[^\d]/g, "");
    // 1.850 и 1,850 трактуем как тысячи, если после разделителя ровно 3 цифры.
    if (after === 3 && digits.length > 3) decimal = -1;
    else decimal = index;
  }

  let integerPart = normalized;
  let fractionPart = "";
  if (decimal >= 0) {
    integerPart = normalized.slice(0, decimal);
    fractionPart = normalized.slice(decimal + 1);
  }
  integerPart = integerPart.replace(/[.,]/g, "");
  fractionPart = fractionPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(integerPart)) return null;
  if (fractionPart && !/^\d+$/.test(fractionPart)) return null;

  const rubles = Number(integerPart + (fractionPart ? "." + fractionPart.slice(0, 2) : ""));
  if (!Number.isFinite(rubles) || rubles < 0) return null;
  const minor = Math.round(rubles * 100);
  if (!Number.isSafeInteger(minor) || minor > 1_000_000_000_00) return null;
  return minor;
}

/** Минорные единицы → строка для input (без символа валюты). */
export function kopecksToInput(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}
