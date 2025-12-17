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
  setDoc,
  getDoc
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
}

export interface PaymentTransaction {
  id: string;
  customerId: string;
  customerName?: string;
  amount: number;
  type: 'payment';
  status: 'completed';
  collectorId: string;
  collectorName?: string;
  createdAt: any;
  updatedAt: any;
  notes: string;
}

export async function processPayment(params: ProcessPaymentParams) {
  const { customerId, customerName, amount, notes, collectorId, collectorName } = params;

  try {
    const paymentTxId = await runTransaction(db, async (transaction: any) => {
      if (!amount || amount <= 0) {
        throw new Error("Jumlah pembayaran harus lebih dari 0");
      }
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
      const paymentData: PaymentTransaction = {
        id: newTransactionRef.id,
        customerId,
        customerName: actualCustomerName,
        amount,
        type: 'payment',
        status: 'completed',
        collectorId,
        collectorName: collectorName || 'Unknown',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notes: notes || ''
      };
      transaction.set(newTransactionRef, paymentData);

      // 2. Update Customer Debt
      const newDebt = currentDebt - amount;
      transaction.update(customerRef, {
        totalDebt: newDebt,
        currentDebt: newDebt, // Keep currentDebt in sync
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
          installments[i].paidAt = serverTimestamp();
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
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      if (remaining <= 0) break;
    }

    return paymentTxId;
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
