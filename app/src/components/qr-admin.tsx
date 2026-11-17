"use client";

import { TRPCClientError } from "@trpc/client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc-client";

type ObjectType = "room" | "item";
type PayloadFormat = "url" | "json" | "text";
type ImageFormat = "png" | "svg";

interface Generated {
  id: string;
  payload: string;
  dataUrl: string;
  imageUrl: string;
  payloadFormat: string;
  imageFormat: string;
  code: string;
}

type SavedGenerated = Generated & { objectKey: string; paramKey: string };

export function QrAdmin() {
  const utils = trpc.useUtils();
  const roomsQuery = trpc.rooms.list.useQuery();
  const itemsQuery = trpc.items.list.useQuery();
  const generate = trpc.qr.generate.useMutation();

  const [objectType, setObjectType] = useState<ObjectType>("room");
  const [objectId, setObjectId] = useState("");
  const [payloadFormat, setPayloadFormat] = useState<PayloadFormat>("url");
  const [imageFormat, setImageFormat] = useState<ImageFormat>("png");
  const [size, setSize] = useState(320);
  const [paramsDirty, setParamsDirty] = useState(false);
  const [generated, setGenerated] = useState<SavedGenerated | null>(null);
  const [error, setError] = useState<string | null>(null);

  const objectKey = `${objectType}:${objectId}`;
  const paramKey = `${payloadFormat}:${imageFormat}:${size}`;
  const selectionKey = `${objectKey}:${paramKey}`;
  const selectionKeyRef = useRef(selectionKey);
  useEffect(() => {
    selectionKeyRef.current = selectionKey;
  }, [selectionKey]);

  const result =
    generated && generated.objectKey === objectKey && generated.paramKey === paramKey
      ? generated
      : null;
  const statusQuery = trpc.qr.status.useQuery(
    { objectType, id: objectId },
    { enabled: Boolean(objectId) },
  );

  const objects =
    objectType === "room"
      ? (roomsQuery.data ?? []).map((room) => ({
          id: room.id,
          label: `${room.number} · ${room.roomTypeName}`,
        }))
      : (itemsQuery.data ?? []).map((item) => ({ id: item.id, label: item.name }));

  const imageSrc = result ? result.dataUrl || result.imageUrl : "";

  async function handleGenerate() {
    setError(null);
    if (!objectId) {
      setError("Выберите объект");
      return;
    }
    const requestKey = selectionKey;
    try {
      const generatedResult = await generate.mutateAsync({
        objectType,
        id: objectId,
        payloadFormat,
        imageFormat,
        size,
      });
      // Ответ по старому объекту/параметрам не должен перебивать текущий выбор.
      if (requestKey !== selectionKeyRef.current) return;
      setGenerated({
        ...(generatedResult as Generated),
        objectKey,
        paramKey,
      });
      setParamsDirty(false);
      await utils.qr.status.invalidate({ objectType, id: objectId });
    } catch (mutationError) {
      setError(
        mutationError instanceof TRPCClientError
          ? mutationError.message
          : "Не удалось сгенерировать QR",
      );
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">QR-коды</h1>
        <p className="text-sm text-muted-foreground">
          Метки для номеров и позиций. Три формата нагрузки (URL, JSON, текст) и два
          формата изображения (PNG, SVG); сканер принимает любой из них.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Параметры метки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Объект</span>
                <select
                  value={objectType}
                  onChange={(event) => {
                    setObjectType(event.target.value as ObjectType);
                    setObjectId("");
                    setGenerated(null);
                    setParamsDirty(false);
                  }}
                  className="h-10 rounded-md border bg-background px-3"
                >
                  <option value="room">Номер</option>
                  <option value="item">Позиция</option>
                </select>
              </label>

              <label className="min-w-56 flex-1 text-sm">
                <span className="mb-1 block text-muted-foreground">Конкретный</span>
                <select
                  value={objectId}
                  onChange={(event) => { setObjectId(event.target.value); setParamsDirty(false); }}
                  className="h-10 w-full rounded-md border bg-background px-3"
                >
                  <option value="">— выберите —</option>
                  {objects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Формат нагрузки</span>
                <select
                  value={payloadFormat}
                  onChange={(event) => { setPayloadFormat(event.target.value as PayloadFormat); setParamsDirty(true); }}
                  className="h-10 rounded-md border bg-background px-3"
                >
                  <option value="url">URL (/r/101 или /i/code)</option>
                  <option value="json">JSON {"{v,type,code,id}"}</option>
                  <option value="text">Текст HOTEL:ROOM:101</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Формат файла</span>
                <select
                  value={imageFormat}
                  onChange={(event) => { setImageFormat(event.target.value as ImageFormat); setParamsDirty(true); }}
                  className="h-10 rounded-md border bg-background px-3"
                >
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">Размер, px</span>
                <select
                  value={size}
                  onChange={(event) => { setSize(Number(event.target.value)); setParamsDirty(true); }}
                  className="h-10 rounded-md border bg-background px-3"
                >
                  <option value={256}>256</option>
                  <option value={320}>320</option>
                  <option value={512}>512</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} disabled={generate.isPending}>
                {generate.isPending ? "Генерируем…" : "Сгенерировать и сохранить"}
              </Button>
              <a
                href="/admin/qr/print?type=room&payload=url"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-md border px-4 text-sm hover:bg-muted"
              >
                Печать листа номеров
              </a>
              <a
                href="/admin/qr/print?type=item&payload=url"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-md border px-4 text-sm hover:bg-muted"
              >
                Печать листа позиций
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Предпросмотр</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {objectId ? (
              statusQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Проверяем сохранённую метку…</p>
              ) : statusQuery.data ? (
                <div className="rounded-md border p-3 text-sm">
                  <p>
                    Метка привязана к объекту ·{" "}
                    <span className={statusQuery.data.stale ? "text-amber-700" : "text-green-700"}>
                      {statusQuery.data.stale ? "устарела — перегенерируйте" : "актуальна"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {statusQuery.data.payloadFormat.toUpperCase()} ·{" "}
                    {statusQuery.data.imageFormat.toUpperCase()} · создана{" "}
                    {new Intl.DateTimeFormat("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(statusQuery.data.createdAt))}
                  </p>
                  <a
                    href={statusQuery.data.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-primary underline"
                  >
                    Открыть сохранённый QR
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Для объекта ещё нет сохранённой метки.</p>
              )
            ) : null}

            {result ? (
              <>
                <div className="flex h-64 items-center justify-center rounded-md border bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc} alt="QR-код" className="max-h-full max-w-full" />
                </div>
                <code className="block break-all rounded-md bg-muted p-2 text-xs">
                  {result.payload}
                </code>
                <a
                  href={`/api/qr/${result.id}?download=1`}
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground"
                >
                  Скачать {result.imageFormat.toUpperCase()}
                </a>
              </>
            ) : paramsDirty ? (
              <p className="text-sm text-amber-700">
                Параметры метки изменены — нажмите «Сгенерировать и сохранить» заново.
              </p>
            ) : statusQuery.data && !statusQuery.data.stale ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Сохранённая метка для выбранного объекта
                </p>
                <div className="flex h-64 items-center justify-center rounded-md border bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={statusQuery.data.imageUrl}
                    alt="Сохранённый QR-код"
                    className="max-h-full max-w-full"
                  />
                </div>
                <code className="block break-all rounded-md bg-muted p-2 text-xs">
                  {statusQuery.data.payload}
                </code>
                <a
                  href={`/api/qr/${statusQuery.data.id}?download=1`}
                  className="inline-flex h-10 items-center rounded-md border px-4 text-sm hover:bg-muted"
                >
                  Скачать {statusQuery.data.imageFormat.toUpperCase()}
                </a>
              </>
            ) : statusQuery.data?.stale ? (
              <p className="text-sm text-amber-700">
                Сохранённая метка устарела — перегенерируйте её.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Сгенерируйте метку — здесь появится изображение и нагрузка.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Проверка кода</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Проверить метку можно на телефоне: «Главная → Сканировать QR» — сканер
            принимает URL, JSON и текстовый формат, а также ручной ввод кода.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
