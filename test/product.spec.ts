import { describe, it, expect, vi } from 'vitest';
import { productService } from '../src/services/product.service.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { memoryCache } from '../src/utils/cache.js';
import { db } from '../src/utils/db.js';

describe('Product Catalog Cache & Optimization Suite', () => {
  it('should serve from cache on second fetch without querying inventory service', async () => {
    productService.invalidateCatalogCache();

    const batchSpy = vi.spyOn(inventoryService, 'getBatchStock');

    // First fetch: Cache miss, hits batch inventory service
    const firstRun = await productService.getAllProducts();
    expect(firstRun.length).toBeGreaterThan(0);
    expect(batchSpy).toHaveBeenCalledTimes(1);

    // Second fetch: Cache hit, must NOT call batch inventory service again
    const secondRun = await productService.getAllProducts();
    expect(secondRun).toEqual(firstRun);
    expect(batchSpy).toHaveBeenCalledTimes(1);

    batchSpy.mockRestore();
  });

  it('should expire cached entries after TTL duration', async () => {
    const testKey = 'test:ttl:item';
    memoryCache.set(testKey, { sample: 'value' }, 0.05);

    expect(memoryCache.get(testKey)).toBeDefined();

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(memoryCache.get(testKey)).toBeNull();
  });

  it('should invalidate product cache when stock is deducted', async () => {
    await productService.getAllProducts();
    expect(memoryCache.get('products:catalog:all')).not.toBeNull();

    const success = await inventoryService.deductStock('prod_101', 1);
    expect(success).toBe(true);

    expect(memoryCache.get('products:catalog:all')).toBeNull();
  });

  it('should reject invalid, negative, fractional, or NaN stock deductions and leave stock unchanged', async () => {
    const stockBefore = db.inventory.get('prod_101')?.availableStock || 0;

    expect(await inventoryService.deductStock('prod_101', -5)).toBe(false);
    expect(await inventoryService.deductStock('prod_101', NaN)).toBe(false);
    expect(await inventoryService.deductStock('prod_101', 0)).toBe(false);
    expect(await inventoryService.deductStock('prod_101', 1.5)).toBe(false); // fractional quantity check

    // Explicitly verify stock remains unchanged
    const stockAfter = db.inventory.get('prod_101')?.availableStock;
    expect(stockAfter).toBe(stockBefore);
  });
});
