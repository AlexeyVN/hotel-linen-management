/**
 * Статистика горничных (M9): статус работы и выполнение плана за дату.
 * Чистые функции — тестируются node --test, сервер использует их же.
 */

export type MaidWorkStatus = "INACTIVE" | "WORKING" | "ON_SHIFT" | "OFF_SHIFT";

export interface MaidStatusInput {
  isActive: boolean;
  hasOpenShift: boolean;
  hasInProgress: boolean;
}

/** Приоритет: неактивна → в работе → на смене → не на смене. */
export function maidWorkStatus(input: MaidStatusInput): MaidWorkStatus {
  if (!input.isActive) return "INACTIVE";
  if (input.hasInProgress) return "WORKING";
  if (input.hasOpenShift) return "ON_SHIFT";
  return "OFF_SHIFT";
}

export const MAID_STATUS_LABELS: Record<MaidWorkStatus, string> = {
  INACTIVE: "Неактивна",
  WORKING: "В работе",
  ON_SHIFT: "На смене",
  OFF_SHIFT: "Не на смене",
};

export interface MaidPlanTask {
  status: string;
  roomId: string;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
}

export interface MaidPlanSummary {
  /** План: NEW + IN_PROGRESS + DONE (отменённые не входят). */
  plan: number;
  done: number;
  inProgress: number;
  newTasks: number;
  cancelled: number;
  percent: number | null;
  roomsDone: number;
  avgMinutes: number | null;
}

export function summarizeMaidPlan(tasks: readonly MaidPlanTask[]): MaidPlanSummary {
  let done = 0;
  let inProgress = 0;
  let newTasks = 0;
  let cancelled = 0;
  const rooms = new Set<string>();
  const durations: number[] = [];

  for (const task of tasks) {
    if (task.status === "DONE") {
      done += 1;
      rooms.add(task.roomId);
      if (task.startedAt && task.finishedAt) {
        const minutes =
          (new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime()) / 60_000;
        if (minutes >= 0) durations.push(minutes);
      }
    } else if (task.status === "IN_PROGRESS") {
      inProgress += 1;
    } else if (task.status === "NEW") {
      newTasks += 1;
    } else if (task.status === "CANCELLED") {
      cancelled += 1;
    }
  }

  const plan = done + inProgress + newTasks;
  const percent = plan === 0 ? null : Math.round((done / plan) * 100);
  const avgMinutes =
    durations.length === 0
      ? null
      : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);

  return { plan, done, inProgress, newTasks, cancelled, percent, roomsDone: rooms.size, avgMinutes };
}

/** Уникальные номера, закреплённые за горничной. */
export function uniqueRoomIds(rows: readonly { roomId: string }[]): string[] {
  return [...new Set(rows.map((row) => row.roomId))];
}
