"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      className="h-11 w-full"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Выйти
    </Button>
  );
}
