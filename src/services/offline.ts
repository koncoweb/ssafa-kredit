import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processPayment } from './transactionService';
import { updateCustomerProfile, getCustomerData, createCreditRequest } from './firestore';

type Priority = 'critical' | 'high' | 'medium' | 'low';
type DataFormat = 'json' | 'blob' | 'text';
type SyncStatus = 'queued' | 'synced' | 'failed' | 'conflict';

export type OfflineLogEntry = {
  id: string;
  type: 'enqueue' | 'synced' | 'retry' | 'conflict' | 'failed' | 'update';
  itemId?: string;
  itemType?: string;
  attempts?: number;
  at: number;
  code?: string;
  message?: string;
};

export type OfflineItem = {
  id: string;
  type: string;
  priority: Priority;
  maxSize: number;
  format: DataFormat;
  data: any;
  metadata: {
    userId: string;
    timestamp: number;
    syncStatus: SyncStatus;
    attempts?: number;
    nextTryAt?: number;
    sensitive?: boolean;
    lastErrorCode?: string;
    lastErrorMessage?: string;
    lastErrorAt?: number;
  };
};

type OfflineItemMetadataInput = {
  userId: string;
  sensitive?: boolean;
};

type Listener = (event: string, payload?: any) => void;

let listeners: Listener[] = [];
let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
let idb: IDBDatabase | null = null;

const OFFLINE_QUEUE_KEY = 'offline_queue';
const OFFLINE_LOGS_KEY = 'offline_logs';
const MAX_ATTEMPTS = 5;

function nativePayloadKey(id: string) {
  return `offline_payload_${id}`;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function emit(event: string, payload?: any) {
  listeners.forEach((l) => l(event, payload));
}

export function subscribe(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ssafa_offline', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function ensureIDB() {
  if (idb) return idb;
  idb = await openIDB();
  return idb;
}

function generateId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function encryptWeb(data: any, keySeed: string) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(keySeed), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ssafa-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  const out = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...out));
}

function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function decryptWeb(payload: string, keySeed: string) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(keySeed), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ssafa-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const bytes = base64ToBytes(payload);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  const raw = dec.decode(new Uint8Array(plaintext));
  return JSON.parse(raw);
}

function redactNative(data: any) {
  return { redacted: true };
}

async function getSecureStore() {
  try {
    const mod = await import('expo-secure-store');
    return mod;
  } catch {
    return null;
  }
}

async function setNativeSensitivePayload(id: string, data: any) {
  const SecureStore = await getSecureStore();
  if (!SecureStore?.setItemAsync) return false;
  try {
    await SecureStore.setItemAsync(nativePayloadKey(id), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

async function getNativeSensitivePayload(id: string) {
  const SecureStore = await getSecureStore();
  if (!SecureStore?.getItemAsync) return null;
  try {
    const raw = await SecureStore.getItemAsync(nativePayloadKey(id));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function deleteNativeSensitivePayload(id: string) {
  const SecureStore = await getSecureStore();
  if (!SecureStore?.deleteItemAsync) return;
  try {
    await SecureStore.deleteItemAsync(nativePayloadKey(id));
  } catch {}
}

async function storeWeb(item: OfflineItem) {
  const db = await ensureIDB();
  const tx = db.transaction('queue', 'readwrite');
  tx.objectStore('queue').put(item);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllWeb(): Promise<OfflineItem[]> {
  const db = await ensureIDB();
  const tx = db.transaction('queue', 'readonly');
  const store = tx.objectStore('queue');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as OfflineItem[]);
    req.onerror = () => reject(req.error);
  });
}

async function removeWeb(id: string) {
  const db = await ensureIDB();
  const tx = db.transaction('queue', 'readwrite');
  tx.objectStore('queue').delete(id);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function logWeb(entry: any) {
  const db = await ensureIDB();
  const tx = db.transaction('logs', 'readwrite');
  tx.objectStore('logs').put({ id: generateId(), ...entry });
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllLogsWeb(): Promise<OfflineLogEntry[]> {
  const db = await ensureIDB();
  const tx = db.transaction('logs', 'readonly');
  const store = tx.objectStore('logs');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as OfflineLogEntry[]);
    req.onerror = () => reject(req.error);
  });
}

async function getAllNative(): Promise<OfflineItem[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineItem[];
  } catch {
    return [];
  }
}

async function storeNative(item: OfflineItem) {
  const items = await getAllNative();
  const idx = items.findIndex((i) => i.id === item.id);
  const next = idx >= 0 ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item];
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
}

async function removeNative(id: string) {
  const items = await getAllNative();
  const item = items.find((i) => i.id === id);
  if (item?.metadata?.sensitive) {
    await deleteNativeSensitivePayload(id);
  }
  const next = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
}

async function logNative(entry: any) {
  const raw = await AsyncStorage.getItem(OFFLINE_LOGS_KEY);
  const arr = raw ? JSON.parse(raw) : [];
  arr.push({ id: generateId(), ...entry });
  await AsyncStorage.setItem(OFFLINE_LOGS_KEY, JSON.stringify(arr));
}

async function getAllLogsNative(): Promise<OfflineLogEntry[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_LOGS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineLogEntry[];
  } catch {
    return [];
  }
}

export async function getQueue(): Promise<OfflineItem[]> {
  return Platform.OS === 'web' ? await getAllWeb() : await getAllNative();
}

export async function getLogs(): Promise<OfflineLogEntry[]> {
  return Platform.OS === 'web' ? await getAllLogsWeb() : await getAllLogsNative();
}

export function isOnline() {
  return online;
}

export async function initOffline() {
  if (Platform.OS === 'web') {
    window.addEventListener('online', () => {
      online = true;
      emit('online');
      triggerBackgroundSync();
    });
    window.addEventListener('offline', () => {
      online = false;
      emit('offline');
    });
  }
  if (Platform.OS !== 'web') {
    startNativePolling();
  }
}

export async function registerServiceWorker() {
  if (Platform.OS !== 'web') return;
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    if ('sync' in reg) {
      try {
        const syncManager = (reg as any).sync;
        if (syncManager?.register) {
          await syncManager.register('offline-sync');
        }
      } catch {}
    }
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data === 'perform-sync') {
        syncAll();
      }
    });
  } catch {}
}

function triggerBackgroundSync() {
  if (Platform.OS !== 'web') {
    syncAll();
    return;
  }
  if (!navigator.serviceWorker) {
    syncAll();
    return;
  }
  navigator.serviceWorker.ready
    .then((reg) => {
      if ('sync' in reg) {
        const syncManager = (reg as any).sync;
        if (syncManager?.register) {
          return syncManager.register('offline-sync');
        }
        syncAll();
        return;
      } else {
        syncAll();
      }
    })
    .catch(() => syncAll());
}

export async function enqueue(item: Omit<OfflineItem, 'id' | 'metadata'> & { metadata: OfflineItemMetadataInput }) {
  return await upsertQueuedItem({ ...item });
}

export async function upsertQueuedItem(item: Omit<OfflineItem, 'id' | 'metadata'> & { id?: string; metadata: OfflineItemMetadataInput }) {
  const id = item.id || generateId();
  const payload: OfflineItem = {
    ...item,
    id,
    metadata: {
      ...item.metadata,
      timestamp: Date.now(),
      syncStatus: 'queued',
      attempts: 0,
      nextTryAt: undefined,
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
      lastErrorAt: undefined,
    },
  };
  const size = JSON.stringify(payload.data).length;
  if (size > payload.maxSize) {
    emit('offline-save-failed', { id, reason: 'too_large' });
    return id;
  }
  if (Platform.OS === 'web') {
    const toStore = { ...payload };
    if (payload.metadata.sensitive) {
      try {
        toStore.data = await encryptWeb(payload.data, payload.metadata.userId);
      } catch {
        emit('offline-save-failed', { id, reason: 'encrypt_failed' });
        return id;
      }
    }
    await storeWeb(toStore);
    await logWeb({ type: item.id ? 'update' : 'enqueue', itemId: id, itemType: payload.type, at: Date.now() });
  } else {
    const toStore = { ...payload };
    if (payload.metadata.sensitive) {
      const ok = await setNativeSensitivePayload(id, payload.data);
      if (ok) {
        toStore.data = redactNative(payload.data);
      }
    }
    await storeNative(toStore);
    await logNative({ type: item.id ? 'update' : 'enqueue', itemId: id, itemType: payload.type, at: Date.now() });
  }
  emit('offline-saved', { id });
  return id;
}

function normalizeError(e: any): { code?: string; message?: string } {
  const code = typeof e?.code === 'string' ? e.code : undefined;
  const message = typeof e?.message === 'string' ? e.message : undefined;
  return { code, message };
}

function isConflict(code?: string) {
  return code === 'permission-denied' || code === 'failed-precondition' || code === 'already-exists';
}

async function resolveItemData(item: OfflineItem) {
  if (Platform.OS === 'web') {
    if (item.metadata.sensitive && typeof item.data === 'string') {
      try {
        return await decryptWeb(item.data, item.metadata.userId);
      } catch {
        return item.data;
      }
    }
    return item.data;
  }
  const redacted = item?.data && typeof item.data === 'object' && item.data.redacted === true;
  if (item.metadata.sensitive && redacted) {
    const data = await getNativeSensitivePayload(item.id);
    if (data !== null) return data;
  }
  return item.data;
}

export async function resolveQueuedItemData(item: OfflineItem) {
  return await resolveItemData(item);
}

async function handleSyncItem(item: OfflineItem) {
  try {
    const data = await resolveItemData(item);
    if (item.type === 'payment') {
      await processPayment({
        customerId: data.customerId,
        customerName: data.customerName,
        amount: data.amount,
        notes: data.notes,
        collectorId: data.collectorId,
        collectorName: data.collectorName,
      });
    } else if (item.type === 'updateCustomerProfile') {
      const current = await getCustomerData(data.uid);
      const lastServerUpdate = (current?.updatedAt?.toDate?.() as Date) || new Date(0);
      const clientStamp = new Date(item.metadata.timestamp);
      if (lastServerUpdate.getTime() > clientStamp.getTime()) {
        item.metadata.syncStatus = 'conflict';
        item.metadata.lastErrorCode = 'conflict';
        item.metadata.lastErrorMessage = 'server_data_newer';
        item.metadata.lastErrorAt = Date.now();
        if (Platform.OS === 'web') {
          await storeWeb(item);
          await logWeb({ type: 'conflict', itemId: item.id, itemType: item.type, at: Date.now(), code: 'conflict' });
        } else {
          await storeNative(item);
          await logNative({ type: 'conflict', itemId: item.id, itemType: item.type, at: Date.now(), code: 'conflict' });
        }
        emit('offline-conflict', { id: item.id });
        return true;
      }
      await updateCustomerProfile(data.uid, data.update);
    } else if (item.type === 'creditRequest') {
      await createCreditRequest(data);
    }
    return true;
  } catch (e: any) {
    const { code, message } = normalizeError(e);
    item.metadata.lastErrorCode = code;
    item.metadata.lastErrorMessage = message;
    item.metadata.lastErrorAt = Date.now();
    if (code && isConflict(code)) {
      item.metadata.syncStatus = 'conflict';
      if (Platform.OS === 'web') {
        await storeWeb(item);
        await logWeb({ type: 'conflict', itemId: item.id, itemType: item.type, at: Date.now(), code, message });
      } else {
        await storeNative(item);
        await logNative({ type: 'conflict', itemId: item.id, itemType: item.type, at: Date.now(), code, message });
      }
      emit('offline-conflict', { id: item.id });
      return true;
    }
    return false;
  }
}

function sortByPriority(items: OfflineItem[]) {
  return items.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    return a.metadata.timestamp - b.metadata.timestamp;
  });
}

export async function syncAll() {
  if (!isOnline()) return;
  const items = Platform.OS === 'web' ? await getAllWeb() : await getAllNative();
  const sorted = sortByPriority(items);
  for (const item of sorted) {
    const now = Date.now();
    if (item.metadata.syncStatus === 'conflict' || item.metadata.syncStatus === 'failed') {
      continue;
    }
    if (item.metadata.nextTryAt && item.metadata.nextTryAt > now) {
      continue;
    }
    const ok = await handleSyncItem(item);
    if (ok) {
      if (Platform.OS === 'web') {
        await removeWeb(item.id);
        await logWeb({ type: 'synced', itemId: item.id, itemType: item.type, at: Date.now() });
      } else {
        await removeNative(item.id);
        await logNative({ type: 'synced', itemId: item.id, itemType: item.type, at: Date.now() });
      }
      emit('offline-synced', { id: item.id });
    } else {
      const attempts = (item.metadata.attempts || 0) + 1;
      item.metadata.attempts = attempts;

      if (attempts >= MAX_ATTEMPTS) {
        item.metadata.syncStatus = 'failed';
        item.metadata.nextTryAt = undefined;
        if (Platform.OS === 'web') {
          await storeWeb(item);
          await logWeb({ type: 'failed', itemId: item.id, itemType: item.type, attempts, at: Date.now(), code: item.metadata.lastErrorCode, message: item.metadata.lastErrorMessage });
        } else {
          await storeNative(item);
          await logNative({ type: 'failed', itemId: item.id, itemType: item.type, attempts, at: Date.now(), code: item.metadata.lastErrorCode, message: item.metadata.lastErrorMessage });
        }
        emit('offline-failed', { id: item.id });
        continue;
      }

      const delay = Math.min(60000, Math.pow(2, attempts) * 1000);
      item.metadata.nextTryAt = Date.now() + delay;
      if (Platform.OS === 'web') {
        await storeWeb(item);
        await logWeb({ type: 'retry', itemId: item.id, itemType: item.type, attempts, at: Date.now(), code: item.metadata.lastErrorCode, message: item.metadata.lastErrorMessage });
      } else {
        await storeNative(item);
        await logNative({ type: 'retry', itemId: item.id, itemType: item.type, attempts, at: Date.now(), code: item.metadata.lastErrorCode, message: item.metadata.lastErrorMessage });
      }
      setTimeout(() => {
        syncAll();
      }, delay);
    }
  }
}

function fetchWithTimeout(url: string, ms: number) {
  return Promise.race([
    fetch(url, { cache: 'no-store' }),
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function startNativePolling() {
  let last = online;
  const tick = async () => {
    try {
      await fetchWithTimeout('https://www.googleapis.com/generate_204', 3000);
      online = true;
    } catch {
      online = false;
    }
    if (online !== last) {
      last = online;
      emit(online ? 'online' : 'offline');
      if (online) {
        syncAll();
      }
    }
  };
  tick();
  setInterval(tick, 5000);
}
