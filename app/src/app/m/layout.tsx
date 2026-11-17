import { redirect } from "next/navigation";
import { PwaRegister } from "@/components/pwa-register";
import { QueueFlusher } from "@/components/queue-flusher";
import { TabBar } from "@/components/tab-bar";
import { getCurrentUser } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/rbac";

export default async function MaidLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.roleCode !== "MAID") redirect(defaultRouteForRole(user.roleCode));

  return (
    <div className="min-h-screen bg-muted pb-20">
      <PwaRegister />
      <QueueFlusher />
      {children}
      <TabBar />
    </div>
  );
}
