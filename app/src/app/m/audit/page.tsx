import { MobileAuditList } from "@/components/mobile/audit-list";

export default async function MaidAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room } = await searchParams;
  return <MobileAuditList initialRoomId={room ?? ""} />;
}
