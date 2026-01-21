import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  limit as qLimit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { CreditSettings, Product, StockHistory } from '../types';
import { db } from './firebase';



export const PRODUCTS_COLLECTION = 'products';
export const STOCK_HISTORY_COLLECTION = 'stock_history';
export const SETTINGS_COLLECTION = 'settings';
export const CREDIT_SETTINGS_DOC = 'credit';

// --- Products ---

export async function getProducts(activeOnly: boolean = true): Promise<Product[]> {
  let q;
  if (activeOnly) {
    q = query(
      collection(db, PRODUCTS_COLLECTION),
      where('active', '==', true),
      orderBy('name')
    );
  } else {
    q = query(collection(db, PRODUCTS_COLLECTION), orderBy('name'));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Product));
}

let featuredCache: { ts: number; data: Product[] } | null = null;
export async function getFeaturedProducts(count: number = 8): Promise<Product[]> {
  const now = Date.now();
  if (featuredCache && (now - featuredCache.ts) < 60_000) {
    return featuredCache.data;
  }
  const q = query(
    collection(db, PRODUCTS_COLLECTION),
    where('active', '==', true),
    orderBy('name'),
    qLimit(count)
  );
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Product));
  featuredCache = { ts: now, data };
  return data;
}

export async function getProduct(id: string): Promise<Product | null> {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Product;
  }
  return null;
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, userId: string, userName?: string) {
  await runTransaction(db, async (transaction: any) => {
    const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
    
    transaction.set(newProductRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Log Initial Stock History
    if (data.stock > 0) {
      const historyRef = doc(collection(db, STOCK_HISTORY_COLLECTION));
      transaction.set(historyRef, {
        id: historyRef.id,
        productId: newProductRef.id,
        productName: data.name,
        oldStock: 0,
        newStock: data.stock,
        changeAmount: data.stock,
        type: 'restock',
        notes: 'Stok Awal',
        updatedBy: userId,
        updatedByName: userName,
        createdAt: serverTimestamp()
      });
    }
  });
}

export async function updateProduct(id: string, data: Partial<Product>) {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteProduct(id: string) {
  await deleteDoc(doc(db, PRODUCTS_COLLECTION, id));
}

export async function updateProductStock(
  productId: string, 
  newStock: number, 
  userId: string, 
  notes: string = '',
  userName?: string
) {
  await runTransaction(db, async (transaction: any) => {
    const productRef = doc(db, PRODUCTS_COLLECTION, productId);
    const productDoc = await transaction.get(productRef);

    if (!productDoc.exists()) {
      throw new Error("Produk tidak ditemukan!");
    }

    const currentStock = productDoc.data().stock || 0;
    const changeAmount = newStock - currentStock;

    if (changeAmount === 0) return;

    // Update product stock
    transaction.update(productRef, { 
      stock: newStock,
      updatedAt: serverTimestamp()
    });

    // Create history record
    const historyRef = doc(collection(db, STOCK_HISTORY_COLLECTION));
    transaction.set(historyRef, {
      id: historyRef.id,
      productId,
      productName: productDoc.data().name,
      oldStock: currentStock,
      newStock: newStock,
      changeAmount,
      type: 'manual_adjustment',
      notes,
      updatedBy: userId,
      updatedByName: userName,
      createdAt: serverTimestamp()
    });
  });
}

export async function getProductStockHistory(productId: string): Promise<StockHistory[]> {
  const q = query(
    collection(db, STOCK_HISTORY_COLLECTION),
    where('productId', '==', productId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: any) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date()
    } as StockHistory;
  });
}

// --- Settings ---

export async function getCreditSettings(): Promise<CreditSettings> {
  const docRef = doc(db, SETTINGS_COLLECTION, CREDIT_SETTINGS_DOC);
  const snapshot = await getDoc(docRef);
  const defaults: CreditSettings = {
    globalMarkupPercentage: 10,
    defaultTenor: 12,
    availableTenors: {
      weekly: [4, 8, 12, 16],
      monthly: [3, 6, 9, 12],
    },
  };
  if (!snapshot.exists()) {
    return defaults;
  }
  const data: any = snapshot.data() || {};
  const weekly =
    Array.isArray(data?.availableTenors?.weekly) && data.availableTenors.weekly.length > 0
      ? data.availableTenors.weekly
      : defaults.availableTenors.weekly;
  const monthly =
    Array.isArray(data?.availableTenors?.monthly) && data.availableTenors.monthly.length > 0
      ? data.availableTenors.monthly
      : defaults.availableTenors.monthly;
  const globalMarkup =
    typeof data.globalMarkupPercentage === 'number' ? data.globalMarkupPercentage : defaults.globalMarkupPercentage;
  const defaultTenor =
    typeof data.defaultTenor === 'number' ? data.defaultTenor : defaults.defaultTenor;
  return {
    globalMarkupPercentage: globalMarkup,
    defaultTenor,
    availableTenors: { weekly, monthly },
  };
}

export async function saveCreditSettings(settings: CreditSettings) {
  const docRef = doc(db, SETTINGS_COLLECTION, CREDIT_SETTINGS_DOC);
  await setDoc(docRef, settings, { merge: true });
}

// --- Calculations ---

export function calculateCreditPrice(
  cashPrice: number, 
  productMarkup?: number, 
  globalMarkup: number = 0
): number {
  const markup = productMarkup !== undefined && productMarkup !== null ? productMarkup : globalMarkup;
  return cashPrice + (cashPrice * (markup / 100));
}

export function calculateInstallment(
  creditPrice: number, 
  dp: number, 
  tenorCount: number
): number {
  const principal = creditPrice - dp;
  if (principal <= 0) return 0;
  if (tenorCount <= 0) return principal;
  return Math.floor(principal / tenorCount);
}
