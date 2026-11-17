/**
 * Заглушка 1С: позволяет проверить синхронизацию и отправку операций
 * без реального сервера 1С (ТЗ §8.4).
 */
import type {
  ErpAdapter,
  ErpItemDto,
  ErpOperationDto,
  ErpPingResult,
  ErpPushResult,
  ErpRoomStatusDto,
} from "../contract";

const STUB_ITEMS: ErpItemDto[] = [
  { externalId: "1C-101", name: "Комплект белья 2-сп (1С)", unit: "компл", categoryCode: "LINEN" },
  { externalId: "1C-102", name: "Халат (1С)", unit: "шт", categoryCode: "ITEM" },
  { externalId: "1C-103", name: "Дезинфектор (1С)", unit: "л", categoryCode: "CHEMICAL" },
];

/** Отправленные операции — для проверок и демо. */
export const stubPushes: ErpOperationDto[] = [];
export const stubRoomStatusPushes: ErpRoomStatusDto[] = [];

export const stubAdapter: ErpAdapter = {
  name: "stub",

  async ping(): Promise<ErpPingResult> {
    return { ok: true, details: "Заглушка 1С активна" };
  },

  async pullItems(): Promise<ErpItemDto[]> {
    return STUB_ITEMS.map((item) => ({ ...item }));
  },

  async pushOperation(operation: ErpOperationDto): Promise<ErpPushResult> {
    stubPushes.push(operation);
    return { ok: true, externalRef: `STUB-${operation.id.slice(0, 8)}` };
  },

  async pushRoomStatus(status: ErpRoomStatusDto): Promise<ErpPushResult> {
    stubRoomStatusPushes.push(status);
    return { ok: true, externalRef: `STUB-ROOM-${status.eventId.slice(0, 8)}` };
  },
};
