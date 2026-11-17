/** Палитра и цветовые расчёты без серверных зависимостей (можно импортировать в клиент). */

export interface AccentOption {
  id: string;
  label: string;
  hex: string;
}

/** Тёмные оттенки: белый текст на кнопках проходит контраст AA. */
export const ACCENT_COLORS: AccentOption[] = [
  { id: "blue", label: "Синий", hex: "#2563eb" },
  { id: "indigo", label: "Индиго", hex: "#4f46e5" },
  { id: "violet", label: "Фиолетовый", hex: "#7c3aed" },
  { id: "teal", label: "Бирюзовый", hex: "#0f766e" },
  { id: "emerald", label: "Изумрудный", hex: "#047857" },
  { id: "amber", label: "Янтарный", hex: "#b45309" },
  { id: "rose", label: "Розовый", hex: "#be123c" },
  { id: "slate", label: "Графит", hex: "#334155" },
];

export const DEFAULT_ACCENT = ACCENT_COLORS[0].hex;

export function normalizeHex(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return null;
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** Контраст цвета с белым (foreground кнопок). */
export function contrastWithWhite(hex: string): number {
  const normalized = normalizeHex(hex);
  if (!normalized) return 1;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return 1.05 / (luminance + 0.05);
}

export function hexToHsl(hex: string): string {
  const normalized = normalizeHex(hex) ?? DEFAULT_ACCENT;
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}
