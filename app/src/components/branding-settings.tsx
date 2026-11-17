"use client";

import { TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ACCENT_COLORS, contrastWithWhite, normalizeHex } from "@/lib/accent-colors";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc-client";

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

/** Уменьшает изображение до 1600 px и сохраняет PNG с альфа-каналом. */
async function normalizeLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не поддерживает обработку изображений");
  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Не удалось подготовить PNG");
  return blob;
}

const CHECKERBOARD: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

export function BrandingSettings() {
  const tBranding = useTranslations("branding");
  const router = useRouter();
  const utils = trpc.useUtils();
  const brandingQuery = trpc.settings.brandingGet.useQuery();
  const accentQuery = trpc.settings.accentGet.useQuery();
  const updateBranding = trpc.settings.brandingUpdate.useMutation();
  const setAccent = trpc.settings.setAccent.useMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hotelName, setHotelName] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePosition, setResponsiblePosition] = useState("");
  const [accentHex, setAccentHex] = useState("#2563eb");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const branding = brandingQuery.data;

  useEffect(() => {
    if (!branding) return;
    setHotelName(branding.hotelName);
    setResponsibleName(branding.responsibleName);
    setResponsiblePosition(branding.responsiblePosition);
  }, [branding]);

  useEffect(() => {
    if (accentQuery.data) setAccentHex(accentQuery.data.hex);
  }, [accentQuery.data]);

  async function refreshBranding(message: string) {
    setNotice(message);
    await utils.settings.brandingGet.invalidate();
    await utils.settings.accentGet.invalidate();
    router.refresh();
  }

  async function upload(file: File | null) {
    setError(null);
    setNotice(null);
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Допустимы PNG, JPEG или WebP");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Исходный файл больше 10 МБ");
      return;
    }
    setUploading(true);
    try {
      const png = await normalizeLogo(file);
      if (png.size > 2 * 1024 * 1024) {
        setError("После уменьшения PNG больше 2 МБ — выберите изображение проще");
        return;
      }
      const body = new FormData();
      body.append("file", new File([png], "logo.png", { type: "image/png" }));
      const response = await fetch("/api/admin/branding/logo", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        width?: number;
        height?: number;
      };
      if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить логотип");
      await refreshBranding(`Логотип сохранён: ${payload.width}×${payload.height} px`);
    } catch (uploadError) {
      setError(errorText(uploadError));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    if (!window.confirm("Удалить логотип отеля?")) return;
    setError(null);
    try {
      const response = await fetch("/api/admin/branding/logo", { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Не удалось удалить логотип");
      }
      await refreshBranding(tBranding("logoDeleted"));
    } catch (removeError) {
      setError(errorText(removeError));
    }
  }

  async function saveTexts() {
    setError(null);
    setNotice(null);
    try {
      await updateBranding.mutateAsync({
        hotelName,
        responsibleName,
        responsiblePosition,
      });
      await refreshBranding(tBranding("textsSaved"));
    } catch (mutationError) {
      setError(errorText(mutationError));
    }
  }

  async function saveAccent() {
    setError(null);
    setNotice(null);
    try {
      const hex = normalizeHex(accentHex);
      if (!hex) throw new Error("Цвет должен быть в формате #RRGGBB");
      if (contrastWithWhite(hex) < 4.5) {
        throw new Error("Цвет слишком светлый для белого текста — выберите темнее");
      }
      await setAccent.mutateAsync({ hex });
      await refreshBranding(tBranding("accentSaved"));
    } catch (mutationError) {
      setError(errorText(mutationError));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tBranding("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="flex h-32 w-56 items-center justify-center rounded-md border p-3"
            style={CHECKERBOARD}
          >
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt="Логотип отеля"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-sm text-muted-foreground">{tBranding("logoNotLoaded")}</span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {tBranding("hint1")}
              
            </p>
            {branding?.logoWidth && branding.logoHeight ? (
              <p className="text-xs text-muted-foreground">
                {tBranding("currentSize")}: {branding.logoWidth}×{branding.logoHeight} px
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  void upload(event.target.files?.[0] ?? null);
                }}
              />
              <Button variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? tBranding("uploading") : branding?.logoUrl ? tBranding("replace") : tBranding("upload")}
              </Button>
              {branding?.logoUrl ? (
                <Button variant="outline" onClick={removeLogo}>
                  Удалить
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div>
            <p className="text-sm font-medium">{tBranding("accentTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {tBranding("accentHint")}
              
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                title={color.label}
                aria-label={`Цвет: ${color.label}`}
                aria-pressed={accentHex === color.hex}
                onClick={() => setAccentHex(color.hex)}
                className={
                  accentHex === color.hex
                    ? "h-9 w-9 rounded-full border-2 border-foreground ring-2 ring-offset-2 ring-offset-background"
                    : "h-9 w-9 rounded-full border border-border"
                }
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              aria-label={tBranding("customColor")}
              value={accentHex}
              onChange={(event) => setAccentHex(event.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border bg-background p-1"
            />
            <Input
              aria-label={tBranding("hexColor")}
              value={accentHex}
              onChange={(event) => setAccentHex(event.target.value)}
              className="w-32 font-mono"
            />
            <span className="text-xs text-muted-foreground">
              {tBranding("contrast")}: {contrastWithWhite(accentHex).toFixed(2)}:1
            </span>
            <Button onClick={saveAccent} disabled={setAccent.isPending}>
              {setAccent.isPending ? tBranding("applying") : tBranding("apply")}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">{tBranding("hotelName")}</span>
            <Input value={hotelName} onChange={(event) => setHotelName(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">{tBranding("responsibleName")}</span>
            <Input
              value={responsibleName}
              onChange={(event) => setResponsibleName(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">{tBranding("responsiblePosition")}</span>
            <Input
              value={responsiblePosition}
              onChange={(event) => setResponsiblePosition(event.target.value)}
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

        <Button onClick={saveTexts} disabled={updateBranding.isPending}>
          {updateBranding.isPending ? tBranding("saving") : tBranding("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
