import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RoomQrPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const value = code?.trim();
  if (!value) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/r/${encodeURIComponent(value)}`)}`);
  }

  const room = await prisma.room.findFirst({
    where: { OR: [{ id: value }, { number: value }] },
    select: { id: true, number: true, isActive: true },
  });
  if (!room) notFound();

  if (!room.isActive) {
    return (
      <main className="mx-auto max-w-sm space-y-3 p-6">
        <h1 className="text-xl font-semibold">Номер {room.number}</h1>
        <p className="text-sm text-muted-foreground">
          Номер деактивирован. QR-метка больше не ведёт к действиям.
        </p>
        <a href="/" className="text-sm text-primary underline">
          На главную
        </a>
      </main>
    );
  }

  redirect(user.roleCode === "MAID" ? "/m/rooms" : "/admin/rooms");
}
