import { OperationForm } from "@/components/operation-form";

export default function ReceivePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Приёмка на склад</h1>
        <p className="text-sm text-muted-foreground">
          Поступление позиций увеличивает остаток склада одной транзакцией.
        </p>
      </header>
      <OperationForm mode="RECEIVE" />
    </div>
  );
}
