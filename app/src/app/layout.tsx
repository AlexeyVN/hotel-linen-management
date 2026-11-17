import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CurrencyProvider } from "@/components/currency-provider";
import { getAccent } from "@/lib/accent";
import { getBranding } from "@/lib/branding";
import { getConfiguredCurrency, getConfiguredLocale } from "@/i18n/get-locale";

export async function generateMetadata(): Promise<Metadata> {
  const [branding, locale] = await Promise.all([
    getBranding(),
    getConfiguredLocale(),
  ]);
  const t = await getTranslations({ locale, namespace: "meta" });
  const hotelName = branding.hotelName.trim() || "Hotel";
  return {
    title: {
      default: t("title", { hotel: hotelName }),
      template: `%s — ${hotelName}`,
    },
    applicationName: hotelName,
    description: t("description", { hotel: hotelName }),
    manifest: "/api/manifest",
    appleWebApp: {
      capable: true,
      title: hotelName,
      statusBarStyle: "default",
    },
    icons: {
      icon: "/icons/icon-192.png",
      apple: "/icons/icon-192.png",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E2A47",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [accent, locale, messages, currency] = await Promise.all([
    getAccent(),
    getConfiguredLocale(),
    getMessages(),
    getConfiguredCurrency(),
  ]);
  const style = {
    "--primary": accent.hsl,
    "--primary-foreground": "0 0% 100%",
  } as CSSProperties;

  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased" style={style}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CurrencyProvider currency={currency}>
            <Providers>{children}</Providers>
          </CurrencyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
