export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'customer' | 'admin';
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
}

export interface InventoryItem {
  productId: string;
  availableStock: number;
  reservedStock: number;
  version: number; // for optimistic locking
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}
