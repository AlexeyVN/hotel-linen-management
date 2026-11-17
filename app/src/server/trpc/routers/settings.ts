import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CURRENCIES, LOCALES } from "@/i18n/config";
import {
  getUiSettings,
  setConfiguredCurrency,
  setConfiguredLocale,
} from "@/i18n/get-locale";
import { ACCENT_SETTING_KEY, contrastWithWhite, getAccent, normalizeHex } from "@/lib/accent";
import { BRANDING_KEYS, getBranding } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { SHOW_DATES_KEY } from "@/lib/settings";
import { permissionProcedure, router } from "../trpc";

const brandingText = z.string().trim().max(120);

async function upsertSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export const settingsRouter = router({
  get: permissionProcedure("settings.ui").query(async () => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: [SHOW_DATES_KEY] } },
    });
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const ui = await getUiSettings();
    return {
      showDates: map.get(SHOW_DATES_KEY) !== "false",
      locale: ui.locale,
      currency: ui.currency,
      currencyLocked: ui.currencyLocked,
    };
  }),

  setLocale: permissionProcedure("settings.ui")
    .input(z.object({ locale: z.enum(LOCALES) }))
    .mutation(async ({ input }) => {
      await setConfiguredLocale(input.locale);
      return { ok: true, locale: input.locale };
    }),

  setCurrency: permissionProcedure("settings.ui")
    .input(z.object({ currency: z.enum(CURRENCIES) }))
    .mutation(async ({ input }) => {
      try {
        await setConfiguredCurrency(input.currency);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Currency change failed";
        throw new TRPCError({
          code: message.includes("first operation") ? "PRECONDITION_FAILED" : "BAD_REQUEST",
          message,
        });
      }
      return { ok: true, currency: input.currency };
    }),

  setShowDates: permissionProcedure("settings.ui")
    .input(z.object({ showDates: z.boolean() }))
    .mutation(async ({ input }) => {
      await prisma.setting.upsert({
        where: { key: SHOW_DATES_KEY },
        update: { value: input.showDates ? "true" : "false" },
        create: { key: SHOW_DATES_KEY, value: input.showDates ? "true" : "false" },
      });
      return { ok: true };
    }),

  brandingGet: permissionProcedure("settings.branding").query(async () => getBranding()),

  accentGet: permissionProcedure("settings.branding").query(async () => getAccent()),

  setAccent: permissionProcedure("settings.branding")
    .input(z.object({ hex: z.string().min(4).max(7) }))
    .mutation(async ({ input }) => {
      const hex = normalizeHex(input.hex);
      if (!hex) throw new Error("Цвет должен быть в формате #RRGGBB");
      const contrast = contrastWithWhite(hex);
      if (contrast < 4.5) {
        throw new Error(
          `Слишком светлый цвет для белого текста (контраст ${contrast.toFixed(2)}:1, нужно ≥ 4.5:1)`,
        );
      }
      await upsertSetting(ACCENT_SETTING_KEY, hex);
      return { ok: true, accent: await getAccent() };
    }),

  brandingUpdate: permissionProcedure("settings.branding")
    .input(
      z.object({
        hotelName: brandingText.optional(),
        responsibleName: brandingText.optional(),
        responsiblePosition: brandingText.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const updates: Array<[string, string]> = [];
      if (input.hotelName !== undefined) updates.push([BRANDING_KEYS.hotelName, input.hotelName]);
      if (input.responsibleName !== undefined) {
        updates.push([BRANDING_KEYS.responsibleName, input.responsibleName]);
      }
      if (input.responsiblePosition !== undefined) {
        updates.push([BRANDING_KEYS.responsiblePosition, input.responsiblePosition]);
      }
      for (const [key, value] of updates) await upsertSetting(key, value);
      return { ok: true, branding: await getBranding() };
    }),
});
