import { db } from '../utils/db.js';
import { InventoryItem } from '../models/types.js';
import { memoryCache } from '../utils/cache.js';

export class InventoryService {
  async getStock(productId: string): Promise<InventoryItem | null> {
    return db.inventory.get(productId) || null;
  }

  /**
   * Batch retrieves stock levels in a single dictionary lookup pass, avoiding N+1 roundtrips.
   */
  async getBatchStock(productIds: string[]): Promise<Map<string, number>> {
    const stockMap = new Map<string, number>();
    for (const id of productIds) {
      const item = db.inventory.get(id);
      stockMap.set(id, item ? item.availableStock : 0);
    }
    return stockMap;
  }

  async deductStock(productId: string, quantity: number): Promise<boolean> {
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      return false;
    }

    const item = db.inventory.get(productId);
    if (!item) return false;
    if (item.availableStock < quantity) return false;

    item.availableStock -= quantity;
    item.updatedAt = new Date().toISOString();
    db.inventory.set(productId, item);

    // Wire up cache invalidation on inventory mutation
    memoryCache.delete('products:catalog:all');
    return true;
  }
}

export const inventoryService = new InventoryService();
