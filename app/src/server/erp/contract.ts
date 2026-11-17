/**
 * Контракт интеграции с 1С Отель (ТЗ v2.3 §8.5).
 * Адаптер не знает про нашу БД: только DTO и результат.
 */

export type IntegrationMode = "stub" | "onec";

export interface ErpItemDto {
  externalId: string;
  name: string;
  unit?: string;
  categoryCode?: string;
}

export interface ErpOperationLineDto {
  externalId: string;
  qty: number;
  /** Цена на момент выгрузки, копейки (ТЗ v2.6). */
  unitPriceKopecks?: number;
  totalKopecks?: number;
}

export interface ErpOperationDto {
  id: string;
  type: string;
  roomNumber?: string;
  reason?: string;
  createdAt: string;
  /** Дата документа (приёмка — дата поступления). */
  documentDate?: string;
  items: ErpOperationLineDto[];
}

export interface ErpPushResult {
  ok: boolean;
  externalRef?: string;
  error?: string;
}

export interface ErpRoomStatusDto {
  eventId: string;
  roomNumber: string;
  status: string;
  occurredAt: string;
}

export interface ErpPingResult {
  ok: boolean;
  details?: string;
}

export interface ErpAdapter {
  readonly name: string;
  ping(): Promise<ErpPingResult>;
  pullItems(since?: string): Promise<ErpItemDto[]>;
  pushOperation(operation: ErpOperationDto): Promise<ErpPushResult>;
  pushRoomStatus(status: ErpRoomStatusDto): Promise<ErpPushResult>;
}

/** Ошибка канала 1С: текст без логина/пароля, статус — для логов. */
export class ErpError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ErpError";
    this.status = status;
  }
}
