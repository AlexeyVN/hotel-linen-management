/** Деньги в проекте хранятся в копейках (Int), чтобы не терять точность. */

const RUB = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 185000 → «1 850,00 ₽» */
export function formatKopecks(kopecks: number): string {
  return `${RUB.format(kopecks / 100)} ₽`;
}

/** Строка из формы («1 850,50», «1850.5») → копейки; null — некорректно. */
export function parseRublesToKopecks(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const rubles = Number(normalized);
  if (!Number.isFinite(rubles) || rubles < 0) return null;
  const kopecks = Math.round(rubles * 100);
  if (!Number.isSafeInteger(kopecks) || kopecks > 1_000_000_000_00) return null;
  return kopecks;
}

/** Копейки → строка для input (без «₽»). */
export function kopecksToInput(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}
