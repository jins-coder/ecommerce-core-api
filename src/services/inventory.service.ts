import { db } from '../utils/db.js';
import { InventoryItem, OrderItem } from '../models/types.js';

export class InventoryService {
  async getStock(productId: string): Promise<InventoryItem | null> {
    return db.inventory.get(productId) || null;
  }

  /**
   * Atomic multi-item inventory reservation with optimistic concurrency control,
   * quantity validation, duplicate line aggregation, and automated compensation rollback.
   */
  async reserveItemsAtomic(items: OrderItem[]): Promise<{ success: boolean; error?: string; reservedItems?: { productId: string; quantity: number }[] }> {
    const rollbackLog: { productId: string; quantity: number }[] = [];

    try {
      // Step 1: Aggregate duplicate line items and strictly validate quantities
      const aggregated = new Map<string, number>();
      for (const item of items) {
        if (!item || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new Error(`Invalid quantity for item ${item?.productId || 'unknown'}: must be a positive integer`);
        }
        aggregated.set(item.productId, (aggregated.get(item.productId) || 0) + item.quantity);
      }

      // Step 2: Validate available stock and snapshot versions for optimistic locking
      const versionSnapshots = new Map<string, number>();
      for (const [productId, totalQty] of aggregated.entries()) {
        const stockItem = db.inventory.get(productId);
        if (!stockItem) {
          throw new Error(`Item ${productId} does not exist in inventory catalog`);
        }

        const available = stockItem.availableStock - stockItem.reservedStock;
        if (available < totalQty) {
          throw new Error(`Insufficient stock for product ${productId}. Requested: ${totalQty}, Available: ${available}`);
        }

        // Snapshot version for optimistic locking comparison in Step 3
        versionSnapshots.set(productId, stockItem.version);
      }

      // Step 3: Atomic reservation execution verifying version match
      for (const [productId, totalQty] of aggregated.entries()) {
        const stockItem = db.inventory.get(productId)!;
        const expectedVersion = versionSnapshots.get(productId);

        if (stockItem.version !== expectedVersion) {
          throw new Error(`Concurrency conflict detected on product ${productId}: stock was modified concurrently`);
        }

        const previousReserved = stockItem.reservedStock;
        const previousVersion = stockItem.version;

        stockItem.reservedStock += totalQty;
        stockItem.version += 1;
        stockItem.updatedAt = new Date().toISOString();

        try {
          db.inventory.set(productId, stockItem);
          rollbackLog.push({ productId, quantity: totalQty });
        } catch (writeErr) {
          // Revert in-memory mutation of current failed item
          stockItem.reservedStock = previousReserved;
          stockItem.version = previousVersion;
          throw writeErr;
        }
      }

      return { success: true, reservedItems: rollbackLog };
    } catch (err: any) {
      // Automatic compensation / rollback of previously reserved items in this transaction
      for (const logged of rollbackLog) {
        const stockItem = db.inventory.get(logged.productId);
        if (stockItem) {
          stockItem.reservedStock = Math.max(0, stockItem.reservedStock - logged.quantity);
          stockItem.updatedAt = new Date().toISOString();
          try {
            db.inventory.set(logged.productId, stockItem);
          } catch (_) {
            // Safe guard in compensation loop
          }
        }
      }

      return { success: false, error: err.message };
    }
  }

  /**
   * Finalizes reservation into permanent stock deduction upon successful order completion.
   */
  async commitReservation(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      const stockItem = db.inventory.get(item.productId);
      if (stockItem) {
        stockItem.availableStock = Math.max(0, stockItem.availableStock - item.quantity);
        stockItem.reservedStock = Math.max(0, stockItem.reservedStock - item.quantity);
        stockItem.version += 1;
        stockItem.updatedAt = new Date().toISOString();
        db.inventory.set(item.productId, stockItem);
      }
    }
  }

  /**
   * Explicitly releases reserved items if order or payment gets cancelled.
   */
  async releaseReservation(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      const stockItem = db.inventory.get(item.productId);
      if (stockItem) {
        stockItem.reservedStock = Math.max(0, stockItem.reservedStock - item.quantity);
        stockItem.updatedAt = new Date().toISOString();
        db.inventory.set(item.productId, stockItem);
      }
    }
  }
}

export const inventoryService = new InventoryService();
