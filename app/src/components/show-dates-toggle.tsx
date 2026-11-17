"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";

export function ShowDatesToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const t = useTranslations("settings");
  const utils = trpc.useUtils();
  const setShowDates = trpc.settings.setShowDates.useMutation();
  const [checked, setChecked] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle(next: boolean) {
    setChecked(next);
    setPending(true);
    try {
      await setShowDates.mutateAsync({ showDates: next });
      await utils.settings.get.invalidate();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(event) => toggle(event.target.checked)}
      />
      {t("showDates")}
    </label>
  );
}
