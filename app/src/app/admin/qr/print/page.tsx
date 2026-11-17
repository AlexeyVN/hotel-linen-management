import { redirect } from "next/navigation";
import { ensureQr, imageDataUrl } from "@/server/services/qr";
import { PrintButton } from "@/components/print-button";
import { type QrPayloadFormat } from "@/lib/domain/qr";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function QrPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; payload?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "rooms.read")) {
    return <p className="p-6 text-sm text-destructive">Нет права на печать меток.</p>;
  }

  const params = await searchParams;
  const objectType = params.type === "item" ? "item" : "room";
  const format: QrPayloadFormat =
    params.payload === "json" ? "json" : params.payload === "text" ? "text" : "url";

  const labels: Array<{ title: string; subtitle: string; dataUrl: string }> = [];

  if (objectType === "room") {
    const rooms = await prisma.room.findMany({
      where: { isActive: true },
      include: { roomType: true },
      orderBy: { number: "asc" },
    });
    for (const room of rooms) {
      const record = await ensureQr({
        objectType: "room",
        id: room.id,
        payloadFormat: format,
        imageFormat: "png",
        size: 256,
      });
      labels.push({
        title: room.number,
        subtitle: room.roomType.name,
        dataUrl: await imageDataUrl(record),
      });
    }
  } else {
    const items = await prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    for (const item of items) {
      const record = await ensureQr({
        objectType: "item",
        id: item.id,
        payloadFormat: format,
        imageFormat: "png",
        size: 256,
      });
      labels.push({
        title: item.name,
        subtitle: item.unit,
        dataUrl: await imageDataUrl(record),
      });
    }
  }

  const caption = objectType === "room" ? "Номера" : "Позиции";

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-black">
      <style>{`
        @media print {
          .no-print { display: none; }
          .qr-label { break-inside: avoid; }
          @page { margin: 10mm; }
        }
      `}</style>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Метки QR: {caption}</h1>
          <p className="text-sm text-muted-foreground">
            Формат нагрузки: {format} · всего {labels.length}
          </p>
        </div>
        <PrintButton />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {labels.map((label) => (
          <div
            key={label.title}
            className="qr-label flex flex-col items-center rounded border p-3 text-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={label.dataUrl} alt={`QR ${label.title}`} className="h-32 w-32" />
            <p className="mt-1 text-sm font-medium">{label.title}</p>
            <p className="text-xs text-gray-600">{label.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
