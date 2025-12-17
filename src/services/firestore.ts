import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  collection, 
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  runTransaction,
  increment,
  deleteField
} from 'firebase/firestore';
import { STATS_COLLECTION, STATS_FINANCIALS_DOC } from './transactionService';

export async function setUserRole(uid: string, role: string) {
  await setDoc(doc(db, 'users', uid), { role }, { merge: true });
}

export async function getUserRole(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data().role as string) : null;
}

export interface UserDoc {
  uid: string;
  name?: string;
  email?: string;
  role: 'admin' | 'employee' | 'customer';
  updatedAt?: any;
  createdAt?: any;
}

export async function getAllUsers(): Promise<UserDoc[]> {
  const q = query(collection(db, 'users'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: any) => {
    const data = d.data();
    return {
      uid: d.id,
      name: data.name || '',
      email: data.email || '',
      role: (data.role || 'customer') as any,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    } as UserDoc;
  });
}

export async function changeUserRole(targetUid: string, newRole: 'admin' | 'employee' | 'customer', actorId: string, actorName?: string) {
  await runTransaction(db, async (transaction: any) => {
    const userRef = doc(db, 'users', targetUid);
    const userSnap = await transaction.get(userRef);
    const oldRole = userSnap.exists() ? (userSnap.data().role || 'customer') : null;
    
    transaction.set(userRef, { role: newRole, updatedAt: serverTimestamp() }, { merge: true });
    
    if (newRole === 'employee') {
      transaction.set(userRef, {
        target: 0,
        collected: 0,
        bonus: 0,
        internalDebt: 0,
        active: true
      }, { merge: true });
    } else {
      transaction.update(userRef, {
        target: deleteField(),
        collected: deleteField(),
        bonus: deleteField(),
        internalDebt: deleteField(),
        active: deleteField()
      });
    }
    
    const logRef = doc(collection(db, 'admin_logs'));
    transaction.set(logRef, {
      id: logRef.id,
      userId: targetUid,
      actorId,
      actorName: actorName || 'Admin',
      oldRole,
      newRole,
      createdAt: serverTimestamp()
    });
  });
}


export async function getTransactionsReport(filters?: {
  employeeId?: string | null;
  customerId?: string | null;
  startDate?: Date;
  endDate?: Date;
}) {
  let constraints: any[] = [orderBy('createdAt', 'desc')];
  
  if (filters?.employeeId) {
    constraints.push(where('employeeId', '==', filters.employeeId));
  }

  if (filters?.customerId) {
    constraints.push(where('customerId', '==', filters.customerId));
  }
  
  if (filters?.startDate) {
    constraints.push(where('createdAt', '>=', filters.startDate));
  }
  
  if (filters?.endDate) {
    constraints.push(where('createdAt', '<=', filters.endDate));
  }
  
  const q = query(collection(db, 'transactions'), ...constraints);
  
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d: any) => {
      const data = d.data();
      return { 
        id: d.id, 
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date() 
      };
    }) as Transaction[];
  } catch (error) {
    console.warn("Report query error (Check console for Index Link):", error);
    return [];
  }
}

export interface WATemplates {
  reminder: string;
  receipt: string;
  newCredit: string;
}

export async function getWATemplates(): Promise<WATemplates> {
  const snap = await getDoc(doc(db, 'settings', 'whatsapp'));
  if (snap.exists()) {
    return snap.data() as WATemplates;
  }
  return {
    reminder: 'Halo {nama}, tagihan Anda sebesar {jumlah} jatuh tempo pada {tanggal}. Mohon segera lakukan pembayaran.',
    receipt: 'Terima kasih {nama}, pembayaran sebesar {jumlah} telah diterima. Sisa utang: {sisa}.',
    newCredit: 'Halo {nama}, kredit baru sebesar {jumlah} telah disetujui. Total utang: {total}.'
  };
}

export async function saveWATemplates(templates: WATemplates) {
  await setDoc(doc(db, 'settings', 'whatsapp'), templates, { merge: true });
}

export interface CustomerData {
  uid: string;
  name: string;
  email: string;
  role: 'customer';
  phone: string;
  address: string;
  creditLimit: number;
  currentDebt: number; // Deprecated, use totalDebt
  totalDebt: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'credit' | 'payment';
  description?: string;
  createdAt: any;
  employeeId?: string;
}

export async function getCustomerData(uid: string): Promise<CustomerData | null> {
  const snap = await getDoc(doc(db, 'customers', uid));
  if (snap.exists()) {
    const data = snap.data();
    return { 
      uid: snap.id, 
      ...data, 
      phone: data.phone || '',
      address: data.address || '',
      totalDebt: data.totalDebt || data.currentDebt || 0,
      currentDebt: data.currentDebt || 0
    } as CustomerData;
  }
  return null;
}

export async function createCustomerProfile(uid: string, data: Partial<CustomerData>) {
  // 1. Create entry in users collection for RBAC
  await setDoc(doc(db, 'users', uid), {
    email: data.email,
    name: data.name || '',
    role: 'customer',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // 2. Create entry in customers collection
  // Ensure all fields are present to maintain consistency
  const customerData = {
    uid: uid,
    name: data.name || '',
    email: data.email || '',
    role: 'customer',
    phone: data.phone || '',
    address: data.address || '',
    creditLimit: data.creditLimit || 0,
    currentDebt: data.currentDebt || 0,
    totalDebt: data.totalDebt || 0,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'customers', uid), customerData, { merge: true });
}

export async function updateCustomerProfile(uid: string, data: Partial<CustomerData>) {
  await setDoc(doc(db, 'customers', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getCustomerTransactions(uid: string) {
  try {
    const q = query(
      collection(db, 'transactions'), 
      where('customerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Transaction[];
  } catch (error: any) {
    console.warn("Firestore query error (requires index?):", error);
    // Fallback if index missing or other error
    return [];
  }
}

export async function getAllCustomers() {
  const q = query(collection(db, 'customers'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: any) => {
    const data = d.data();
    return { 
      uid: d.id, 
      ...data,
      phone: data.phone || '',
      address: data.address || '',
      totalDebt: data.totalDebt || data.currentDebt || 0,
      currentDebt: data.currentDebt || 0
    };
  }) as CustomerData[];
}

export interface EmployeeData {
  uid: string;
  name: string;
  email: string;
  role: 'employee';
  phone?: string;
  target: number;
  collected: number;
  bonus: number;
  internalDebt: number;
  active: boolean;
}

export async function getEmployees() {
  const q = query(
    collection(db, 'users'), 
    where('role', '==', 'employee')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: any) => ({ uid: d.id, ...d.data() })) as EmployeeData[];
}

export async function updateEmployee(uid: string, data: Partial<EmployeeData>) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function createEmployeeProfile(uid: string, name: string, email: string) {
  const initialData: EmployeeData = {
    uid,
    name,
    email,
    role: 'employee',
    target: 0,
    collected: 0,
    bonus: 0,
    internalDebt: 0,
    active: true
  };
  // Save to users collection
  await setDoc(doc(db, 'users', uid), {
    ...initialData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createAdminProfile(uid: string, name: string, email: string) {
  await setDoc(doc(db, 'users', uid), {
    uid,
    name,
    email,
    role: 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getAdminStats() {
  // Simple client-side count for MVP
  const customersSnap = await getDocs(collection(db, 'customers'));
  const customersCount = customersSnap.size;

  let totalDebt = 0;
  let usedFallback = false;

  const statsRef = doc(db, STATS_COLLECTION, STATS_FINANCIALS_DOC);

  try {
    const statsSnap = await getDoc(statsRef);
    if (statsSnap.exists()) {
      totalDebt = statsSnap.data().totalReceivables || 0;
    } else {
      usedFallback = true;
    }
  } catch (e) {
    console.warn("Failed to fetch stats (using fallback):", e);
    usedFallback = true;
  }

  if (usedFallback) {
    // Fallback: Calculate from customers
    customersSnap.forEach((doc: any) => {
      const data = doc.data();
      totalDebt += (data.totalDebt || data.currentDebt || 0);
    });

    // Initialize stats doc if missing (and we have permission)
    try {
        await setDoc(statsRef, {
            totalReceivables: totalDebt,
            updatedAt: serverTimestamp()
        });
    } catch (e) {
        // Ignore write errors (likely permission denied or network)
        console.log("Skipping stats init due to error:", e);
    }
  }

  return {
    customersCount,
    totalDebt
  };
}

export interface CreditRequestInput {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  productId: string;
  productName?: string;
  productPriceCash?: number;
  creditPriceTotal?: number;
  tenorType: 'weekly' | 'monthly' | 'daily';
  tenorCount: number;
  downPayment: number;
  notes?: string;
}

export async function createCreditRequest(input: CreditRequestInput) {
  const ref = doc(db, 'credit_requests', input.id);
  await setDoc(ref, {
    id: input.id,
    customerId: input.customerId,
    customerName: input.customerName || '',
    customerPhone: input.customerPhone || '',
    productId: input.productId,
    productName: input.productName || '',
    productPriceCash: input.productPriceCash || 0,
    creditPriceTotal: input.creditPriceTotal || 0,
    tenorType: input.tenorType,
    tenorCount: input.tenorCount,
    downPayment: input.downPayment,
    notes: input.notes || '',
    status: 'pending',
    source: 'customer',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
