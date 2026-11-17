import { prisma } from "@/lib/prisma";

export const SHOW_DATES_KEY = "ui.showDates";

export async function getShowDates(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: SHOW_DATES_KEY } });
  return row?.value !== "false";
}
