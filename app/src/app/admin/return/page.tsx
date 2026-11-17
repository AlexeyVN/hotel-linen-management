import { OperationForm } from "@/components/operation-form";

export default function ReturnPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Возврат из номера</h1>
        <p className="text-sm text-muted-foreground">
          Возврат уменьшает остаток номера и увеличивает остаток склада.
        </p>
      </header>
      <OperationForm mode="RETURN" />
    </div>
  );
}
