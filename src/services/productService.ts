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
  serverTimestamp
} from 'firebase/firestore';
import { Product, CreditSettings } from '../types';

export const PRODUCTS_COLLECTION = 'products';
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

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
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
    defaultTenor: 12
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
  tenorMonths: number
): number {
  const principal = creditPrice - dp;
  if (principal <= 0) return 0;
  if (tenorMonths <= 0) return principal;
  return principal / tenorMonths;
}
