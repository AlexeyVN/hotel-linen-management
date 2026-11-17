"use client";

import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

export function ChecklistsAdmin() {
  const utils = trpc.useUtils();
  const templatesQuery = trpc.checklists.list.useQuery();
  const createTemplate = trpc.checklists.createTemplate.useMutation();
  const updateTemplate = trpc.checklists.updateTemplate.useMutation();
  const addItem = trpc.checklists.addItem.useMutation();
  const updateItem = trpc.checklists.updateItem.useMutation();
  const removeItem = trpc.checklists.removeItem.useMutation();

  const templates = templatesQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [newItem, setNewItem] = useState({ text: "", photoRequired: false, extra: "" });
  const [drafts, setDrafts] = useState<Record<string, { text: string; extra: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];
  const activeTemplateId = selected?.id ?? "";

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await utils.checklists.list.invalidate();
    } catch (actionError) {
      setError(errorText(actionError));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Чек-листы уборки</h1>
        <p className="text-sm text-muted-foreground">
          Шаблон прикрепляется к задаче; задачу нельзя завершить, пока все пункты не
          отмечены, а обязательные фото не загружены.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Шаблоны</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  template.id === activeTemplateId ? "border-primary bg-primary/5" : ""
                }`}
              >
                <span>
                  {template.name}
                  <span className="block text-xs text-muted-foreground">
                    пунктов: {template.items.length}
                  </span>
                </span>
                <span
                  className={
                    template.isActive ? "text-xs text-green-700" : "text-xs text-muted-foreground"
                  }
                >
                  {template.isActive ? "активен" : "выключен"}
                </span>
              </button>
            ))}

            <div className="border-t pt-2">
              <Input
                value={templateName}
                placeholder="Новый шаблон"
                onChange={(event) => setTemplateName(event.target.value)}
              />
              <Button
                className="mt-2 w-full"
                disabled={templateName.trim().length < 2}
                onClick={() =>
                  run(async () => {
                    const created = await createTemplate.mutateAsync({ name: templateName });
                    setTemplateName("");
                    setSelectedId(created.id);
                  }, "Шаблон создан")
                }
              >
                Создать шаблон
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selected ? selected.name : "Выберите шаблон"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Создайте шаблон слева.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      run(
                        () =>
                          updateTemplate.mutateAsync({
                            id: selected.id,
                            isActive: !selected.isActive,
                          }),
                        selected.isActive ? "Шаблон выключен" : "Шаблон включён",
                      )
                    }
                  >
                    {selected.isActive ? "Выключить шаблон" : "Включить шаблон"}
                  </Button>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">Пункт</th>
                      <th className="py-2 font-medium">Фото</th>
                      <th className="py-2 font-medium">Доп. ответ</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => {
                      const draft = drafts[item.id] ?? {
                        text: item.text,
                        extra: item.extraOptionText ?? "",
                      };
                      return (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2">
                            <Input
                              value={draft.text}
                              onChange={(event) =>
                                setDrafts({
                                  ...drafts,
                                  [item.id]: { ...draft, text: event.target.value },
                                })
                              }
                              className="h-9"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="checkbox"
                              checked={item.photoRequired}
                              onChange={(event) =>
                                run(
                                  () =>
                                    updateItem.mutateAsync({
                                      id: item.id,
                                      photoRequired: event.target.checked,
                                    }),
                                  "Пункт обновлён",
                                )
                              }
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              value={draft.extra}
                              placeholder="Например, Н/П"
                              onChange={(event) =>
                                setDrafts({
                                  ...drafts,
                                  [item.id]: { ...draft, extra: event.target.value },
                                })
                              }
                              className="h-9 w-32"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  run(
                                    () =>
                                      updateItem.mutateAsync({
                                        id: item.id,
                                        text: draft.text,
                                        extraOptionText: draft.extra || null,
                                      }),
                                    "Пункт сохранён",
                                  )
                                }
                              >
                                Сохранить
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  run(() => removeItem.mutateAsync({ id: item.id }), "Пункт удалён")
                                }
                              >
                                Удалить
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                  <label className="min-w-64 flex-1 text-sm">
                    <span className="mb-1 block text-muted-foreground">Новый пункт</span>
                    <Input
                      value={newItem.text}
                      onChange={(event) => setNewItem({ ...newItem, text: event.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">Доп. ответ</span>
                    <Input
                      value={newItem.extra}
                      onChange={(event) => setNewItem({ ...newItem, extra: event.target.value })}
                      className="w-32"
                    />
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newItem.photoRequired}
                      onChange={(event) =>
                        setNewItem({ ...newItem, photoRequired: event.target.checked })
                      }
                    />
                    фото обязательно
                  </label>
                  <Button
                    disabled={newItem.text.trim().length === 0}
                    onClick={() =>
                      run(async () => {
                        await addItem.mutateAsync({
                          templateId: activeTemplateId,
                          text: newItem.text,
                          photoRequired: newItem.photoRequired,
                          extraOptionText: newItem.extra || undefined,
                        });
                        setNewItem({ text: "", photoRequired: false, extra: "" });
                      }, "Пункт добавлен")
                    }
                  >
                    Добавить пункт
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
