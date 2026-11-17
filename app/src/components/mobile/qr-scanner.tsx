"use client";

import jsQR from "jsqr";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";

interface Resolved {
  type: "room" | "item";
  id: string;
  label: string;
  roomId: string | null;
  itemId: string | null;
}

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = trpc.qr.resolve.useMutation();

  function stopCamera() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function handlePayload(payload: string) {
    setError(null);
    try {
      const resolved = await resolve.mutateAsync({ payload });
      setResult(resolved as Resolved);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Код не распознан");
    }
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context && canvas.width > 0) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height);
        if (code?.data) {
          stopCamera();
          void handlePayload(code.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function startCamera() {
    setCameraError(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError(
        "Камера недоступна. Нужно разрешение и защищённый контекст (HTTPS или localhost). Можно ввести код вручную.",
      );
    }
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Сканировать QR</h1>
        <p className="text-sm text-muted-foreground">
          Метка номера откроет инвентаризацию или раздачу; метка позиции — раздачу.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cameraOn ? "h-64 w-full object-cover" : "hidden"}
        />
        {!cameraOn ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/80">
            <span>Камера выключена</span>
            <Button onClick={startCamera}>Включить камеру</Button>
          </div>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {cameraError ? <p className="text-sm text-amber-700">{cameraError}</p> : null}
      {cameraOn ? (
        <Button variant="outline" className="h-11 w-full" onClick={stopCamera}>
          Остановить камеру
        </Button>
      ) : null}

      <form
        className="space-y-2 rounded-xl border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (manual.trim()) void handlePayload(manual.trim());
        }}
      >
        <label className="block text-sm">
          <span className="mb-2 block text-muted-foreground">Ручной ввод кода</span>
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="101, /r/101, HOTEL:ROOM:101 или JSON"
            className="h-11"
          />
        </label>
        <Button type="submit" className="h-11 w-full" disabled={resolve.isPending}>
          {resolve.isPending ? "Проверяем…" : "Проверить код"}
        </Button>
      </form>

      {result ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">
            {result.type === "room" ? "Номер" : "Позиция"}
          </p>
          <p className="text-lg font-semibold">{result.label}</p>
          <div className="grid gap-2">
            {result.roomId ? (
              <>
                <Link
                  href={`/m/audit?room=${result.roomId}`}
                  className="flex h-12 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
                >
                  Инвентаризация номера
                </Link>
                <Link
                  href={`/m/distribute?room=${result.roomId}`}
                  className="flex h-12 items-center justify-center rounded-md border text-sm font-medium"
                >
                  Раздача в этот номер
                </Link>
              </>
            ) : null}
            {result.itemId ? (
              <Link
                href={`/m/distribute?item=${result.itemId}`}
                className="flex h-12 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
              >
                Раздача этой позиции
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
