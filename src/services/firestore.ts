import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  increment,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  runTransaction,
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
  profitSharePercentage?: number;
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
      profitSharePercentage: typeof data.profitSharePercentage === 'number' ? data.profitSharePercentage : undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    } as UserDoc;
  });
}

function roundTo2Decimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
        active: true,
        profitSharePercentage: 0
      }, { merge: true });
    } else {
      transaction.update(userRef, {
        target: deleteField(),
        collected: deleteField(),
        bonus: deleteField(),
        internalDebt: deleteField(),
        active: deleteField(),
        profitSharePercentage: deleteField()
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

export async function updateEmployeeProfitSharePercentage(
  targetUid: string,
  percentage: number,
  actorId: string,
  actorName?: string
) {
  const pct = roundTo2Decimals(percentage);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error('Presentase bagi hasil harus antara 0 sampai 100');
  }

  await runTransaction(db, async (transaction: any) => {
    const userRef = doc(db, 'users', targetUid);
    const userSnap = await transaction.get(userRef);
    const role = userSnap.exists() ? userSnap.data().role : null;
    if (role !== 'employee') {
      throw new Error('Presentase bagi hasil hanya bisa diatur untuk karyawan');
    }

    const oldRaw = userSnap.data()?.profitSharePercentage;
    const oldPct = typeof oldRaw === 'number' ? oldRaw : 0;

    transaction.set(userRef, { profitSharePercentage: pct, updatedAt: serverTimestamp() }, { merge: true });

    const auditRef = doc(collection(db, 'profit_share_percentage_audits'));
    transaction.set(auditRef, {
      id: auditRef.id,
      userId: targetUid,
      actorId,
      actorName: actorName || 'Admin',
      oldPercentage: oldPct,
      newPercentage: pct,
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

export async function fetchCustomersPage(params: {
  pageSize?: number;
  cursor?: any;
}) {
  const pageSize = params.pageSize || 20;
  const constraints: any[] = [orderBy('name')];
  if (params.cursor) constraints.push(startAfter(params.cursor));
  constraints.push(limit(pageSize));

  const q = query(collection(db, 'customers'), ...constraints);
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((d: any) => {
    const data = d.data();
    return {
      uid: d.id,
      ...data,
      phone: data.phone || '',
      address: data.address || '',
      totalDebt: data.totalDebt || data.currentDebt || 0,
      currentDebt: data.currentDebt || 0
    } as CustomerData;
  });
  const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { items, nextCursor };
}

export async function searchCustomersPage(params: {
  searchTerm: string;
  pageSize?: number;
  cursor?: any;
}) {
  const searchTerm = params.searchTerm.trim();
  if (!searchTerm) return { items: [] as CustomerData[], nextCursor: null };

  const pageSize = params.pageSize || 20;
  const constraints: any[] = [orderBy('name'), startAt(searchTerm), endAt(searchTerm + '\uf8ff')];
  if (params.cursor) constraints.push(startAfter(params.cursor));
  constraints.push(limit(pageSize));

  const q = query(collection(db, 'customers'), ...constraints);
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((d: any) => {
    const data = d.data();
    return {
      uid: d.id,
      ...data,
      phone: data.phone || '',
      address: data.address || '',
      totalDebt: data.totalDebt || data.currentDebt || 0,
      currentDebt: data.currentDebt || 0
    } as CustomerData;
  });
  const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { items, nextCursor };
}

export interface CustomerAccessLogInput {
  actorId: string;
  actorName?: string;
  actorRole: 'admin' | 'employee';
  customerId: string;
  customerName?: string;
  action: 'view_customer_detail' | 'view_customer_payments' | 'view_customer_credits';
}

export async function logCustomerAccess(input: CustomerAccessLogInput) {
  const ref = doc(collection(db, 'customer_access_logs'));
  await setDoc(ref, {
    id: ref.id,
    actorId: input.actorId,
    actorName: input.actorName || '',
    actorRole: input.actorRole,
    customerId: input.customerId,
    customerName: input.customerName || '',
    action: input.action,
    createdAt: serverTimestamp()
  });
}

export type PrintAuditAction =
  | 'print_payment_receipt'
  | 'print_payments_history'
  | 'print_withdrawal_receipt'
  | 'print_withdrawals_history'
  | 'print_profit_share_receipt'
  | 'print_profit_shares_history';

export interface PrintAuditLogInput {
  actorId: string;
  actorName?: string;
  actorRole: 'admin' | 'employee';
  action: PrintAuditAction;
  targetId?: string;
  targetName?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}

export async function logPrintActivity(input: PrintAuditLogInput) {
  const ref = doc(collection(db, 'print_logs'));
  await setDoc(ref, {
    id: ref.id,
    actorId: input.actorId,
    actorName: input.actorName || '',
    actorRole: input.actorRole,
    action: input.action,
    targetId: input.targetId || '',
    targetName: input.targetName || '',
    meta: input.meta || {},
    createdAt: serverTimestamp()
  });
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
  profitSharePercentage?: number;
}

export type EmployeeWithdrawalStatus = 'completed' | 'void';

export interface EmployeeWithdrawalRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  amount: number;
  status: EmployeeWithdrawalStatus;
  actorId: string;
  actorName?: string;
  notes?: string;
  monthKey: string;
  createdAt: any;
  updatedAt: any;
}

const EMPLOYEE_WITHDRAWALS_COLLECTION = 'employee_withdrawals';

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function createEmployeeWithdrawal(params: {
  employeeId: string;
  amount: number;
  actorId: string;
  actorName?: string;
  notes?: string;
}) {
  const amountRounded = roundTo2Decimals(params.amount);
  if (!Number.isFinite(amountRounded) || amountRounded <= 0) {
    throw new Error('Nominal penarikan harus lebih dari 0');
  }

  const now = new Date();
  const monthKey = monthKeyFromDate(now);

  return runTransaction(db, async (transaction: any) => {
    const employeeRef = doc(db, 'users', params.employeeId);
    const employeeSnap = await transaction.get(employeeRef);
    if (!employeeSnap.exists() || employeeSnap.data()?.role !== 'employee') {
      throw new Error('Karyawan tidak ditemukan');
    }

    const currentBonusRaw = employeeSnap.data()?.bonus;
    const currentBonus = typeof currentBonusRaw === 'number' ? currentBonusRaw : 0;
    if (currentBonus < amountRounded) {
      throw new Error('Bonus tidak mencukupi untuk penarikan');
    }

    const withdrawalRef = doc(collection(db, EMPLOYEE_WITHDRAWALS_COLLECTION));
    const employeeName = employeeSnap.data()?.name || employeeSnap.data()?.email || params.employeeId;

    const record: EmployeeWithdrawalRecord = {
      id: withdrawalRef.id,
      employeeId: params.employeeId,
      employeeName,
      amount: amountRounded,
      status: 'completed',
      actorId: params.actorId,
      actorName: params.actorName || 'Admin',
      notes: params.notes || '',
      monthKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    transaction.set(withdrawalRef, record);
    transaction.set(
      employeeRef,
      {
        bonus: increment(-amountRounded),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    return withdrawalRef.id as string;
  });
}

export async function fetchEmployeeWithdrawalsPage(params: {
  employeeId?: string | null;
  status?: EmployeeWithdrawalStatus | null;
  startDate?: Date | null;
  endDate?: Date | null;
  pageSize?: number;
  cursor?: any;
}) {
  const pageSize = params.pageSize || 20;

  const constraints: any[] = [];
  if (params.employeeId) constraints.push(where('employeeId', '==', params.employeeId));
  if (params.status) constraints.push(where('status', '==', params.status));
  if (params.startDate) constraints.push(where('createdAt', '>=', params.startDate));
  if (params.endDate) constraints.push(where('createdAt', '<=', params.endDate));

  constraints.push(orderBy('createdAt', 'desc'));
  if (params.cursor) constraints.push(startAfter(params.cursor));
  constraints.push(limit(pageSize));

  const q = query(collection(db, EMPLOYEE_WITHDRAWALS_COLLECTION), ...constraints);

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as EmployeeWithdrawalRecord[];
  const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { items, nextCursor };
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
    active: true,
    profitSharePercentage: 0
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
