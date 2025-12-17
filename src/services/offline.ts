import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { processPayment } from './transactionService';
import { updateCustomerProfile, getCustomerData } from './firestore';

type Priority = 'critical' | 'high' | 'medium' | 'low';
type DataFormat = 'json' | 'blob' | 'text';
type SyncStatus = 'queued' | 'synced' | 'failed' | 'conflict';

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
  };
};

type Listener = (event: string, payload?: any) => void;

let listeners: Listener[] = [];
let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
let idb: IDBDatabase | null = null;

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

function redactNative(data: any) {
  return { redacted: true };
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

async function getAllNative(): Promise<OfflineItem[]> {
  const raw = await AsyncStorage.getItem('offline_queue');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineItem[];
  } catch {
    return [];
  }
}

async function storeNative(item: OfflineItem) {
  const items = await getAllNative();
  items.push(item);
  await AsyncStorage.setItem('offline_queue', JSON.stringify(items));
}

async function removeNative(id: string) {
  const items = await getAllNative();
  const next = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem('offline_queue', JSON.stringify(next));
}

async function logNative(entry: any) {
  const raw = await AsyncStorage.getItem('offline_logs');
  const arr = raw ? JSON.parse(raw) : [];
  arr.push({ id: generateId(), ...entry });
  await AsyncStorage.setItem('offline_logs', JSON.stringify(arr));
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
        await reg.sync.register('offline-sync');
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
        return reg.sync.register('offline-sync');
      } else {
        syncAll();
      }
    })
    .catch(() => syncAll());
}

export async function enqueue(item: Omit<OfflineItem, 'id' | 'metadata'> & { metadata: Omit<OfflineItem['metadata'], 'syncStatus'> }) {
  const id = generateId();
  const payload: OfflineItem = {
    ...item,
    id,
    metadata: {
      ...item.metadata,
      timestamp: Date.now(),
      syncStatus: 'queued',
      attempts: 0,
    },
  };
  const size = JSON.stringify(payload.data).length;
  if (size > payload.maxSize) {
    emit('offline-save-failed', { id, reason: 'too_large' });
    return;
  }
  if (Platform.OS === 'web') {
    const toStore = { ...payload };
    if (payload.metadata.sensitive) {
      try {
        toStore.data = await encryptWeb(payload.data, payload.metadata.userId);
      } catch {
        emit('offline-save-failed', { id, reason: 'encrypt_failed' });
        return;
      }
    }
    await storeWeb(toStore);
    await logWeb({ type: 'enqueue', id, at: Date.now() });
  } else {
    const toStore = { ...payload };
    if (payload.metadata.sensitive) {
      toStore.data = redactNative(payload.data);
    }
    await storeNative(toStore);
    await logNative({ type: 'enqueue', id, at: Date.now() });
  }
  emit('offline-saved', { id });
}

async function handleSyncItem(item: OfflineItem) {
  try {
    if (item.type === 'payment') {
      await processPayment({
        customerId: item.data.customerId,
        customerName: item.data.customerName,
        amount: item.data.amount,
        notes: item.data.notes,
        collectorId: item.data.collectorId,
        collectorName: item.data.collectorName,
      });
    } else if (item.type === 'updateCustomerProfile') {
      const current = await getCustomerData(item.data.uid);
      const lastServerUpdate = (current?.updatedAt?.toDate?.() as Date) || new Date(0);
      const clientStamp = new Date(item.metadata.timestamp);
      if (lastServerUpdate.getTime() > clientStamp.getTime()) {
        emit('offline-conflict', { id: item.id });
        return false;
      }
      await updateCustomerProfile(item.data.uid, item.data.update);
    }
    return true;
  } catch (e: any) {
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
    const ok = await handleSyncItem(item);
    if (ok) {
      if (Platform.OS === 'web') {
        await removeWeb(item.id);
        await logWeb({ type: 'synced', id: item.id, at: Date.now() });
      } else {
        await removeNative(item.id);
        await logNative({ type: 'synced', id: item.id, at: Date.now() });
      }
      emit('offline-synced', { id: item.id });
    } else {
      const attempts = (item.metadata.attempts || 0) + 1;
      const delay = Math.min(60000, Math.pow(2, attempts) * 1000);
      item.metadata.attempts = attempts;
      item.metadata.nextTryAt = Date.now() + delay;
      if (Platform.OS === 'web') {
        await storeWeb(item);
        await logWeb({ type: 'retry', id: item.id, attempts, at: Date.now() });
      } else {
        await storeNative(item);
        await logNative({ type: 'retry', id: item.id, attempts, at: Date.now() });
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
