import { describe, it, expect, vi } from 'vitest';
import { inventoryService } from '../src/services/inventory.service.js';
import { orderService } from '../src/services/order.service.js';
import { db } from '../src/utils/db.js';

describe('Atomic Inventory Reservation Suite', () => {
  it('should successfully reserve stock atomically for valid requests', async () => {
    const result = await inventoryService.reserveItemsAtomic([
      { productId: 'prod_101', quantity: 2, unitPrice: 89.99 },
    ]);

    expect(result.success).toBe(true);
    expect(result.reservedItems).toHaveLength(1);

    // Clean up reservation
    await inventoryService.releaseReservation([{ productId: 'prod_101', quantity: 2, unitPrice: 89.99 }]);
  });

  it('should directly reject invalid, negative, fractional, or NaN quantities in reserveItemsAtomic and leave stock untouched', async () => {
    const stockBefore = db.inventory.get('prod_101')?.availableStock;
    const reservedBefore = db.inventory.get('prod_101')?.reservedStock;

    const invalidInputs = [-1, 0, 1.5, NaN, undefined as any];

    for (const invalidQty of invalidInputs) {
      const result = await inventoryService.reserveItemsAtomic([
        { productId: 'prod_101', quantity: invalidQty, unitPrice: 89.99 },
      ]);
      expect(result.success).toBe(false);
      expect(result.error).toContain('positive integer');

      // Verify stock was not modified
      expect(db.inventory.get('prod_101')?.availableStock).toBe(stockBefore);
      expect(db.inventory.get('prod_101')?.reservedStock).toBe(reservedBefore);
    }
  });

  it('should aggregate duplicate line items for the same product to prevent overselling', async () => {
    const reservedBefore = db.inventory.get('prod_101')?.reservedStock || 0;

    // prod_101 has 25 available. 15 + 15 = 30 which exceeds 25
    const result = await inventoryService.reserveItemsAtomic([
      { productId: 'prod_101', quantity: 15, unitPrice: 89.99 },
      { productId: 'prod_101', quantity: 15, unitPrice: 89.99 },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient stock');
    expect(db.inventory.get('prod_101')?.reservedStock).toBe(reservedBefore);
  });

  it('should prevent partial reservation when a mixed-order second product has insufficient stock', async () => {
    const item1ReservedBefore = db.inventory.get('prod_101')?.reservedStock || 0;
    const item2ReservedBefore = db.inventory.get('prod_102')?.reservedStock || 0;

    // prod_101 has stock, prod_102 requests an impossible quantity
    const result = await inventoryService.reserveItemsAtomic([
      { productId: 'prod_101', quantity: 5, unitPrice: 89.99 },
      { productId: 'prod_102', quantity: 999999, unitPrice: 49.99 },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient stock');

    // Confirm prod_101 was NOT partially reserved
    expect(db.inventory.get('prod_101')?.reservedStock).toBe(item1ReservedBefore);
    expect(db.inventory.get('prod_102')?.reservedStock).toBe(item2ReservedBefore);
  });

  it('should actively exercise compensation rollback when mid-reservation persistence fails', async () => {
    const item1Before = db.inventory.get('prod_101')?.reservedStock || 0;
    const item2Before = db.inventory.get('prod_102')?.reservedStock || 0;

    // Mock db.inventory.set to fail on prod_102 write during reservation
    const originalSet = db.inventory.set.bind(db.inventory);
    let shouldFail = true;

    const setSpy = vi.spyOn(db.inventory, 'set').mockImplementation((key, value) => {
      if (key === 'prod_102' && shouldFail) {
        shouldFail = false; // allow subsequent rollback compensation writes to succeed
        throw new Error('Simulated database write error on item 2');
      }
      return originalSet(key, value);
    });

    const result = await inventoryService.reserveItemsAtomic([
      { productId: 'prod_101', quantity: 2, unitPrice: 89.99 },
      { productId: 'prod_102', quantity: 2, unitPrice: 49.99 },
    ]);

    setSpy.mockRestore();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Simulated database write error');

    // Assert that the first reserved item (prod_101) was compensated and restored to original reserved count
    const item1After = db.inventory.get('prod_101')?.reservedStock;
    const item2After = db.inventory.get('prod_102')?.reservedStock;

    expect(item1After).toBe(item1Before);
    expect(item2After).toBe(item2Before);
  });
});
