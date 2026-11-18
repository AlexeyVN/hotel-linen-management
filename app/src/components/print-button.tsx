"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const t = useTranslations("qrPrint");
  return (
    <Button variant="outline" onClick={() => window.print()}>
      {t("print")}
    </Button>
  );
}
