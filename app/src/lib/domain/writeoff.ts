/**
 * Причина списания: обязательна, источник — справочник ИЛИ свободный текст
 * (ТЗ v2.3 §0.1, §7.5). Если выбрана причина и дописан текст — сохраняем оба.
 */

export interface ReasonOption {
  code: string;
  name: string;
}

export interface ReasonInput {
  reasonCode?: string | null;
  reasonText?: string | null;
}

export type ReasonResult =
  | { ok: true; reason: string }
  | { ok: false; error: string };

export const MAX_REASON_LENGTH = 200;

export function resolveWriteOffReason(
  input: ReasonInput,
  reasons: readonly ReasonOption[],
): ReasonResult {
  const code = (input.reasonCode ?? "").trim();
  const text = (input.reasonText ?? "").trim();

  if (text.length > MAX_REASON_LENGTH) {
    return { ok: false, error: `Причина не длиннее ${MAX_REASON_LENGTH} символов` };
  }

  if (code) {
    const found = reasons.find((reason) => reason.code === code);
    if (!found) {
      return { ok: false, error: "Причина списания не найдена в справочнике" };
    }
    return { ok: true, reason: text ? `${found.name}: ${text}` : found.name };
  }

  if (!text) {
    return { ok: false, error: "Причина списания обязательна" };
  }

  return { ok: true, reason: text };
}
