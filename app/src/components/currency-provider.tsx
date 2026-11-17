"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/i18n/config";

const CurrencyContext = createContext<Currency>("USD");

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: Currency;
  children: ReactNode;
}) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): Currency {
  return useContext(CurrencyContext);
}

export function useMoney() {
  const locale = useLocale();
  const currency = useCurrency();
  return (minorUnits: number) => formatMoney(minorUnits, locale, currency);
}
