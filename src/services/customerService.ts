import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAt,
  endAt
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Customer } from '../types';

const CUSTOMERS_COLLECTION = 'customers';

export async function getCustomers(limitCount = 20): Promise<Customer[]> {
  try {
    const q = query(
      collection(db, CUSTOMERS_COLLECTION),
      orderBy('name'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      ...doc.data()
    } as Customer));
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw error;
  }
}

export async function searchCustomers(searchTerm: string): Promise<Customer[]> {
  if (!searchTerm) return [];
  
  try {
    // Note: Firestore text search is limited. 
    // This is a simple prefix search (case-sensitive usually).
    // Ideally use Algolia or similar for robust search.
    const q = query(
      collection(db, CUSTOMERS_COLLECTION),
      orderBy('name'),
      startAt(searchTerm),
      endAt(searchTerm + '\uf8ff'),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      ...doc.data()
    } as Customer));
  } catch (error) {
    console.error("Error searching customers:", error);
    throw error;
  }
}
