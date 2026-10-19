import { randomUUID } from 'node:crypto';
import { db } from '../utils/db.js';
import { Order, OrderItem } from '../models/types.js';
import { inventoryService } from './inventory.service.js';

export class OrderService {
  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // Step 1: Pre-calculate total and reconstruct sanitized line items using canonical catalog prices
    let totalAmount = 0;
    const sanitizedItems: OrderItem[] = [];

    for (const item of items) {
      if (!item || !item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error('Each order item must specify a valid productId and positive integer quantity');
      }

      const product = db.products.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found in catalog`);
      }

      // Rebuild item using authoritative catalog price (mitigates client price-tampering)
      sanitizedItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
      });

      totalAmount += product.price * item.quantity;
    }

    // Step 2: Atomic inventory reservation (2-phase commit phase 1)
    const reservation = await inventoryService.reserveItemsAtomic(sanitizedItems);
    if (!reservation.success) {
      throw new Error(`Inventory reservation failed: ${reservation.error}`);
    }

    try {
      // Step 3: Commit reservation (2-phase commit phase 2)
      await inventoryService.commitReservation(sanitizedItems);

      // Step 4: Persist confirmed order with collision-resistant UUID
      const newOrder: Order = {
        id: `ord_${randomUUID()}`,
        userId,
        items: sanitizedItems,
        totalAmount: Math.round(totalAmount * 100) / 100,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };

      db.orders.set(newOrder.id, newOrder);
      return newOrder;
    } catch (err: any) {
      // If error occurs after reservation, release reserved inventory
      await inventoryService.releaseReservation(sanitizedItems);
      throw new Error(`Failed to finalize order: ${err.message}`);
    }
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    return db.orders.get(orderId) || null;
  }
}

export const orderService = new OrderService();
