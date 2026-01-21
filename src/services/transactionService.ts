import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  where
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { CreditTransaction, Customer, Installment, Product } from '../types';
import { db } from './firebase';
import { PRODUCTS_COLLECTION, STOCK_HISTORY_COLLECTION } from './productService';
const CUSTOMERS_COLLECTION = 'customers';
export const STATS_COLLECTION = 'stats';
export const STATS_FINANCIALS_DOC = 'financials';

const TRANSACTIONS_COLLECTION = 'transactions';
const PROFIT_SHARES_COLLECTION = 'profit_shares';

function roundTo2Decimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface CreateTransactionParams {
  customer: Customer;
  product: Product;
  creditPriceTotal: number;
  markupUsed: number;
  downPayment: number;
  tenorType: 'weekly' | 'monthly' | 'daily';
  tenorCount: number;
  notes?: string;
  approvedBy: {
    id: string;
    name: string;
    role: string;
  };
}

export async function createCreditTransaction(params: CreateTransactionParams): Promise<string> {
  const {
    customer,
    product,
    creditPriceTotal,
    markupUsed,
    downPayment,
    tenorType,
    tenorCount,
    notes,
    approvedBy
  } = params;

  const principal = creditPriceTotal - downPayment;
  const baseInstallment = Math.floor(principal / tenorCount);
  const remainder = principal - (baseInstallment * tenorCount);
  const installments: Installment[] = [];
  const now = new Date();
  for (let i = 1; i <= tenorCount; i++) {
    const dueDate = new Date(now);
    if (tenorType === 'weekly') {
      dueDate.setDate(dueDate.getDate() + (i * 7));
    } else if (tenorType === 'daily') {
      dueDate.setDate(dueDate.getDate() + i);
    } else {
      dueDate.setMonth(dueDate.getMonth() + i);
    }
    const amountForThis = baseInstallment + (i === tenorCount ? remainder : 0);
    installments.push({
      id: `inst_${i}`,
      dueDate: Timestamp.fromDate(dueDate),
      amount: amountForThis,
      status: 'unpaid'
    });
  }

  try {
    const result = await runTransaction(db, async (transaction: any) => {
      // 1. Re-read product to ensure stock availability
      const productRef = doc(db, PRODUCTS_COLLECTION, product.id);
      const productDoc = await transaction.get(productRef);
      
      if (!productDoc.exists()) {
        throw new Error("Produk tidak ditemukan!");
      }

      const currentStock = productDoc.data().stock;
      if (currentStock < 1) {
        throw new Error("Stok produk habis!");
      }

      // 2. Prepare Transaction Data
      const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const transactionData: CreditTransaction = {
        id: newTransactionRef.id,
        customerId: customer.id,
        customerName: customer.name,
        productId: product.id,
        productName: product.name,
        productPriceCash: product.priceCash,
        markupPercentageUsed: markupUsed,
        creditPriceTotal: creditPriceTotal,
        downPayment: downPayment,
        principalAmount: creditPriceTotal - downPayment,
        tenorType,
        tenorCount,
        installmentAmount: baseInstallment,
        installments,
        status: 'active',
        approvedBy,
        approvedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notes: notes || ''
      };

      // 3. Execute Updates
      
      // 3. Update Product Stock (Decrement)
      const newStock = currentStock - 1;
      transaction.update(productRef, { 
        stock: newStock,
        updatedAt: serverTimestamp() 
      });

      // 4. Create Stock History (Transaction)
      const historyRef = doc(collection(db, STOCK_HISTORY_COLLECTION));
      transaction.set(historyRef, {
        id: historyRef.id,
        productId: product.id,
        productName: product.name,
        oldStock: currentStock,
        newStock: newStock,
        changeAmount: -1,
        type: 'transaction',
        referenceId: newTransactionRef.id,
        notes: `Pembelian oleh ${customer.name}`,
        updatedBy: approvedBy.id,
        updatedByName: approvedBy.name,
        createdAt: serverTimestamp()
      });

      // 5. Create Transaction Record
      transaction.set(newTransactionRef, transactionData);

      // 6. Update Customer Debt
      const customerRef = doc(db, CUSTOMERS_COLLECTION, customer.id);
      const newDebt = (customer.totalDebt || 0) + (creditPriceTotal - downPayment);
      transaction.update(customerRef, {
        totalDebt: newDebt,
        currentDebt: newDebt, // Keep currentDebt in sync
        updatedAt: serverTimestamp()
      });

      // 7. Update Global Receivables
      const statsRef = doc(db, STATS_COLLECTION, STATS_FINANCIALS_DOC);
      transaction.set(statsRef, {
        totalReceivables: increment(creditPriceTotal - downPayment),
        updatedAt: serverTimestamp()
      }, { merge: true });

      return newTransactionRef.id;
    });

    return result;
  } catch (error) {
    console.error("Transaction failed: ", error);
    throw error;
  }
}

export interface ProcessPaymentParams {
  customerId: string;
  customerName?: string;
  amount: number;
  notes?: string;
  collectorId: string;
  collectorName?: string;
  paidAt?: Date;
  paymentMethod?: PaymentMethod;
  paymentProofImage?: string | null;
  paymentReference?: string | null;
}

export type PaymentMethod = 'cash' | 'transfer';

export interface PaymentTransaction {
  id: string;
  customerId: string;
  customerName?: string;
  amount: number;
  type: 'payment';
  status: 'completed';
  collectorId: string;
  collectorName?: string;
  paymentMethod: PaymentMethod;
  paymentProofImage?: string | null;
  paymentReference?: string | null;
  receiptNumber: string;
  createdAt: any;
  updatedAt: any;
  notes: string;
}

export type ProfitShareStatus = 'earned' | 'paid' | 'void';

export interface ProfitShareRecord {
  id: string;
  paymentTransactionId: string;
  customerId: string;
  customerName?: string;
  paymentAmount: number;
  percentage: number;
  profitShareAmount: number;
  collectorId: string;
  collectorName?: string;
  status: ProfitShareStatus;
  createdAt: any;
  updatedAt: any;
  monthKey: string;
  notes?: string;
}

export interface ProcessPaymentResult {
  transactionId: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  newDebt: number;
  createdAt: Date;
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function processPayment(params: ProcessPaymentParams): Promise<ProcessPaymentResult> {
  const { customerId, customerName, amount, notes, collectorId, collectorName } = params;

  try {
    const result = await runTransaction(db, async (transaction: any) => {
      if (!amount || amount <= 0) {
        throw new Error("Jumlah pembayaran harus lebih dari 0");
      }

      const collectorRef = doc(db, 'users', collectorId);
      const collectorSnap = collectorId ? await transaction.get(collectorRef) : null;
      const collectorRole = collectorSnap?.exists?.() ? collectorSnap.data().role : null;
      const collectorPctRaw = collectorSnap?.exists?.() ? collectorSnap.data().profitSharePercentage : null;
      const collectorPct = typeof collectorPctRaw === 'number' ? collectorPctRaw : 0;
      const isEmployeeCollector = collectorRole === 'employee';
      const safePct = collectorPct < 0 ? 0 : collectorPct > 100 ? 100 : collectorPct;
      const profitShareAmount = isEmployeeCollector ? roundTo2Decimals((amount * safePct) / 100) : 0;

      const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
      const customerDoc = await transaction.get(customerRef);

      if (!customerDoc.exists()) {
        throw new Error("Nasabah tidak ditemukan!");
      }

      // If customerName is not provided, try to get it from the doc
      const actualCustomerName = customerName || customerDoc.data().name || 'Unknown';

      const currentDebt = customerDoc.data().totalDebt || 0; // Use totalDebt consistent with CreateTransaction
      if (amount > currentDebt) {
        throw new Error(`Jumlah pembayaran melebihi utang (${currentDebt}).`);
      }
      // Note: firestore.ts uses 'currentDebt', transactionService.ts uses 'totalDebt'. 
      // Checking createCreditTransaction, it updates 'totalDebt'.
      // Checking Customer interface in types/index.ts might clarify, but let's assume totalDebt is the one we want to decrement.
      // Actually, let's check what createCreditTransaction reads: `totalDebt: (customer.totalDebt || 0) + ...`
      // So we should decrement totalDebt.

      // 1. Create Transaction Record (Payment)
      const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const receiptNumber = `PAY/${newTransactionRef.id.slice(0, 8).toUpperCase()}`;
      const createdAtValue = params.paidAt ? Timestamp.fromDate(params.paidAt) : serverTimestamp();
      const updatedAtValue = params.paidAt ? Timestamp.fromDate(params.paidAt) : serverTimestamp();
      const paymentMethod: PaymentMethod = params.paymentMethod || 'cash';
      const paymentData: PaymentTransaction = {
        id: newTransactionRef.id,
        customerId,
        customerName: actualCustomerName,
        amount,
        type: 'payment',
        status: 'completed',
        collectorId,
        collectorName: collectorName || 'Unknown',
        paymentMethod,
        paymentProofImage: params.paymentProofImage || null,
        paymentReference: params.paymentReference || null,
        receiptNumber,
        createdAt: createdAtValue,
        updatedAt: updatedAtValue,
        notes: notes || ''
      };
      transaction.set(newTransactionRef, paymentData);

      if (isEmployeeCollector) {
        const monthKey = monthKeyFromDate(params.paidAt || new Date());
        const profitShareRef = doc(db, PROFIT_SHARES_COLLECTION, newTransactionRef.id);
        const profitShareData: ProfitShareRecord = {
          id: profitShareRef.id,
          paymentTransactionId: newTransactionRef.id,
          customerId,
          customerName: actualCustomerName,
          paymentAmount: amount,
          percentage: roundTo2Decimals(safePct),
          profitShareAmount,
          collectorId,
          collectorName: collectorName || 'Unknown',
          status: 'earned',
          createdAt: createdAtValue,
          updatedAt: updatedAtValue,
          monthKey,
          notes: notes || ''
        };
        transaction.set(profitShareRef, profitShareData);
        transaction.set(collectorRef, {
          collected: increment(amount),
          bonus: increment(profitShareAmount),
          updatedAt: updatedAtValue
        }, { merge: true });
      }

      // 2. Update Customer Debt
      const newDebt = currentDebt - amount;
      transaction.update(customerRef, {
        totalDebt: newDebt,
        currentDebt: newDebt, // Keep currentDebt in sync
        updatedAt: updatedAtValue
      });

      // 3. Update Global Receivables
      const statsRef = doc(db, STATS_COLLECTION, STATS_FINANCIALS_DOC);
      transaction.set(statsRef, {
        totalReceivables: increment(-amount),
        updatedAt: updatedAtValue
      }, { merge: true });

      return {
        transactionId: newTransactionRef.id,
        receiptNumber,
        customerId,
        customerName: actualCustomerName,
        amount,
        newDebt,
        createdAt: params.paidAt || new Date()
      } satisfies ProcessPaymentResult;
    });

    // Link payment to installments (mark paid in oldest active credits)
    let remaining = amount;
    const q = query(collection(db, TRANSACTIONS_COLLECTION), where('customerId', '==', customerId));
    const snap = await getDocs(q);
    const docsSorted = snap.docs.sort((a: any, b: any) => {
      const ad = a.data().createdAt?.toDate?.() || new Date(0);
      const bd = b.data().createdAt?.toDate?.() || new Date(0);
      return ad.getTime() - bd.getTime();
    });
    for (const d of docsSorted) {
      const data = d.data() as any;
      const isCredit = !!data.installments && data.status !== 'completed';
      if (!isCredit) continue;
      const installments: Installment[] = (data.installments || []).map((i: any) => ({
        id: i.id,
        dueDate: i.dueDate,
        amount: i.amount,
        status: i.status,
        paidAt: i.paidAt
      }));
      let changed = false;
      for (let i = 0; i < installments.length && remaining > 0; i++) {
        if (installments[i].status === 'paid') continue;
        if (remaining >= (installments[i].amount || 0)) {
          installments[i].status = 'paid';
          installments[i].paidAt = params.paidAt ? Timestamp.fromDate(params.paidAt) : serverTimestamp();
          remaining -= (installments[i].amount || 0);
          changed = true;
        } else {
          break;
        }
      }
      if (changed) {
        const allPaid = installments.every(inst => inst.status === 'paid');
        await setDoc(doc(db, TRANSACTIONS_COLLECTION, d.id), {
          installments,
          status: allPaid ? 'completed' : data.status,
          updatedAt: params.paidAt ? Timestamp.fromDate(params.paidAt) : serverTimestamp()
        }, { merge: true });
      }
      if (remaining <= 0) break;
    }

    return result;
  } catch (error) {
    console.error("Payment transaction failed: ", error);
    throw error;
  }
}

export type CustomerTransactionKind = 'all' | 'payment' | 'credit';

function isCreditTransactionLike(tx: any): tx is CreditTransaction {
  if (!tx || typeof tx !== 'object') return false;
  if (tx.type === 'payment') return false;
  return Array.isArray(tx.installments) || typeof tx.creditPriceTotal === 'number';
}

function isPaymentTransactionLike(tx: any): tx is PaymentTransaction {
  if (!tx || typeof tx !== 'object') return false;
  return tx.type === 'payment';
}

export async function fetchCustomerTransactionsPage(params: {
  customerId: string;
  kind: CustomerTransactionKind;
  startDate?: Date | null;
  endDate?: Date | null;
  pageSize?: number;
  cursor?: any;
}) {
  const pageSize = params.pageSize || 20;
  const baseConstraints: any[] = [where('customerId', '==', params.customerId)];
  if (params.startDate) baseConstraints.push(where('createdAt', '>=', params.startDate));
  if (params.endDate) baseConstraints.push(where('createdAt', '<=', params.endDate));
  baseConstraints.push(orderBy('createdAt', 'desc'));
  if (params.cursor) baseConstraints.push(startAfter(params.cursor));
  baseConstraints.push(limit(pageSize));

  const typedConstraints: any[] =
    params.kind === 'payment' ? [where('customerId', '==', params.customerId), where('type', '==', 'payment')] : [];
  if (params.kind === 'payment') {
    if (params.startDate) typedConstraints.push(where('createdAt', '>=', params.startDate));
    if (params.endDate) typedConstraints.push(where('createdAt', '<=', params.endDate));
    typedConstraints.push(orderBy('createdAt', 'desc'));
    if (params.cursor) typedConstraints.push(startAfter(params.cursor));
    typedConstraints.push(limit(pageSize));
  }

  let snapshot: any;
  try {
    const q =
      params.kind === 'payment'
        ? query(collection(db, TRANSACTIONS_COLLECTION), ...typedConstraints)
        : query(collection(db, TRANSACTIONS_COLLECTION), ...baseConstraints);
    snapshot = await getDocs(q);
  } catch {
    const q = query(collection(db, TRANSACTIONS_COLLECTION), ...baseConstraints);
    snapshot = await getDocs(q);
  }

  const raw = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as any[];
  const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  let items = raw;
  if (params.kind === 'payment') items = items.filter(isPaymentTransactionLike);
  if (params.kind === 'credit') items = items.filter(isCreditTransactionLike);
  if (params.kind === 'all') items = items.filter((t) => isPaymentTransactionLike(t) || isCreditTransactionLike(t));

  return { items, nextCursor };
}

export async function getProfitSharesReport(filters: {
  collectorId?: string | null;
  startDate?: Date;
  endDate?: Date;
  limitCount?: number;
}) {
  const limitCount = filters.limitCount || 1000;
  const q = query(collection(db, PROFIT_SHARES_COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount));

  try {
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as ProfitShareRecord[];

    const filtered = data.filter((r: any) => {
      if (filters.collectorId && r.collectorId !== filters.collectorId) return false;
      if (!filters.startDate && !filters.endDate) return true;
      const dt = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (filters.startDate && dt < filters.startDate) return false;
      if (filters.endDate && dt > filters.endDate) return false;
      return true;
    });

    return filtered;
  } catch (error) {
    console.warn("Profit share report query error:", error);
    return [];
  }
}

export async function fetchProfitSharesPage(filters: {
  collectorId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: ProfitShareStatus | null;
  pageSize?: number;
  cursor?: any;
}) {
  const pageSize = filters.pageSize || 20;
  const constraints: any[] = [];
  if (filters.collectorId) constraints.push(where('collectorId', '==', filters.collectorId));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.startDate) constraints.push(where('createdAt', '>=', filters.startDate));
  if (filters.endDate) constraints.push(where('createdAt', '<=', filters.endDate));
  constraints.push(orderBy('createdAt', 'desc'));
  if (filters.cursor) constraints.push(startAfter(filters.cursor));
  constraints.push(limit(pageSize));

  const q = query(collection(db, PROFIT_SHARES_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as ProfitShareRecord[];
  const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { items, nextCursor };
}

export async function fetchPaymentTransactionsPage(filters: {
  collectorId?: string | null;
  customerId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  paymentMethod?: PaymentMethod | null;
  pageSize?: number;
  cursor?: any;
}) {
  const pageSize = filters.pageSize || 20;

  const sharedConstraints: any[] = [];
  if (filters.collectorId) sharedConstraints.push(where('collectorId', '==', filters.collectorId));
  if (filters.customerId) sharedConstraints.push(where('customerId', '==', filters.customerId));
  if (filters.paymentMethod) sharedConstraints.push(where('paymentMethod', '==', filters.paymentMethod));
  if (filters.startDate) sharedConstraints.push(where('createdAt', '>=', filters.startDate));
  if (filters.endDate) sharedConstraints.push(where('createdAt', '<=', filters.endDate));
  sharedConstraints.push(orderBy('createdAt', 'desc'));
  if (filters.cursor) sharedConstraints.push(startAfter(filters.cursor));
  sharedConstraints.push(limit(pageSize));

  const typedConstraints: any[] = [where('type', '==', 'payment'), ...sharedConstraints];

  let snapshot: any;
  try {
    snapshot = await getDocs(query(collection(db, TRANSACTIONS_COLLECTION), ...typedConstraints));
  } catch {
    snapshot = await getDocs(query(collection(db, TRANSACTIONS_COLLECTION), ...sharedConstraints));
  }

  const raw = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as any[];
  const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  const items = raw.filter(isPaymentTransactionLike) as PaymentTransaction[];
  return { items, nextCursor };
}

export function subscribeProfitSharesForEmployee(params: {
  collectorId: string;
  limitCount?: number;
  onChange: (items: ProfitShareRecord[]) => void;
  onError?: (e: any) => void;
}) {
  const limitCount = params.limitCount || 100;
  const q = query(
    collection(db, PROFIT_SHARES_COLLECTION),
    where('collectorId', '==', params.collectorId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  if (Platform.OS === 'web') {
    let active = true;
    const run = async () => {
      try {
        const snap = await getDocs(q);
        if (!active) return;
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as ProfitShareRecord[];
        params.onChange(items);
      } catch (e: any) {
        if (!active) return;
        if (params.onError) params.onError(e);
      }
    };

    run();
    const intervalId = setInterval(run, 20000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }

  return onSnapshot(
    q,
    (snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as ProfitShareRecord[];
      params.onChange(items);
    },
    (e: any) => {
      if (params.onError) params.onError(e);
    }
  );
}

export async function getReceivablesMutationReport(filters: {
  customerId?: string | null;
  startDate?: Date;
  endDate?: Date;
}) {
  let q = query(
    collection(db, TRANSACTIONS_COLLECTION),
    orderBy('createdAt', 'desc')
  );

  if (filters.customerId) {
    q = query(q, where('customerId', '==', filters.customerId));
  }

  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  // Client-side date filtering
  const filtered = data.filter((tx: any) => {
    // Only include Credit (new debt) and Payment (pay debt)
    // Legacy 'credit' type check or check for creditPriceTotal/amount
    const isCredit = tx.installments || tx.creditPriceTotal; // Credit Transaction
    const isPayment = tx.type === 'payment';
    
    if (!isCredit && !isPayment) return false;

    if (!filters.startDate && !filters.endDate) return true;
    
    const txDate = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt);
    
    if (filters.startDate && txDate < filters.startDate) return false;
    if (filters.endDate && txDate > filters.endDate) return false;
    
    return true;
  });

  return filtered.map((tx: any) => ({
    ...tx,
    createdAt: tx.createdAt?.toDate?.() || new Date(tx.createdAt) || new Date()
  }));
}

export async function getCreditTransactionsReport(filters?: {
  customerId?: string | null;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'completed' | 'bad_debt';
}) {
  let constraints: any[] = [orderBy('createdAt', 'desc')];
  
  if (filters?.customerId) {
    constraints.push(where('customerId', '==', filters.customerId));
  }
  
  if (filters?.startDate) {
    constraints.push(where('createdAt', '>=', filters.startDate));
  }
  
  if (filters?.endDate) {
    constraints.push(where('createdAt', '<=', filters.endDate));
  }

  // Note: Compound queries with status might require index
  // For now, filter status client-side if needed or add index
  
  const q = query(collection(db, TRANSACTIONS_COLLECTION), ...constraints);
  
  try {
    const snapshot = await getDocs(q);
    let data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as CreditTransaction[];
    
    if (filters?.status) {
      data = data.filter(t => t.status === filters.status);
    }
    
    return data;
  } catch (error) {
    console.warn("Credit Report Error:", error);
    return [];
  }
}

/**
 * Helper to recalculate customer debt based on transaction history.
 * Useful for fixing inconsistencies.
 */
export async function recalculateCustomerDebt(customerId: string) {
  try {
    console.log(`Recalculating debt for customer: ${customerId}`);
    
    // 1. Get all transactions for this customer
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('customerId', '==', customerId)
    );
    
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map((d: any) => d.data());
    
    // 2. Calculate correct debt
    let calculatedDebt = 0;
    
    transactions.forEach((tx: any) => {
      if (tx.type === 'payment') {
        calculatedDebt -= (tx.amount || 0);
      } else {
        // Assume credit transaction if not payment
        // Debt = Principal (Credit Price - Down Payment)
        const principal = (tx.creditPriceTotal || 0) - (tx.downPayment || 0);
        calculatedDebt += principal;
      }
    });
    
    console.log(`Calculated debt: ${calculatedDebt}`);
    
    // 3. Update Customer Document
    const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await setDoc(customerRef, {
      totalDebt: calculatedDebt,
      currentDebt: calculatedDebt, // Sync legacy field
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return calculatedDebt;
  } catch (error) {
    console.error("Recalculation failed:", error);
    throw error;
  }
}

export async function diagnoseCustomerDebt(customerId: string) {
  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('customerId', '==', customerId)
    );
    
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    
    let calculatedDebt = 0;
    let creditsTotal = 0;
    let paymentsTotal = 0;
    const logs: string[] = [];

    // Sort by date for clearer logs
    transactions.sort((a: any, b: any) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return da.getTime() - db.getTime();
    });

    transactions.forEach((tx: any) => {
        const dateStr = tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString('id-ID') : 'Unknown Date';
        if (tx.type === 'payment') {
            const amount = tx.amount || 0;
            calculatedDebt -= amount;
            paymentsTotal += amount;
            logs.push(`[${dateStr}] Payment: -${amount}`);
        } else {
            const price = tx.creditPriceTotal || 0;
            const dp = tx.downPayment || 0;
            const principal = price - dp;
            calculatedDebt += principal;
            creditsTotal += principal;
            logs.push(`[${dateStr}] Credit: +${principal} (Price: ${price}, DP: ${dp})`);
        }
    });

    const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    const customerDoc = await getDoc(customerRef);
    const storedDebt = customerDoc.exists() ? (customerDoc.data().totalDebt || 0) : 0;

    return {
        storedDebt,
        calculatedDebt,
        difference: storedDebt - calculatedDebt,
        creditsTotal,
        paymentsTotal,
        transactionCount: transactions.length,
        logs
    };
  } catch (error) {
    console.error("Diagnosis failed:", error);
    throw error;
  }
}

export interface ImageUploadLog {
    id: string;
    uploaderId: string;
    uploaderName: string;
    action: 'upload' | 'camera_access' | 'error';
    details: string;
    timestamp: any;
}

export async function logImageUploadActivity(params: {
    uploaderId: string;
    uploaderName: string;
    action: 'upload' | 'camera_access' | 'error';
    details: string;
}) {
    try {
        const logRef = doc(collection(db, 'image_upload_logs'));
        const logData: ImageUploadLog = {
            id: logRef.id,
            uploaderId: params.uploaderId,
            uploaderName: params.uploaderName,
            action: params.action,
            details: params.details,
            timestamp: serverTimestamp()
        };
        await setDoc(logRef, logData);
    } catch (error) {
        console.error("Failed to log image upload activity:", error);
    }
}

export async function analyzeSystemConsistency() {
    const issues: string[] = [];
    try {
        console.log("Starting consistency check...");
        
        // 1. Check Transactions
        const txQuery = query(collection(db, TRANSACTIONS_COLLECTION));
        const txSnap = await getDocs(txQuery);
        
        txSnap.forEach((docSnap: any) => {
            const data = docSnap.data();
            if (data.type === 'payment') {
                if (!data.customerName) issues.push(`Transaction ${docSnap.id} (Payment) missing customerName`);
                if (!data.collectorName) issues.push(`Transaction ${docSnap.id} (Payment) missing collectorName`);
            }
        });

        // 2. Check Stock History
        const stockQuery = query(collection(db, STOCK_HISTORY_COLLECTION));
        const stockSnap = await getDocs(stockQuery);
        
        stockSnap.forEach((docSnap: any) => {
            const data = docSnap.data();
            if (data.type === 'transaction' && !data.referenceId) {
                issues.push(`StockHistory ${docSnap.id} (Transaction) missing referenceId`);
            }
            if (!data.updatedByName) {
                 issues.push(`StockHistory ${docSnap.id} missing updatedByName`);
            }
        });
        
        console.log(`Consistency check done. Found ${issues.length} issues.`);
        return {
            totalIssues: issues.length,
            issues
        };
    } catch (e) {
        console.error("Consistency check failed:", e);
        return { error: e };
    }
}
