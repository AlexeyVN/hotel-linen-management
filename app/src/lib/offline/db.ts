/**
 * Очередь мутаций для офлайна (ТЗ §9.2): IndexedDB, порядок по createdAt,
 * идемпотентность — clientOpId на сервере.
 */

export type MutationKind = "DISTRIBUTE" | "SAVE_AUDIT_DRAFT" | "APPLY_AUDIT" | "TASK_STATUS";
export type MutationStatus = "pending" | "conflict" | "failed";

export interface QueuedMutation {
  id: string;
  kind: MutationKind;
  label: string;
  payload: unknown;
  clientOpId: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: MutationStatus;
  lastError?: string;
}

const DB_NAME = "hotel-linen-offline";
const STORE = "mutations";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB не открылся"));
  });
}

export async function addMutation(
  input: Omit<QueuedMutation, "id" | "createdAt" | "attempts" | "nextAttemptAt" | "status">,
): Promise<QueuedMutation> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB недоступен");
  const mutation: QueuedMutation = {
    ...input,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    status: "pending",
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(mutation);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
  return mutation;
}

export async function listMutations(): Promise<QueuedMutation[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const rows = await new Promise<QueuedMutation[]>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as QueuedMutation[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateMutation(
  id: string,
  patch: Partial<QueuedMutation>,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result as QueuedMutation | undefined;
      if (current) store.put({ ...current, ...patch, id });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
}

export async function removeMutation(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
