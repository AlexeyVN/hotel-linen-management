import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const BRANDING_KEYS = {
  hotelName: "branding.hotelName",
  logoVersion: "branding.logoVersion",
  logoWidth: "branding.logoWidth",
  logoHeight: "branding.logoHeight",
  responsibleName: "print.responsibleName",
  responsiblePosition: "print.responsiblePosition",
} as const;

export const BRANDING_LOGO_PATH = path.join(process.cwd(), "storage", "branding", "logo.png");

export interface BrandingInfo {
  hotelName: string;
  responsibleName: string;
  responsiblePosition: string;
  logoUrl: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
  logoVersion: string | null;
}

export interface ExcelBranding {
  hotelName: string;
  preparedBy: string;
  responsibleName: string;
  responsiblePosition: string;
  logo?: { buffer: Buffer; width: number; height: number };
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

export async function getBranding(): Promise<BrandingInfo> {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          BRANDING_KEYS.hotelName,
          BRANDING_KEYS.logoVersion,
          BRANDING_KEYS.logoWidth,
          BRANDING_KEYS.logoHeight,
          BRANDING_KEYS.responsibleName,
          BRANDING_KEYS.responsiblePosition,
        ],
      },
    },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const version = map.get(BRANDING_KEYS.logoVersion) ?? null;

  return {
    hotelName: map.get(BRANDING_KEYS.hotelName) ?? "",
    responsibleName: map.get(BRANDING_KEYS.responsibleName) ?? "",
    responsiblePosition: map.get(BRANDING_KEYS.responsiblePosition) ?? "",
    logoUrl: version ? `/api/branding/logo?v=${encodeURIComponent(version)}` : null,
    logoWidth: parseNumber(map.get(BRANDING_KEYS.logoWidth)),
    logoHeight: parseNumber(map.get(BRANDING_KEYS.logoHeight)),
    logoVersion: version,
  };
}

/** Логотип читается с диска; ошибка чтения не ломает Excel-выгрузку. */
export async function getExcelBranding(preparedBy: string): Promise<ExcelBranding> {
  const branding = await getBranding();
  let logo: ExcelBranding["logo"];
  if (branding.logoUrl) {
    try {
      const buffer = await fs.readFile(BRANDING_LOGO_PATH);
      logo = {
        buffer,
        width: branding.logoWidth ?? 160,
        height: branding.logoHeight ?? 60,
      };
    } catch {
      logo = undefined;
    }
  }
  return {
    hotelName: branding.hotelName,
    preparedBy,
    responsibleName: branding.responsibleName,
    responsiblePosition: branding.responsiblePosition,
    logo,
  };
}
