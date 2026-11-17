import { OperationForm } from "@/components/operation-form";

export default function WriteOffPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Списание</h1>
        <p className="text-sm text-muted-foreground">
          Причина обязательна: пункт из справочника или свободный текст. Списание
          необратимо, исправление — только новой операцией.
        </p>
      </header>
      <OperationForm mode="WRITE_OFF" />
    </div>
  );
}
