import { getConfiguredCurrency } from "@/i18n/get-locale";

/** 1C integration uses RUB prices; other installation currencies are unsupported. */
export async function assertRubCurrency(): Promise<void> {
  const currency = await getConfiguredCurrency();
  if (currency !== "RUB") {
    throw new Error("1C integration is available only when the accounting currency is RUB");
  }
}
