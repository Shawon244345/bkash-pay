import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'bkash-pay-db';
const STORE_NAME = 'transactions';
const SYNC_STORE = 'sync-queue';

export interface Transaction {
  id: string;
  payment_id: string;
  trx_id: string;
  amount: number;
  status: string;
  customer_msisdn: string;
  merchant_invoice: string;
  created_at: string;
}

export interface SyncAction {
  id: string;
  type: 'refund' | 'settings';
  payload: any;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SYNC_STORE)) {
          db.createObjectStore(SYNC_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const saveTransactions = async (transactions: Transaction[]) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const transaction of transactions) {
    await store.put(transaction);
  }
  await tx.done;
};

export const getLocalTransactions = async (): Promise<Transaction[]> => {
  const db = await getDB();
  return db.getAll(STORE_NAME);
};

export const clearLocalTransactions = async () => {
  const db = await getDB();
  await db.clear(STORE_NAME);
};

export const queueAction = async (action: Omit<SyncAction, 'id' | 'timestamp'>) => {
  const db = await getDB();
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  await db.put(SYNC_STORE, { ...action, id, timestamp });
  return id;
};

export const getSyncQueue = async (): Promise<SyncAction[]> => {
  const db = await getDB();
  return db.getAll(SYNC_STORE);
};

export const removeSyncAction = async (id: string) => {
  const db = await getDB();
  await db.delete(SYNC_STORE, id);
};
