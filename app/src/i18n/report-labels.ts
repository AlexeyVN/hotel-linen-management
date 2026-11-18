import type { Locale } from "@/i18n/config";

export interface ReportLabels {
  stockHeaders: string[];
  movementsHeaders: string[];
  lowStockHeaders: string[];
  noPriceHeaders: string[];
  maidTaskHeaders: string[];
  taskHeaders: string[];
  reportStock: string;
  reportMovements: string;
  reportLowStock: string;
  reportNoPrice: string;
  reportMaidTasks: string;
  reportTasks: string;
  typeReceive: string;
  typeDistribute: string;
  typeReturn: string;
  typeWriteoff: string;
  typeAudit: string;
  cleaningDaily: string;
  cleaningOnDemand: string;
  cleaningGeneral: string;
  priorityLow: string;
  priorityMedium: string;
  priorityUrgent: string;
  taskNew: string;
  taskInProgress: string;
  taskDone: string;
  taskCancelled: string;
  warehouse: string;
  generatedAt: string;
  preparedBy: string;
  responsible: string;
  position: string;
  signature: string;
  date: string;
  page: string;
}

const LABELS: Record<Locale, ReportLabels> = {
  ru: {
    stockHeaders: ["Позиция", "Категория", "Единица", "Остаток", "Цена", "Стоимость", "Дата поступления"],
    movementsHeaders: ["Дата документа", "Операция", "Номер", "Позиция", "Количество", "Цена", "Сумма", "Расхождение", "Причина", "Автор"],
    lowStockHeaders: ["Номер", "Позиция", "Единица", "Есть", "Минимум", "Не хватает", "Цена", "Стоимость дефицита"],
    noPriceHeaders: ["Позиция", "Категория", "Единица", "Остаток"],
    maidTaskHeaders: ["Дата создания", "Горничная", "Номер", "Тип", "Приоритет", "Статус", "План, мин", "Факт, мин", "Начало", "Завершение"],
    taskHeaders: ["Создана", "Номер", "Тип", "Приоритет", "Статус", "Исполнитель", "План, мин", "Факт, мин"],
    reportStock: "Остатки склада",
    reportMovements: "Движения",
    reportLowStock: "Дефицит по минимальным остаткам",
    reportNoPrice: "Позиции без цены",
    reportMaidTasks: "Задания горничных",
    reportTasks: "Задания уборки",
    typeReceive: "Приёмка",
    typeDistribute: "Раздача",
    typeReturn: "Возврат",
    typeWriteoff: "Списание",
    typeAudit: "Инвентаризация",
    cleaningDaily: "Ежедневная",
    cleaningOnDemand: "По требованию",
    cleaningGeneral: "Генеральная",
    priorityLow: "Низкий",
    priorityMedium: "Средний",
    priorityUrgent: "Срочно",
    taskNew: "Новая",
    taskInProgress: "В работе",
    taskDone: "Выполнена",
    taskCancelled: "Отменена",
    warehouse: "склад",
    generatedAt: "Дата формирования",
    preparedBy: "Составил",
    responsible: "Ответственный",
    position: "Должность",
    signature: "Подпись",
    date: "Дата",
    page: "Стр.",
  },
  en: {
    stockHeaders: ["Item", "Category", "Unit", "Stock", "Price", "Value", "Receipt date"],
    movementsHeaders: ["Document date", "Operation", "Room", "Item", "Quantity", "Price", "Amount", "Difference", "Reason", "Author"],
    lowStockHeaders: ["Room", "Item", "Unit", "Have", "Minimum", "Missing", "Price", "Shortage value"],
    noPriceHeaders: ["Item", "Category", "Unit", "Stock"],
    maidTaskHeaders: ["Created", "Maid", "Room", "Type", "Priority", "Status", "Plan, min", "Actual, min", "Start", "End"],
    taskHeaders: ["Created", "Room", "Type", "Priority", "Status", "Assignee", "Plan, min", "Actual, min"],
    reportStock: "Warehouse stock",
    reportMovements: "Movements",
    reportLowStock: "Minimum-stock shortages",
    reportNoPrice: "Items without a price",
    reportMaidTasks: "Maid tasks",
    reportTasks: "Cleaning tasks",
    typeReceive: "Receiving",
    typeDistribute: "Distribution",
    typeReturn: "Return",
    typeWriteoff: "Write-off",
    typeAudit: "Inventory count",
    cleaningDaily: "Daily",
    cleaningOnDemand: "On demand",
    cleaningGeneral: "General",
    priorityLow: "Low",
    priorityMedium: "Medium",
    priorityUrgent: "Urgent",
    taskNew: "New",
    taskInProgress: "In progress",
    taskDone: "Done",
    taskCancelled: "Cancelled",
    warehouse: "warehouse",
    generatedAt: "Generated at",
    preparedBy: "Prepared by",
    responsible: "Responsible",
    position: "Position",
    signature: "Signature",
    date: "Date",
    page: "Page",
  },
  es: {
    stockHeaders: ["Artículo", "Categoría", "Unidad", "Existencias", "Precio", "Valor", "Fecha de recepción"],
    movementsHeaders: ["Fecha del documento", "Operación", "Habitación", "Artículo", "Cantidad", "Precio", "Importe", "Diferencia", "Motivo", "Autor"],
    lowStockHeaders: ["Habitación", "Artículo", "Unidad", "Hay", "Mínimo", "Falta", "Precio", "Valor del faltante"],
    noPriceHeaders: ["Artículo", "Categoría", "Unidad", "Existencias"],
    maidTaskHeaders: ["Creada", "Gobernanta", "Habitación", "Tipo", "Prioridad", "Estado", "Plan, min", "Real, min", "Inicio", "Fin"],
    taskHeaders: ["Creada", "Habitación", "Tipo", "Prioridad", "Estado", "Responsable", "Plan, min", "Real, min"],
    reportStock: "Existencias del almacén",
    reportMovements: "Movimientos",
    reportLowStock: "Faltantes según mínimos",
    reportNoPrice: "Artículos sin precio",
    reportMaidTasks: "Tareas de gobernantas",
    reportTasks: "Tareas de limpieza",
    typeReceive: "Recepción",
    typeDistribute: "Distribución",
    typeReturn: "Devolución",
    typeWriteoff: "Baja",
    typeAudit: "Inventario",
    cleaningDaily: "Diaria",
    cleaningOnDemand: "A demanda",
    cleaningGeneral: "General",
    priorityLow: "Baja",
    priorityMedium: "Media",
    priorityUrgent: "Urgente",
    taskNew: "Nueva",
    taskInProgress: "En curso",
    taskDone: "Completada",
    taskCancelled: "Cancelada",
    warehouse: "almacén",
    generatedAt: "Fecha de generación",
    preparedBy: "Preparado por",
    responsible: "Responsable",
    position: "Cargo",
    signature: "Firma",
    date: "Fecha",
    page: "Pág.",
  },
  it: {
    stockHeaders: ["Articolo", "Categoria", "Unità", "Scorte", "Prezzo", "Valore", "Data di ricezione"],
    movementsHeaders: ["Data documento", "Operazione", "Camera", "Articolo", "Quantità", "Prezzo", "Importo", "Differenza", "Motivo", "Autore"],
    lowStockHeaders: ["Camera", "Articolo", "Unità", "Disponibili", "Minimo", "Mancano", "Prezzo", "Valore carenza"],
    noPriceHeaders: ["Articolo", "Categoria", "Unità", "Scorte"],
    maidTaskHeaders: ["Creata", "Governante", "Camera", "Tipo", "Priorità", "Stato", "Piano, min", "Effettivo, min", "Inizio", "Fine"],
    taskHeaders: ["Creata", "Camera", "Tipo", "Priorità", "Stato", "Assegnatario", "Piano, min", "Effettivo, min"],
    reportStock: "Scorte di magazzino",
    reportMovements: "Movimenti",
    reportLowStock: "Carenze secondo i minimi",
    reportNoPrice: "Articoli senza prezzo",
    reportMaidTasks: "Attività delle governanti",
    reportTasks: "Attività di pulizia",
    typeReceive: "Ricezione",
    typeDistribute: "Distribuzione",
    typeReturn: "Reso",
    typeWriteoff: "Dismissione",
    typeAudit: "Inventario",
    cleaningDaily: "Giornaliera",
    cleaningOnDemand: "Su richiesta",
    cleaningGeneral: "Generale",
    priorityLow: "Bassa",
    priorityMedium: "Media",
    priorityUrgent: "Urgente",
    taskNew: "Nuova",
    taskInProgress: "In corso",
    taskDone: "Completata",
    taskCancelled: "Annullata",
    warehouse: "magazzino",
    generatedAt: "Data di generazione",
    preparedBy: "Preparato da",
    responsible: "Responsabile",
    position: "Ruolo",
    signature: "Firma",
    date: "Data",
    page: "Pag.",
  },
  de: {
    stockHeaders: ["Artikel", "Kategorie", "Einheit", "Bestand", "Preis", "Wert", "Wareneingangsdatum"],
    movementsHeaders: ["Dokumentdatum", "Vorgang", "Zimmer", "Artikel", "Menge", "Preis", "Betrag", "Differenz", "Grund", "Autor"],
    lowStockHeaders: ["Zimmer", "Artikel", "Einheit", "Vorhanden", "Minimum", "Fehlt", "Preis", "Fehlmengenwert"],
    noPriceHeaders: ["Artikel", "Kategorie", "Einheit", "Bestand"],
    maidTaskHeaders: ["Erstellt", "Zimmermädchen", "Zimmer", "Typ", "Priorität", "Status", "Plan, Min.", "Ist, Min.", "Start", "Ende"],
    taskHeaders: ["Erstellt", "Zimmer", "Typ", "Priorität", "Status", "Zugewiesen", "Plan, Min.", "Ist, Min."],
    reportStock: "Lagerbestand",
    reportMovements: "Bewegungen",
    reportLowStock: "Fehlmengen nach Mindestbestand",
    reportNoPrice: "Artikel ohne Preis",
    reportMaidTasks: "Aufgaben der Zimmermädchen",
    reportTasks: "Reinigungsaufgaben",
    typeReceive: "Wareneingang",
    typeDistribute: "Ausgabe",
    typeReturn: "Rückgabe",
    typeWriteoff: "Abschreibung",
    typeAudit: "Inventur",
    cleaningDaily: "Täglich",
    cleaningOnDemand: "Auf Anfrage",
    cleaningGeneral: "Grundreinigung",
    priorityLow: "Niedrig",
    priorityMedium: "Mittel",
    priorityUrgent: "Dringend",
    taskNew: "Neu",
    taskInProgress: "In Arbeit",
    taskDone: "Erledigt",
    taskCancelled: "Abgebrochen",
    warehouse: "Lager",
    generatedAt: "Erstellt am",
    preparedBy: "Erstellt von",
    responsible: "Verantwortlich",
    position: "Position",
    signature: "Unterschrift",
    date: "Datum",
    page: "Seite",
  },
};

export function getReportLabels(locale: string): ReportLabels {
  return LABELS[locale as Locale] ?? LABELS.en;
}
