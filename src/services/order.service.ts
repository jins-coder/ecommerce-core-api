import { db } from '../utils/db.js';
import { Order, OrderItem } from '../models/types.js';
import { inventoryService } from './inventory.service.js';

export class OrderService {
  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    let totalAmount = 0;

    // Baseline: Non-atomic deduction loop vulnerable to partial failure state
    for (const item of items) {
      const product = db.products.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const success = await inventoryService.deductStock(item.productId, item.quantity);
      if (!success) {
        throw new Error(`Insufficient inventory for product ${product.title}`);
      }

      totalAmount += product.price * item.quantity;
    }

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      userId,
      items,
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    db.orders.set(newOrder.id, newOrder);
    return newOrder;
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    return db.orders.get(orderId) || null;
  }
}

export const orderService = new OrderService();
