/**
 * Хаускипинг: типы, приоритеты, статусы задач и номера (ТЗ v2.4).
 * Переходы статусов и сортировка — чистые функции, тестируются отдельно.
 */

export const CLEANING_TYPES = {
  DAILY: "DAILY",
  ON_DEMAND: "ON_DEMAND",
  GENERAL: "GENERAL",
} as const;
export type CleaningType = (typeof CLEANING_TYPES)[keyof typeof CLEANING_TYPES];

export const TASK_PRIORITIES = {
  URGENT: "URGENT",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[keyof typeof TASK_PRIORITIES];

export const TASK_STATUSES = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;
export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];

export const ROOM_CLEANING_STATUSES = {
  CLEAN: "CLEAN",
  DIRTY: "DIRTY",
  INSPECTED: "INSPECTED",
  OUT_OF_ORDER: "OUT_OF_ORDER",
} as const;
export type RoomCleaningStatus =
  (typeof ROOM_CLEANING_STATUSES)[keyof typeof ROOM_CLEANING_STATUSES];

export const TASK_STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  DONE: "Выполнена",
  CANCELLED: "Отменена",
};

export const CLEANING_TYPE_LABELS: Record<string, string> = {
  DAILY: "Ежедневная",
  ON_DEMAND: "По требованию",
  GENERAL: "Генеральная",
};

export const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Срочно",
  MEDIUM: "Средний",
  LOW: "Низкий",
};

export const ROOM_STATUS_LABELS: Record<string, string> = {
  CLEAN: "Чистый",
  DIRTY: "Грязный",
  INSPECTED: "Инспектирован",
  OUT_OF_ORDER: "В ремонте",
};

const TRANSITIONS: Record<string, readonly string[]> = {
  NEW: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string): boolean {
  if (from === to) return false;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function priorityRank(priority: string): number {
  if (priority === "URGENT") return 0;
  if (priority === "MEDIUM") return 1;
  if (priority === "LOW") return 2;
  return 3;
}

const STATUS_RANK: Record<string, number> = { NEW: 0, IN_PROGRESS: 1, DONE: 2, CANCELLED: 3 };

export interface TaskLike {
  priority: string;
  status: string;
  createdAt: string | Date;
}

/** Активные задачи выше завершённых; внутри — по приоритету и времени создания. */
export function sortTasks<T extends TaskLike>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const statusDiff = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export interface CompletedTaskLike {
  status: string;
  startedAt: string | Date | null;
  finishedAt: string | Date | null;
}

export interface CleaningSummary {
  total: number;
  done: number;
  inProgress: number;
  cancelled: number;
  avgMinutes: number | null;
}

export function summarizeCleaning(tasks: readonly CompletedTaskLike[]): CleaningSummary {
  let done = 0;
  let inProgress = 0;
  let cancelled = 0;
  const durations: number[] = [];

  for (const task of tasks) {
    if (task.status === "DONE") {
      done += 1;
      if (task.startedAt && task.finishedAt) {
        const minutes =
          (new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime()) / 60_000;
        if (minutes >= 0) durations.push(minutes);
      }
    } else if (task.status === "IN_PROGRESS") {
      inProgress += 1;
    } else if (task.status === "CANCELLED") {
      cancelled += 1;
    }
  }

  const avgMinutes =
    durations.length === 0
      ? null
      : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);

  return { total: tasks.length, done, inProgress, cancelled, avgMinutes };
}
