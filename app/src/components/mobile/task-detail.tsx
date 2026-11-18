"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";

interface ChecklistItemView {
  id: string;
  text: string;
  photoRequired: boolean;
  extraOptionText: string | null;
  answer: string | null;
  comment: string | null;
  photoUrl: string | null;
  answeredByName: string | null;
}

interface TaskDetail {
  id: string;
  roomNumber: string;
  floorLabel: string;
  roomTypeName: string;
  roomStatus: string;
  type: string;
  priority: string;
  status: string;
  plannedMinutes: number | null;
  comment: string | null;
  checklist: {
    name: string;
    items: ChecklistItemView[];
    progress: { total: number; answered: number; complete: boolean; photosMissing: number };
  } | null;
}

export function MobileTaskDetail({ taskId }: { taskId: string }) {
  const t = useTranslations("mobile");
  const tc = useTranslations("cleaning");
  const utils = trpc.useUtils();
  const query = trpc.cleaning.get.useQuery({ taskId });
  const setStatus = trpc.cleaning.setStatus.useMutation();
  const answerMutation = trpc.cleaning.answer.useMutation();
  const addComment = trpc.cleaning.addComment.useMutation();

  const [online, setOnline] = useState(true);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const typeLabels: Record<string, string> = {
    DAILY: tc("daily"),
    ON_DEMAND: tc("onDemand"),
    GENERAL: tc("general"),
  };
  const priorityLabels: Record<string, string> = {
    URGENT: tc("urgent"),
    MEDIUM: tc("medium"),
    LOW: tc("low"),
  };
  const statusLabels: Record<string, string> = {
    NEW: tc("taskNew"),
    IN_PROGRESS: tc("taskInProgress"),
    DONE: tc("taskDone"),
    CANCELLED: tc("taskCancelled"),
  };
  const roomStatusLabels: Record<string, string> = {
    CLEAN: tc("clean"),
    DIRTY: tc("dirty"),
    INSPECTED: tc("inspected"),
    OUT_OF_ORDER: tc("outOfOrder"),
  };
  const answerLabels: Record<string, string> = {
    YES: t("checklistAnswer.yes"),
    NO: t("checklistAnswer.no"),
    EXTRA: t("checklistAnswer.extra"),
  };

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const task = query.data as TaskDetail | undefined;

  useEffect(() => {
    if (task) setComment(task.comment ?? "");
  }, [task]);

  async function refresh() {
    await Promise.all([
      utils.cleaning.get.invalidate({ taskId }),
      utils.cleaning.listMine.invalidate(),
      utils.cleaning.myRooms.invalidate(),
      utils.cleaning.dashboard.invalidate(),
    ]);
  }

  async function changeStatus(status: "IN_PROGRESS" | "DONE" | "CANCELLED") {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await setStatus.mutateAsync({ taskId, status });
      setNotice(
        status === "DONE"
          ? t("taskDetail.noticeDone")
          : status === "CANCELLED"
            ? t("taskDetail.noticeCancelled")
            : t("taskDetail.noticeInProgress"),
      );
      await refresh();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : t("taskDetail.errorStatus"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(itemId: string, value: "YES" | "NO" | "EXTRA") {
    if (!online) {
      setError(t("taskDetail.errorChecklistOffline"));
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const result = await answerMutation.mutateAsync({ taskId, itemId, answer: value });
      setNotice(
        result.progress.complete
          ? t("taskDetail.noticeChecklistComplete")
          : t("taskDetail.noticeAnswered", {
              answered: result.progress.answered,
              total: result.progress.total,
            }),
      );
      await refresh();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : t("taskDetail.errorAnswer"));
    }
  }

  async function uploadPhoto(itemId: string, file: File | null) {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (!online) {
      setError(t("errors.photoOffline"));
      return;
    }
    setUploadingItem(itemId);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/cleaning/tasks/${taskId}/items/${itemId}/photo`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? t("errors.photoUpload"));
      }
      setNotice(t("taskDetail.noticePhotoUploaded"));
      await refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : t("errors.photoUploadGeneric"),
      );
    } finally {
      setUploadingItem(null);
    }
  }

  async function saveComment() {
    setError(null);
    setNotice(null);
    try {
      await addComment.mutateAsync({ taskId, comment });
      setNotice(t("taskDetail.noticeCommentSaved"));
      await refresh();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : t("taskDetail.errorCommentSave"),
      );
    }
  }

  if (query.isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">{t("taskDetail.loading")}</p>;
  }
  if (!task) {
    return (
      <div className="space-y-3 p-4">
        <p role="alert" className="text-sm text-destructive">
          {query.error?.message ?? t("taskDetail.notFound")}
        </p>
        <Link href="/m/tasks" className="text-sm text-primary underline">
          {t("taskDetail.back")}
        </Link>
      </div>
    );
  }

  const isOpen = task.status === "NEW" || task.status === "IN_PROGRESS";
  const checklist = task.checklist;

  return (
    <div className="space-y-4 p-4">
      <Link href="/m/tasks" className="text-sm text-primary underline">
        {t("taskDetail.back")}
      </Link>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold">
          {t("labels.roomNumber", { number: task.roomNumber })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("labels.floor", { floor: task.floorLabel })} · {task.roomTypeName} ·{" "}
          {roomStatusLabels[task.roomStatus] ?? task.roomStatus}
        </p>
        <p className="text-sm">
          {typeLabels[task.type] ?? task.type}
          {task.plannedMinutes
            ? ` · ${t("labels.planMinutes", { minutes: task.plannedMinutes })}`
            : ""}
          {" · "}
          <span
            className={
              task.priority === "URGENT"
                ? "text-destructive"
                : task.priority === "MEDIUM"
                  ? "text-amber-700"
                  : "text-green-700"
            }
          >
            {priorityLabels[task.priority] ?? task.priority}
          </span>
          {" · "}
          {statusLabels[task.status] ?? task.status}
        </p>
        {!online ? (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            {t("taskDetail.offlineHint")}
          </p>
        ) : null}
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      {checklist ? (
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{checklist.name}</h2>
            <span className="text-xs text-muted-foreground">
              {checklist.progress.answered} / {checklist.progress.total}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${
                  checklist.progress.total === 0
                    ? 0
                    : Math.round(
                        (checklist.progress.answered / checklist.progress.total) * 100,
                      )
                }%`,
              }}
            />
          </div>

          <ul className="mt-3 space-y-3">
            {checklist.items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {item.text}
                  {item.photoRequired ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {t("taskDetail.photoRequired")}
                    </span>
                  ) : null}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["YES", "NO"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={!isOpen}
                      onClick={() => submitAnswer(item.id, value)}
                      className={
                        item.answer === value
                          ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                          : "rounded-full border px-3 py-1 text-xs"
                      }
                    >
                      {answerLabels[value]}
                    </button>
                  ))}
                  {item.extraOptionText ? (
                    <button
                      type="button"
                      disabled={!isOpen}
                      onClick={() => submitAnswer(item.id, "EXTRA")}
                      className={
                        item.answer === "EXTRA"
                          ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                          : "rounded-full border px-3 py-1 text-xs"
                      }
                    >
                      {item.extraOptionText}
                    </button>
                  ) : null}
                </div>

                {item.photoRequired ? (
                  <div className="mt-2 flex items-center gap-2">
                    {item.photoUrl ? (
                      <a
                        href={item.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-14 w-14 overflow-hidden rounded border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.photoUrl}
                          alt={t("taskDetail.photoAlt")}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("taskDetail.noPhoto")}</span>
                    )}
                    {isOpen ? (
                      <label className="text-xs text-primary underline">
                        {uploadingItem === item.id
                          ? t("taskDetail.uploading")
                          : t("taskDetail.addPhoto")}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingItem === item.id || !online}
                          onChange={(event) => {
                            void uploadPhoto(item.id, event.target.files?.[0] ?? null);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">{t("taskDetail.comment")}</h2>
        <Input
          value={comment}
          maxLength={300}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t("taskDetail.commentPlaceholder")}
          className="mt-2 h-11"
        />
        <Button variant="outline" className="mt-2 h-11 w-full" onClick={saveComment}>
          {t("taskDetail.saveComment")}
        </Button>
      </section>

      {isOpen ? (
        <section className="space-y-2">
          {task.status === "NEW" ? (
            <Button className="h-12 w-full text-base" disabled={busy} onClick={() => changeStatus("IN_PROGRESS")}>
              {t("tasks.take")}
            </Button>
          ) : (
            <Button
              className="h-12 w-full text-base"
              disabled={busy || (checklist ? !checklist.progress.complete : false)}
              onClick={() => changeStatus("DONE")}
            >
              {checklist && !checklist.progress.complete
                ? t("taskDetail.fillChecklist", {
                    answered: checklist.progress.answered,
                    total: checklist.progress.total,
                  })
                : t("taskDetail.completeTask")}
            </Button>
          )}
          <Button
            variant="outline"
            className="h-11 w-full"
            disabled={busy}
            onClick={() => changeStatus("CANCELLED")}
          >
            {t("taskDetail.refuse")}
          </Button>
        </section>
      ) : (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          {t("taskDetail.closed", {
            status: statusLabels[task.status] ?? task.status,
          })}
        </p>
      )}
    </div>
  );
}
