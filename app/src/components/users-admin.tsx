"use client";

import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  MAID: "Горничная",
};

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path d="M4 16h3l9-9-3-3-9 9v3Z" />
      <path d="m11.5 5.5 3 3" />
    </svg>
  );
}

export function UsersAdmin() {
  const utils = trpc.useUtils();
  const usersQuery = trpc.users.list.useQuery();
  const roomsQuery = trpc.rooms.list.useQuery();

  const createUser = trpc.users.create.useMutation();
  const updateProfile = trpc.users.updateProfile.useMutation();
  const updateRole = trpc.users.updateRole.useMutation();
  const setActive = trpc.users.setActive.useMutation();
  const setRooms = trpc.users.setRooms.useMutation();
  const resetPassword = trpc.users.resetPassword.useMutation();

  const [form, setForm] = useState<{
    login: string;
    fullName: string;
    password: string;
    roleCode: "ADMIN" | "MANAGER" | "MAID";
  }>({
    login: "",
    fullName: "",
    password: "",
    roleCode: "MAID",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [passwordOpen, setPasswordOpen] = useState<Record<string, boolean>>({});
  const [roomDraft, setRoomDraft] = useState<Record<string, string[]>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ login: "", fullName: "" });

  const users = usersQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];

  async function refresh() {
    await utils.users.list.invalidate();
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await createUser.mutateAsync(form);
      setForm({ login: "", fullName: "", password: "", roleCode: "MAID" });
      setNotice("Пользователь создан");
      await refresh();
    } catch (mutationError) {
      setError(errorText(mutationError));
    }
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await refresh();
    } catch (mutationError) {
      setError(errorText(mutationError));
    }
  }

  function startEdit(user: { id: string; login: string; fullName: string }) {
    setEditId(user.id);
    setEditDraft({ login: user.login, fullName: user.fullName });
    setError(null);
    setNotice(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setError(null);
    setNotice(null);
    try {
      await updateProfile.mutateAsync({
        userId: editId,
        login: editDraft.login,
        fullName: editDraft.fullName,
      });
      setNotice("Данные пользователя обновлены");
      setEditId(null);
      await refresh();
    } catch (mutationError) {
      setError(errorText(mutationError));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Пользователи и роли</h1>
        <p className="text-sm text-muted-foreground">
          Добавление горничных, назначение номеров, смена роли, сброс пароля.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Новый пользователь</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Логин</span>
              <Input
                value={form.login}
                onChange={(event) =>
                  setForm({ ...form, login: event.target.value.toLowerCase() })
                }
                required
                minLength={4}
                maxLength={32}
                pattern="[a-z0-9._-]+"
                autoComplete="off"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                латиница, цифры, точка, дефис, подчёркивание
              </span>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">ФИО</span>
              <Input
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Пароль</span>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
                minLength={8}
                maxLength={100}
                autoComplete="new-password"
              />
              <span className="mt-1 block text-xs text-muted-foreground">не менее 8 символов</span>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Роль</span>
              <select
                value={form.roleCode}
                onChange={(event) =>
                  setForm({
                    ...form,
                    roleCode: event.target.value as "ADMIN" | "MANAGER" | "MAID",
                  })
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end md:col-span-2 xl:col-span-4">
              <Button type="submit" disabled={createUser.isPending} className="w-full sm:w-auto">
                {createUser.isPending ? "Создаём…" : "Создать пользователя"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Пользователи ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((user) => {
            const isMaid = user.roleCode === "MAID";
            const selectedRooms = roomDraft[user.id] ?? user.roomIds;
            const editing = editId === user.id;
            const passwordShown = Boolean(passwordOpen[user.id]);

            return (
              <div
                key={user.id}
                data-testid="user-row"
                data-login={user.login}
                className="space-y-3 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(user.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold" title={user.fullName}>
                        {user.fullName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="max-w-[220px] truncate" title={user.login}>
                          {user.login}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ROLE_LABELS[user.roleCode] ?? user.roleCode}</span>
                        <span
                          className={
                            user.isActive
                              ? "rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800"
                              : "rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground"
                          }
                        >
                          {user.isActive ? "Активен" : "Деактивирован"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!editing ? (
                    <Button
                      variant="outline"
                      className="h-10 w-full justify-center gap-2 sm:w-auto"
                      onClick={() => startEdit(user)}
                    >
                      <PencilIcon />
                      Изменить ФИО / логин
                    </Button>
                  ) : null}
                </div>

                {editing ? (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        <span className="mb-1 block text-muted-foreground">ФИО</span>
                        <Input
                          value={editDraft.fullName}
                          onChange={(event) =>
                            setEditDraft({ ...editDraft, fullName: event.target.value })
                          }
                          minLength={2}
                          maxLength={120}
                          autoComplete="name"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-muted-foreground">Логин</span>
                        <Input
                          value={editDraft.login}
                          onChange={(event) =>
                            setEditDraft({ ...editDraft, login: event.target.value.toLowerCase() })
                          }
                          minLength={4}
                          maxLength={32}
                          pattern="[a-z0-9._-]+"
                          autoComplete="off"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={saveEdit} disabled={updateProfile.isPending}>
                        {updateProfile.isPending ? "Сохраняем…" : "Сохранить"}
                      </Button>
                      <Button variant="outline" onClick={() => setEditId(null)}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="text-sm sm:w-[220px]">
                    <span className="mb-1 block text-muted-foreground">Роль</span>
                    <select
                      value={user.roleCode}
                      onChange={(event) =>
                        run(
                          () =>
                            updateRole.mutateAsync({
                              userId: user.id,
                              roleCode: event.target.value as "ADMIN" | "MANAGER" | "MAID",
                            }),
                          "Роль изменена",
                        )
                      }
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {Object.entries(ROLE_LABELS).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="outline"
                    className={`h-10 w-full sm:w-auto ${
                      user.isActive ? "text-destructive hover:text-destructive" : ""
                    }`}
                    onClick={() =>
                      run(
                        () => setActive.mutateAsync({ userId: user.id, isActive: !user.isActive }),
                        user.isActive ? "Пользователь деактивирован" : "Пользователь активирован",
                      )
                    }
                  >
                    {user.isActive ? "Деактивировать" : "Активировать"}
                  </Button>
                </div>

                <div className="rounded-md border bg-muted/20">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Пароль</p>
                      <p className="text-xs text-muted-foreground">
                        {passwordShown ? "Задайте новый пароль и подтвердите сброс." : "Смена пароля — отдельное действие."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="h-10 w-full justify-center sm:w-auto"
                      aria-expanded={passwordShown}
                      onClick={() =>
                        setPasswordOpen({ ...passwordOpen, [user.id]: !passwordShown })
                      }
                    >
                      {passwordShown ? "Скрыть" : "Сменить пароль"}
                    </Button>
                  </div>
                  {passwordShown ? (
                    <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1 text-sm">
                        <label htmlFor={`password-${user.id}`} className="mb-1 block text-muted-foreground">
                          Новый пароль
                        </label>
                        <Input
                          id={`password-${user.id}`}
                          type="password"
                          minLength={8}
                          maxLength={100}
                          value={passwords[user.id] ?? ""}
                          onChange={(event) =>
                            setPasswords({ ...passwords, [user.id]: event.target.value })
                          }
                          autoComplete="new-password"
                          aria-describedby={`password-help-${user.id}`}
                        />
                        <p
                          id={`password-help-${user.id}`}
                          className="mt-1 text-xs text-muted-foreground"
                        >
                          Не менее 8 символов
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="h-10 w-full sm:mt-6 sm:w-auto"
                        disabled={(passwords[user.id] ?? "").length < 8}
                        onClick={() =>
                          run(
                            async () => {
                              await resetPassword.mutateAsync({
                                userId: user.id,
                                password: passwords[user.id]!,
                              });
                              setPasswords({ ...passwords, [user.id]: "" });
                              setPasswordOpen({ ...passwordOpen, [user.id]: false });
                            },
                            "Пароль сброшен",
                          )
                        }
                      >
                        Сбросить
                      </Button>
                    </div>
                  ) : null}
                </div>

                {isMaid ? (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Назначенные номера</p>
                      <Button
                        variant="outline"
                        className="h-10 w-full sm:w-auto"
                        onClick={() =>
                          run(
                            () =>
                              setRooms.mutateAsync({
                                userId: user.id,
                                roomIds: selectedRooms,
                              }),
                            "Номера назначены",
                          )
                        }
                      >
                        Сохранить номера
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {rooms.map((room) => (
                        <label
                          key={room.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selectedRooms.includes(room.id)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...selectedRooms, room.id]
                                : selectedRooms.filter((id) => id !== room.id);
                              setRoomDraft({ ...roomDraft, [user.id]: next });
                            }}
                          />
                          {room.number}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
