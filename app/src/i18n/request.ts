import { getRequestConfig } from "next-intl/server";
import { getConfiguredLocale } from "@/i18n/get-locale";
import { isLocale } from "@/i18n/config";

export default getRequestConfig(async () => {
  const selected = await getConfiguredLocale();
  const locale = isLocale(selected) ? selected : "en";
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    onError(error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[i18n]", error);
      }
    },
    getMessageFallback({ key, namespace }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});
