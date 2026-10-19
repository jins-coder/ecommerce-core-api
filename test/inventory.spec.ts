import { describe, it, expect } from 'vitest';
import { inventoryService } from '../src/services/inventory.service.js';
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

  it('should completely roll back all reservations if any single item exceeds stock', async () => {
    const item1Before = db.inventory.get('prod_101')?.reservedStock || 0;

    const result = await inventoryService.reserveItemsAtomic([
      { productId: 'prod_101', quantity: 2, unitPrice: 89.99 },
      { productId: 'prod_102', quantity: 999999, unitPrice: 49.99 }, // impossible quantity
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient stock');

    // Verify prod_101 was not partially left reserved
    const item1After = db.inventory.get('prod_101')?.reservedStock;
    expect(item1After).toBe(item1Before);
  });
});
