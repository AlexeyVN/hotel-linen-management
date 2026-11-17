/**
 * Чек-листы уборки (ТЗ v2.5): прогресс и гейт завершения задачи.
 * Пункт считается закрытым, если есть ответ и (при обязательном фото) фото.
 */

export const CHECKLIST_ANSWERS = {
  YES: "YES",
  NO: "NO",
  EXTRA: "EXTRA",
} as const;
export type ChecklistAnswerValue =
  (typeof CHECKLIST_ANSWERS)[keyof typeof CHECKLIST_ANSWERS];

export const CHECKLIST_ANSWER_LABELS: Record<string, string> = {
  YES: "Да",
  NO: "Нет",
  EXTRA: "Н/П",
};

export interface ChecklistItemLike {
  id: string;
  text: string;
  photoRequired: boolean;
}

export interface ChecklistAnswerLike {
  itemId: string;
  answer: string;
  photoFileName?: string | null;
}

export interface ChecklistProgress {
  total: number;
  answered: number;
  photosRequired: number;
  photosMissing: number;
  complete: boolean;
  missingIds: string[];
  missingPhotoIds: string[];
}

export function computeChecklistProgress(
  items: readonly ChecklistItemLike[],
  answers: readonly ChecklistAnswerLike[],
): ChecklistProgress {
  const byItem = new Map(answers.map((answer) => [answer.itemId, answer]));
  const missingIds: string[] = [];
  const missingPhotoIds: string[] = [];
  let answered = 0;
  let photosRequired = 0;

  for (const item of items) {
    const answer = byItem.get(item.id);
    if (!answer) {
      missingIds.push(item.id);
      continue;
    }
    answered += 1;
    if (item.photoRequired) {
      photosRequired += 1;
      if (!answer.photoFileName) missingPhotoIds.push(item.id);
    }
  }

  const complete =
    items.length > 0 && missingIds.length === 0 && missingPhotoIds.length === 0;

  return {
    total: items.length,
    answered,
    photosRequired,
    photosMissing: missingPhotoIds.length,
    complete,
    missingIds,
    missingPhotoIds,
  };
}

/** Задачу без чек-листа можно завершать; с чек-листом — только когда всё закрыто. */
export function canCompleteTask(
  items: readonly ChecklistItemLike[],
  answers: readonly ChecklistAnswerLike[],
): boolean {
  if (items.length === 0) return true;
  return computeChecklistProgress(items, answers).complete;
}
