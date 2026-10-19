import { db } from '../utils/db.js';
import { Order, OrderItem } from '../models/types.js';
import { inventoryService } from './inventory.service.js';

export class OrderService {
  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // Step 1: Pre-calculate total and validate product pricing
    let totalAmount = 0;
    for (const item of items) {
      const product = db.products.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found in catalog`);
      }
      totalAmount += product.price * item.quantity;
    }

    // Step 2: Atomic inventory reservation (2-phase commit phase 1)
    const reservation = await inventoryService.reserveItemsAtomic(items);
    if (!reservation.success) {
      throw new Error(`Inventory reservation failed: ${reservation.error}`);
    }

    try {
      // Step 3: Create order record
      const newOrder: Order = {
        id: `ord_${Date.now()}`,
        userId,
        items,
        totalAmount: Math.round(totalAmount * 100) / 100,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };

      db.orders.set(newOrder.id, newOrder);

      // Step 4: Commit reservation (2-phase commit phase 2)
      await inventoryService.commitReservation(items);

      return newOrder;
    } catch (err: any) {
      // If saving order fails, release reserved inventory
      await inventoryService.releaseReservation(items);
      throw new Error(`Failed to finalize order: ${err.message}`);
    }
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    return db.orders.get(orderId) || null;
  }
}

export const orderService = new OrderService();
