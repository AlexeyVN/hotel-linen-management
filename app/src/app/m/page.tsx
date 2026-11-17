import { MobileDashboard } from "@/components/mobile/dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function MaidHome() {
  const user = await getCurrentUser();
  return <MobileDashboard fullName={user?.fullName ?? ""} />;
}
