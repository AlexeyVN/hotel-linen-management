import { OperationForm } from "@/components/operation-form";

export default function DistributePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Раздача в номер</h1>
        <p className="text-sm text-muted-foreground">
          Списывает со склада и добавляет в номер. Раздача больше остатка отклоняется.
        </p>
      </header>
      <OperationForm mode="DISTRIBUTE" />
    </div>
  );
}
