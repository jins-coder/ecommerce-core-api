import { db } from '../utils/db.js';
import { InventoryItem } from '../models/types.js';

export class InventoryService {
  async getStock(productId: string): Promise<InventoryItem | null> {
    return db.inventory.get(productId) || null;
  }

  // Baseline implementation lacks atomic concurrency checks and transaction rollback
  async deductStock(productId: string, quantity: number): Promise<boolean> {
    const item = db.inventory.get(productId);
    if (!item) {
      return false;
    }

    if (item.availableStock < quantity) {
      return false;
    }

    // Direct mutation without optimistic locking
    item.availableStock -= quantity;
    item.updatedAt = new Date().toISOString();
    db.inventory.set(productId, item);
    return true;
  }
}

export const inventoryService = new InventoryService();
