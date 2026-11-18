"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Регистрация service worker и кнопка обновления (ТЗ §9.3):
 * новая версия активируется только по нажатию, чтобы не порвать введённые данные.
 * В небезопасном контексте (http://LAN-IP) SW не регистрируется — так и должно быть.
 */
export function PwaRegister() {
  const t = useTranslations("mobile");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(worker);
            }
          });
        });
      })
      .catch(() => {
        // Регистрация не критична для работы приложения.
      });

    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-primary px-4 py-2 text-sm text-primary-foreground">
      <span>{t("pwa.updateAvailable")}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => waiting.postMessage("SKIP_WAITING")}
      >
        {t("pwa.update")}
      </Button>
    </div>
  );
}
