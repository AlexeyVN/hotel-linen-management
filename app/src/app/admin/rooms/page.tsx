import { redirect } from "next/navigation";
import { RoomsAdmin } from "@/components/rooms-admin";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <RoomsAdmin canManage={hasPermission(user, "rooms.manage")} />;
}
