import { MobileAuditSession } from "@/components/mobile/audit-session";

export default async function MaidAuditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MobileAuditSession sessionId={id} />;
}
