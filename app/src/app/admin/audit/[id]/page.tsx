import { AuditSessionView } from "@/components/audit-session";

export default async function AuditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuditSessionView sessionId={id} />;
}
