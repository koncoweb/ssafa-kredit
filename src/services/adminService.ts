import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export async function resetDatabase() {
  try {
    console.log('Starting database reset (Admin initiated)...');
    
    // 1. Delete Transactions
    await deleteCollection('transactions');
    
    // 2. Delete Stock History
    await deleteCollection('stock_history');
    
    // 3. Reset Customers Debt
    await resetCustomersDebt();
    
    // 4. Reset Financial Stats
    await setDoc(doc(db, 'stats', 'financials'), {
      totalReceivables: 0,
      updatedAt: serverTimestamp()
    });

    console.log('Database reset completed successfully.');
    return true;
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
}

async function deleteCollection(collectionName: string) {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  
  if (snapshot.empty) return;

  const batches = [];
  let batch = writeBatch(db);
  let count = 0;

  snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
    batch.delete(doc.ref);
    count++;

    if (count === 500) {
      batches.push(batch.commit());
      batch = writeBatch(db);
      count = 0;
    }
  });

  if (count > 0) {
    batches.push(batch.commit());
  }

  await Promise.all(batches);
}

async function resetCustomersDebt() {
  const colRef = collection(db, 'customers');
  const snapshot = await getDocs(colRef);

  if (snapshot.empty) return;

  const batches = [];
  let batch = writeBatch(db);
  let count = 0;

  snapshot.docs.forEach((docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
    batch.update(docSnapshot.ref, { 
      totalDebt: 0,
      currentDebt: 0,
      updatedAt: serverTimestamp()
    });
    count++;

    if (count === 500) {
      batches.push(batch.commit());
      batch = writeBatch(db);
      count = 0;
    }
  });

  if (count > 0) {
    batches.push(batch.commit());
  }

  await Promise.all(batches);
}
