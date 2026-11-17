import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ACCENT,
  contrastWithWhite,
  hexToHsl,
  normalizeHex,
} from "@/lib/accent-colors";

export {
  ACCENT_COLORS,
  DEFAULT_ACCENT,
  contrastWithWhite,
  hexToHsl,
  normalizeHex,
} from "@/lib/accent-colors";

export const ACCENT_SETTING_KEY = "ui.accentColor";

export async function getAccent(): Promise<{ hex: string; hsl: string; contrast: number }> {
  const row = await prisma.setting.findUnique({ where: { key: ACCENT_SETTING_KEY } });
  const stored = row ? normalizeHex(row.value) : null;
  const hex = stored && contrastWithWhite(stored) >= 4.5 ? stored : DEFAULT_ACCENT;
  return { hex, hsl: hexToHsl(hex), contrast: Math.round(contrastWithWhite(hex) * 100) / 100 };
}
