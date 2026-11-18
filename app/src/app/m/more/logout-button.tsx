"use client";

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function MobileLogoutButton() {
  const t = useTranslations("mobile");

  return (
    <Button
      variant="outline"
      className="h-11 w-full"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {t("more.logout")}
    </Button>
  );
}
