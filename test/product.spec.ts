import { describe, it, expect, vi } from 'vitest';
import { productService } from '../src/services/product.service.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { memoryCache } from '../src/utils/cache.js';

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
    expect(batchSpy).toHaveBeenCalledTimes(1); // Call count remains 1

    batchSpy.mockRestore();
  });

  it('should expire cached entries after TTL duration', async () => {
    const testKey = 'test:ttl:item';
    // Set 50ms short TTL
    memoryCache.set(testKey, { sample: 'value' }, 0.05);

    expect(memoryCache.get(testKey)).toBeDefined();

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(memoryCache.get(testKey)).toBeNull();
  });

  it('should invalidate product cache when stock is deducted', async () => {
    // Populate cache
    await productService.getAllProducts();
    expect(memoryCache.get('products:catalog:all')).not.toBeNull();

    // Deduct stock (which should trigger cache eviction)
    const success = await inventoryService.deductStock('prod_101', 1);
    expect(success).toBe(true);

    // Verify cache was invalidated
    expect(memoryCache.get('products:catalog:all')).toBeNull();
  });

  it('should reject negative or NaN stock deductions in deductStock', async () => {
    expect(await inventoryService.deductStock('prod_101', -5)).toBe(false);
    expect(await inventoryService.deductStock('prod_101', NaN)).toBe(false);
    expect(await inventoryService.deductStock('prod_101', 0)).toBe(false);
  });
});
