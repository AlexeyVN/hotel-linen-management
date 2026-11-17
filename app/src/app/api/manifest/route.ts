import type { MetadataRoute } from "next";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const branding = await getBranding();
  const hotelName = branding.hotelName.trim() || "Учёт белья";

  const manifest: MetadataRoute.Manifest = {
    name: `${hotelName} — горничная`,
    short_name: hotelName,
    description: `Инвентаризация номеров и раздача белья в отеле «${hotelName}»`,
    lang: "ru",
    start_url: "/m",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F3EA",
    theme_color: "#0E2A47",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-store",
    },
  });
}
