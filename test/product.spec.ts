import { describe, it, expect, vi } from 'vitest';
import { productService } from '../src/services/product.service.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { memoryCache } from '../src/utils/cache.js';
import { db } from '../src/utils/db.js';

describe('Product Catalog Cache & Optimization Suite', () => {
  it('should serve from cache on second fetch without querying inventory service, and return deep copies', async () => {
    productService.invalidateCatalogCache();

    const batchSpy = vi.spyOn(inventoryService, 'getBatchStock');

    // First fetch: Cache miss, hits batch inventory service
    const firstRun = await productService.getAllProducts();
    expect(firstRun.length).toBeGreaterThan(0);
    expect(batchSpy).toHaveBeenCalledTimes(1);

    // Second fetch: Cache hit, must NOT call batch inventory service again
    const secondRun = await productService.getAllProducts();
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(secondRun).toEqual(firstRun);

    // Verify deep clone protection on nested arrays (tags): mutations to firstRun do not corrupt cache
    firstRun[0].tags.push('mutated_tag_injection');
    firstRun[0].title = 'Tampered Catalog Title';

    const thirdRun = await productService.getAllProducts();
    expect(thirdRun[0].title).not.toBe('Tampered Catalog Title');
    expect(thirdRun[0].tags).not.toContain('mutated_tag_injection');
    expect(secondRun[0].tags).not.toBe(thirdRun[0].tags); // Deep reference isolation

    batchSpy.mockRestore();
  });

  it('should store values properly and expire cached entries after TTL duration', async () => {
    const testKey = 'test:ttl:item';
    memoryCache.set(testKey, { sample: 'value' }, 0.05);

    // Explicitly verify cached object equality (not just defined/null)
    expect(memoryCache.get(testKey)).toEqual({ sample: 'value' });

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(memoryCache.get(testKey)).toBeNull();
  });

  it('should invalidate product cache when stock is deducted, but preserve cache when deduction fails', async () => {
    // Populate cache
    productService.invalidateCatalogCache();
    await productService.getAllProducts();
    expect(memoryCache.get('products:catalog:all')).not.toBeNull();

    // 1. Failed deduction (insufficient stock) should NOT invalidate cache
    const currentStock = db.inventory.get('prod_101')?.availableStock || 25;
    const failedDeduct = await inventoryService.deductStock('prod_101', currentStock + 999);
    expect(failedDeduct).toBe(false);
    expect(memoryCache.get('products:catalog:all')).not.toBeNull();

    // 2. Successful deduction should invalidate cache
    const success = await inventoryService.deductStock('prod_101', 1);
    expect(success).toBe(true);
    expect(memoryCache.get('products:catalog:all')).toBeNull();
  });

  it('should correctly test insufficient-stock boundary values and preserve cache on rejection', async () => {
    const item = db.inventory.get('prod_103')!;
    const initialAvailable = item.availableStock; // 25

    // Populate catalog cache
    productService.invalidateCatalogCache();
    await productService.getAllProducts();
    expect(memoryCache.get('products:catalog:all')).not.toBeNull();

    // Boundary 1: Exceeding stock by 1 unit should fail and preserve cache
    expect(await inventoryService.deductStock('prod_103', initialAvailable + 1)).toBe(false);
    expect(db.inventory.get('prod_103')?.availableStock).toBe(initialAvailable);
    expect(memoryCache.get('products:catalog:all')).not.toBeNull();

    // Boundary 2: Deducting exact stock amount should succeed, set stock to 0, and evict cache
    expect(await inventoryService.deductStock('prod_103', initialAvailable)).toBe(true);
    expect(db.inventory.get('prod_103')?.availableStock).toBe(0);
    expect(memoryCache.get('products:catalog:all')).toBeNull();

    // Boundary 3: Deducting when stock is 0 should fail
    expect(await inventoryService.deductStock('prod_103', 1)).toBe(false);
  });

  it('should reject invalid, negative, fractional, or NaN stock deductions and leave stock and cache unchanged', async () => {
    productService.invalidateCatalogCache();
    await productService.getAllProducts();
    const cachedBefore = memoryCache.get('products:catalog:all');
    expect(cachedBefore).not.toBeNull();

    const stockBefore = db.inventory.get('prod_102')?.availableStock || 0;

    expect(await inventoryService.deductStock('prod_102', -5)).toBe(false);
    expect(await inventoryService.deductStock('prod_102', NaN)).toBe(false);
    expect(await inventoryService.deductStock('prod_102', 0)).toBe(false);
    expect(await inventoryService.deductStock('prod_102', 1.5)).toBe(false); // fractional quantity check
    expect(await inventoryService.deductStock('prod_102', Infinity)).toBe(false);
    expect(await inventoryService.deductStock('prod_102', '5' as any)).toBe(false);

    // Explicitly verify stock and cache remain unchanged
    const stockAfter = db.inventory.get('prod_102')?.availableStock;
    expect(stockAfter).toBe(stockBefore);
    expect(memoryCache.get('products:catalog:all')).toEqual(cachedBefore);
  });
});
