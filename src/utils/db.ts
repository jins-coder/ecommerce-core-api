import { User, Product, InventoryItem, Order } from '../models/types.js';

export class Database {
  users: Map<string, User> = new Map();
  products: Map<string, Product> = new Map();
  inventory: Map<string, InventoryItem> = new Map();
  orders: Map<string, Order> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    // Seed test user
    this.users.set('usr_1', {
      id: 'usr_1',
      email: 'alex@example.com',
      passwordHash: '$2a$10$wT8B18X3gGzM3r2n5YdGTu6x3aW4P5o7B9s0C1d2E3f4G5h6I7j8K',
      name: 'Alex Johnson',
      role: 'customer',
      createdAt: new Date().toISOString(),
    });

    // Seed products
    const sampleProducts: Product[] = [
      {
        id: 'prod_101',
        sku: 'SKU-KB-01',
        title: 'Mechanical Gaming Keyboard',
        description: 'RGB Backlit mechanical keyboard with tactile blue switches.',
        price: 89.99,
        category: 'electronics',
        tags: ['gaming', 'hardware', 'peripherals'],
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'prod_102',
        sku: 'SKU-MS-02',
        title: 'Ergonomic Wireless Mouse',
        description: 'Precision optical mouse with silent click and bluetooth 5.2.',
        price: 49.99,
        category: 'electronics',
        tags: ['office', 'peripherals', 'wireless'],
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'prod_103',
        sku: 'SKU-MN-03',
        title: '27-inch 4K Monitor',
        description: 'Ultra-HD IPS display with HDR400 and USB-C connectivity.',
        price: 329.00,
        category: 'electronics',
        tags: ['office', 'display', '4k'],
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const prod of sampleProducts) {
      this.products.set(prod.id, prod);
      this.inventory.set(prod.id, {
        productId: prod.id,
        availableStock: 25,
        reservedStock: 0,
        version: 1,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export const db = new Database();
