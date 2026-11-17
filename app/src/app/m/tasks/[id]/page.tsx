import { MobileTaskDetail } from "@/components/mobile/task-detail";

export default async function MaidTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MobileTaskDetail taskId={id} />;
}
