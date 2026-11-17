/** Локальный кэш последних данных для офлайн-экранов (ТЗ §9.1). */
export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Кэш не критичен: при переполнении просто не сохранится.
  }
}
