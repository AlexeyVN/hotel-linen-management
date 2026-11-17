import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/rbac";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(defaultRouteForRole(user.roleCode));
}
