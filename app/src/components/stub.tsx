import { Card, CardContent } from "@/components/ui/card";

export function StubPage({
  title,
  stage,
  description,
}: {
  title: string;
  stage: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm">
            Модуль реализуется на этапе <strong>{stage}</strong>. Каркас, права и
            навигация уже готовы — раздел отдаёт заглушку, а не 404.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
