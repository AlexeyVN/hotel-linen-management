"use client";

import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { kopecksToInput, parseRublesToKopecks } from "@/lib/money";
import { useMoney } from "@/components/currency-provider";
import { trpc } from "@/lib/trpc-client";

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

const EMPTY_FORM = {
  name: "",
  categoryId: "",
  unit: "шт",
  price: "",
  note: "",
};

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CatalogAdmin() {
  const money = useMoney();
  const utils = trpc.useUtils();
  const catalogQuery = trpc.catalog.list.useQuery();
  const categoriesQuery = trpc.items.categories.useQuery();
  const createItem = trpc.catalog.create.useMutation();
  const updateItem = trpc.catalog.update.useMutation();
  const deleteItem = trpc.catalog.delete.useMutation();

  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items = catalogQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const visible = items.filter((item) => {
    if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await Promise.all([utils.catalog.list.invalidate(), utils.items.list.invalidate()]);
    } catch (actionError) {
      setError(errorText(actionError));
    }
  }

  function startEdit(item: (typeof items)[number]) {
    setEditId(item.id);
    setDraft({
      name: item.name,
      categoryId: item.categoryId,
      unit: item.unit,
      price: kopecksToInput(item.priceKopecks),
      note: item.note ?? "",
    });
  }

  async function create() {
    const price = parseRublesToKopecks(form.price);
    if (!form.name.trim() || !form.categoryId || price === null) {
      setError("Укажите название, категорию и корректную цену");
      return;
    }
    await run(async () => {
      await createItem.mutateAsync({
        name: form.name,
        categoryId: form.categoryId,
        unit: form.unit || "шт",
        priceKopecks: price,
        note: form.note || null,
      });
      setForm(EMPTY_FORM);
    }, "Позиция добавлена в справочник");
  }

  async function saveEdit(id: string) {
    const price = parseRublesToKopecks(draft.price);
    if (!draft.name.trim() || !draft.categoryId || price === null) {
      setError("Укажите название, категорию и корректную цену");
      return;
    }
    await run(async () => {
      await updateItem.mutateAsync({
        id,
        name: draft.name,
        categoryId: draft.categoryId,
        unit: draft.unit || "шт",
        priceKopecks: price,
        note: draft.note || null,
      });
      setEditId(null);
    }, "Позиция сохранена");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Справочник позиций</h1>
        <p className="text-sm text-muted-foreground">
          Цена и примечание задаются здесь; количество на складе — read-only, вводится при
          добавлении на склад.
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
          <CardTitle>Новая позиция</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-sm">
            <span className="mb-1 block text-muted-foreground">Название</span>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Категория</span>
            <select
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="">— выберите —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="w-24 text-sm">
            <span className="mb-1 block text-muted-foreground">Ед.</span>
            <Input
              value={form.unit}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
            />
          </label>
          <label className="w-36 text-sm">
            <span className="mb-1 block text-muted-foreground">Цена, ₽</span>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
          </label>
          <label className="min-w-56 flex-1 text-sm">
            <span className="mb-1 block text-muted-foreground">Примечание</span>
            <Input
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
          <Button onClick={create}>Добавить позицию</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Позиции</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Поиск по названию"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full sm:max-w-xs"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Все категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto [contain:paint]">
            <table className="w-full min-w-[560px] table-fixed text-[13px] md:min-w-[900px] xl:text-sm">
              <caption className="sr-only">
                Справочник позиций: название, категория, цена, остаток и примечание
              </caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="sticky left-0 z-10 w-[26%] whitespace-nowrap border-b bg-card px-2 py-2 text-xs font-medium md:w-[24%] xl:text-[13px]">
                    Название
                  </th>
                  <th scope="col" className="hidden w-[12%] whitespace-nowrap border-b px-2 py-2 text-xs font-medium md:table-cell xl:text-[13px]">
                    Категория
                  </th>
                  <th scope="col" className="hidden w-[6%] whitespace-nowrap border-b px-2 py-2 text-xs font-medium md:table-cell xl:text-[13px]">
                    Ед.
                  </th>
                  <th scope="col" className="w-[18%] whitespace-nowrap border-b px-2 py-2 text-right text-xs font-medium md:w-[13%] xl:text-[13px]">
                    Цена
                  </th>
                  <th scope="col" className="w-[18%] whitespace-nowrap border-b px-2 py-2 text-right text-xs font-medium md:w-[13%] xl:text-[13px]">
                    Остаток
                  </th>
                  <th scope="col" className="hidden w-[20%] whitespace-nowrap border-b px-2 py-2 text-xs font-medium md:table-cell xl:text-[13px]">
                    Примечание
                  </th>
                  <th scope="col" className="w-[20%] border-b px-2 py-2 md:w-[12%]">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const editing = editId === item.id;
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="sticky left-0 z-10 border-b bg-card px-2 py-2 align-top">
                        {editing ? (
                          <Input
                            value={draft.name}
                            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                            className="h-9"
                            aria-label="Название позиции"
                          />
                        ) : (
                          <span className={item.isActive ? "" : "text-muted-foreground line-through"}>
                            {item.name}
                          </span>
                        )}
                        <span
                          className="mt-0.5 block max-w-[220px] truncate text-xs text-muted-foreground md:hidden"
                          title={item.note ?? undefined}
                        >
                          {item.note ?? "—"}
                        </span>
                      </td>
                      <td className="hidden border-b px-2 py-2 md:table-cell">
                        {editing ? (
                          <select
                            value={draft.categoryId}
                            onChange={(event) =>
                              setDraft({ ...draft, categoryId: event.target.value })
                            }
                            className="h-9 w-full rounded-md border bg-background px-2"
                            aria-label="Категория"
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.categoryName
                        )}
                      </td>
                      <td className="hidden border-b px-2 py-2 md:table-cell">
                        {editing ? (
                          <Input
                            value={draft.unit}
                            onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                            className="h-9 w-full"
                            aria-label="Единица измерения"
                          />
                        ) : (
                          item.unit
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b px-1.5 py-2 text-right tabular-nums">
                        {editing ? (
                          <Input
                            value={draft.price}
                            onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                            className="h-9 w-full text-right"
                            aria-label="Цена, рубли"
                          />
                        ) : (
                          money(item.priceKopecks)
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b px-1.5 py-2 text-right tabular-nums">
                        {item.warehouseQty} {item.unit}
                      </td>
                      <td className="hidden border-b px-2 py-2 md:table-cell">
                        {editing ? (
                          <Input
                            value={draft.note}
                            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                            className="h-9"
                            aria-label="Примечание"
                          />
                        ) : (
                          <span
                            className="block max-w-[220px] truncate text-muted-foreground"
                            title={item.note ?? undefined}
                          >
                            {item.note ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="border-b px-2 py-2">
                        <div className="flex justify-end gap-1">
                          {editing ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="!h-8 !w-8 !p-0"
                                aria-label={`Сохранить позицию «${item.name}»`}
                                title="Сохранить"
                                onClick={() => saveEdit(item.id)}
                              >
                                <CheckIcon />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="!h-8 !w-8 !p-0"
                                aria-label={`Отменить редактирование «${item.name}»`}
                                title="Отмена"
                                onClick={() => setEditId(null)}
                              >
                                <XIcon />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="!h-8 !w-8 !p-0"
                                aria-label={`Изменить позицию «${item.name}»`}
                                title="Изменить"
                                onClick={() => startEdit(item)}
                              >
                                <PencilIcon />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="!h-8 !w-8 !p-0"
                                aria-label={
                                  item.isActive
                                    ? `Выключить позицию «${item.name}»`
                                    : `Включить позицию «${item.name}»`
                                }
                                title={item.isActive ? "Выключить" : "Включить"}
                                onClick={() =>
                                  run(
                                    () =>
                                      updateItem.mutateAsync({
                                        id: item.id,
                                        isActive: !item.isActive,
                                      }),
                                    item.isActive ? "Позиция деактивирована" : "Позиция активирована",
                                  )
                                }
                              >
                                <PowerIcon />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="!h-8 !w-8 !p-0"
                                aria-label={`Удалить позицию «${item.name}»`}
                                title="Удалить"
                                onClick={() => {
                                  if (!window.confirm(`Удалить позицию «${item.name}»?`)) return;
                                  void run(
                                    () => deleteItem.mutateAsync({ id: item.id }),
                                    "Позиция удалена",
                                  );
                                }}
                              >
                                <TrashIcon />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Позиций нет.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
