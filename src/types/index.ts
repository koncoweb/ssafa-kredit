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

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'credit' | 'payment';
  date: string;
  description?: string;
  proofImage?: string;
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
  createdAt?: any;
  updatedAt?: any;
}

export interface CreditSettings {
  globalMarkupPercentage: number;
  defaultTenor?: number;
}
