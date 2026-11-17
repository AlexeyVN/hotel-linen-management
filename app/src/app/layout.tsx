import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getAccent } from "@/lib/accent";
import { getBranding } from "@/lib/branding";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  const hotelName = branding.hotelName.trim() || "Учёт белья";

  return {
    title: {
      default: `${hotelName} — отель`,
      template: `%s — ${hotelName}`,
    },
    applicationName: hotelName,
    description: `Учёт постельного белья, химии и инвентаря отеля «${hotelName}»`,
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
  const accent = await getAccent();
  const style = {
    "--primary": accent.hsl,
    "--primary-foreground": "0 0% 100%",
  } as CSSProperties;

  return (
    <html lang="ru">
      <body className="min-h-screen antialiased" style={style}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
