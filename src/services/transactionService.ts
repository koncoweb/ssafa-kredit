import { db } from './firebase';
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp,
  Timestamp,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  increment,
  setDoc
} from 'firebase/firestore';
import { CreditTransaction, Installment, Product, Customer } from '../types';
import { PRODUCTS_COLLECTION, STOCK_HISTORY_COLLECTION } from './productService';
const CUSTOMERS_COLLECTION = 'customers';
export const STATS_COLLECTION = 'stats';
export const STATS_FINANCIALS_DOC = 'financials';

const TRANSACTIONS_COLLECTION = 'transactions';

export interface CreateTransactionParams {
  customer: Customer;
  product: Product;
  creditPriceTotal: number;
  markupUsed: number;
  downPayment: number;
  tenorType: 'weekly' | 'monthly' | 'daily';
  tenorCount: number;
  installmentAmount: number;
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
    installmentAmount,
    notes,
    approvedBy
  } = params;

  // Generate Installment Schedule
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
    
    installments.push({
      id: `inst_${i}`,
      dueDate: Timestamp.fromDate(dueDate),
      amount: installmentAmount,
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
        installmentAmount,
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
        notes: `Transaksi Kredit: ${customer.name}`,
        updatedBy: approvedBy.id,
        createdAt: serverTimestamp()
      });

      // 5. Create Transaction Record
      transaction.set(newTransactionRef, transactionData);

      // 6. Update Customer Debt
      const customerRef = doc(db, CUSTOMERS_COLLECTION, customer.id);
      transaction.update(customerRef, {
        totalDebt: (customer.totalDebt || 0) + (creditPriceTotal - downPayment)
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
  amount: number;
  notes?: string;
  collectorId: string;
}

export interface PaymentTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'payment';
  status: 'completed';
  collectorId: string;
  createdAt: any;
  updatedAt: any;
  notes: string;
}

export async function processPayment(params: ProcessPaymentParams) {
  const { customerId, amount, notes, collectorId } = params;

  try {
    const result = await runTransaction(db, async (transaction: any) => {
      const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
      const customerDoc = await transaction.get(customerRef);

      if (!customerDoc.exists()) {
        throw new Error("Nasabah tidak ditemukan!");
      }

      const currentDebt = customerDoc.data().totalDebt || 0; // Use totalDebt consistent with CreateTransaction
      // Note: firestore.ts uses 'currentDebt', transactionService.ts uses 'totalDebt'. 
      // Checking createCreditTransaction, it updates 'totalDebt'.
      // Checking Customer interface in types/index.ts might clarify, but let's assume totalDebt is the one we want to decrement.
      // Actually, let's check what createCreditTransaction reads: `totalDebt: (customer.totalDebt || 0) + ...`
      // So we should decrement totalDebt.

      // 1. Create Transaction Record (Payment)
      const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const paymentData: PaymentTransaction = {
        id: newTransactionRef.id,
        customerId,
        amount,
        type: 'payment',
        status: 'completed',
        collectorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notes: notes || ''
      };
      transaction.set(newTransactionRef, paymentData);

      // 2. Update Customer Debt
      transaction.update(customerRef, {
        totalDebt: currentDebt - amount,
        updatedAt: serverTimestamp()
      });

      // 3. Update Global Receivables
      const statsRef = doc(db, STATS_COLLECTION, STATS_FINANCIALS_DOC);
      transaction.set(statsRef, {
        totalReceivables: increment(-amount),
        updatedAt: serverTimestamp()
      }, { merge: true });

      return newTransactionRef.id;
    });

    return result;
  } catch (error) {
    console.error("Payment transaction failed: ", error);
    throw error;
  }
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
  return data.filter((tx: any) => {
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

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  
  const q = query(collection(db, TRANSACTIONS_COLLECTION), ...constraints);
  
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d: any) => {
      const data = d.data();
      return { 
        id: d.id, 
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      };
    }) as CreditTransaction[];
  } catch (error) {
    console.warn("Report query error (Check console for Index Link):", error);
    return [];
  }
}
