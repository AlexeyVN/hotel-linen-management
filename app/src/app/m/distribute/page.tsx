import { MobileDistribute } from "@/components/mobile/distribute";

export default async function MaidDistributePage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; item?: string }>;
}) {
  const { room, item } = await searchParams;
  return <MobileDistribute initialRoomId={room ?? ""} initialItemId={item ?? ""} />;
}
