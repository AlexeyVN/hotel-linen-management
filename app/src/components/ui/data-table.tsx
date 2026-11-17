import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Общая обёртка таблиц админки: прокрутка внутри контейнера, а не страницы;
 * единая типографика и отступы; minWidth не даёт колонкам слипаться.
 */
export function DataTable({
  children,
  minWidth = "640px",
  className,
  caption,
}: {
  children: ReactNode;
  minWidth?: string;
  className?: string;
  caption?: string;
}) {
  return (
    <div className={cn("overflow-x-auto [contain:paint]", className)}>
      <table
        className="w-full text-[13px] [&_td]:px-2 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-2 xl:text-sm"
        style={{ minWidth }}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}
