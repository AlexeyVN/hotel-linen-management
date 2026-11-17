import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ItemQrPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const value = code?.trim();
  if (!value) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/i/${encodeURIComponent(value)}`)}`);
  }

  const item = await prisma.item.findFirst({
    where: {
      OR: [{ id: value }, { externalId: value }, { name: value }],
    },
    select: { id: true, name: true, isActive: true },
  });
  if (!item) notFound();

  if (!item.isActive) {
    return (
      <main className="mx-auto max-w-sm space-y-3 p-6">
        <h1 className="text-xl font-semibold">{item.name}</h1>
        <p className="text-sm text-muted-foreground">
          Позиция деактивирована. QR-метка больше не ведёт к действиям.
        </p>
        <a href="/" className="text-sm text-primary underline">
          На главную
        </a>
      </main>
    );
  }

  redirect(user.roleCode === "MAID" ? "/m" : "/admin/catalog");
}
