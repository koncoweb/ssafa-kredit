export type UserRole = 'admin' | 'employee' | 'customer';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  totalDebt: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  priceCash: number;
  markupPercentage?: number; // Optional override
  category?: string;
  imageUrl?: string;
  stock: number;
  active: boolean;
  minCreditPurchase?: number;
  creditRequirements?: string;
  expiryDate?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Installment {
  id: string;
  dueDate: any; // Timestamp
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  paidAt?: any;
}

export interface CreditTransaction {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  productPriceCash: number;
  markupPercentageUsed: number;
  creditPriceTotal: number;
  downPayment: number;
  principalAmount: number; // creditPriceTotal - downPayment
  tenorType: 'weekly' | 'monthly' | 'daily';
  tenorCount: number;
  installmentAmount: number;
  installments: Installment[];
  status: 'active' | 'completed' | 'bad_debt';
  approvedBy?: {
    id: string;
    name: string;
    role: string;
  };
  approvedAt?: any;
  createdAt: any;
  updatedAt?: any;
  notes?: string;
}

// Deprecated: Old transaction type, keep for backward compatibility if needed, or remove later
export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'credit' | 'payment';
  date: string;
  description?: string;
  proofImage?: string;
}

export interface StockHistory {
  id: string;
  productId: string;
  productName: string;
  oldStock: number;
  newStock: number;
  changeAmount: number; // positive or negative
  type: 'transaction' | 'manual_adjustment' | 'restock';
  referenceId?: string; // transactionId or null
  notes?: string;
  updatedBy: string; // userId or name
  createdAt: any;
}

export interface CreditSettings {
  globalMarkupPercentage: number;
  defaultTenor?: number;
  availableTenors: {
    weekly: number[];
    monthly: number[];
  };
}
