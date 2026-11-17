"use client";

import { useState } from "react";

export function BrandMark({
  logoUrl,
  fallback = "",
  className,
}: {
  logoUrl?: string | null;
  fallback?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) {
    return fallback ? <span className="font-semibold">{fallback}</span> : null;
  }
  return (
    // Логотип публичный (нужен на странице входа), прозрачность PNG сохраняется.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt="Логотип отеля"
      onError={() => setFailed(true)}
      className={className ?? "h-10 w-auto max-w-[180px] object-contain"}
    />
  );
}
