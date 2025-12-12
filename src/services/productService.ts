import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  runTransaction,
  increment,
  Transaction
} from 'firebase/firestore';
import { Product, CreditSettings } from '../types';

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

export async function getProduct(id: string): Promise<Product | null> {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Product;
  }
  return null;
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, userId: string) {
  await runTransaction(db, async (transaction: Transaction) => {
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
  notes: string = ''
) {
  await runTransaction(db, async (transaction: Transaction) => {
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
      createdAt: serverTimestamp()
    });
  });
}

import { StockHistory } from '../types';

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
  if (snapshot.exists()) {
    return snapshot.data() as CreditSettings;
  }
  // Default settings
  return {
    globalMarkupPercentage: 10, // Default 10%
    defaultTenor: 12,
    availableTenors: {
      weekly: [4, 8, 12, 16],
      monthly: [3, 6, 9, 12]
    }
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
  return principal / tenorCount;
}
