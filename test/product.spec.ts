import { describe, it, expect } from 'vitest';
import { productService } from '../src/services/product.service.js';
import { memoryCache } from '../src/utils/cache.js';

describe('Product Catalog Cache & Optimization Suite', () => {
  it('should populate cache on first fetch and serve from cache on second fetch', async () => {
    productService.invalidateCatalogCache();

    const firstRun = await productService.getAllProducts();
    expect(firstRun.length).toBeGreaterThan(0);

    // Verify cache has entry
    const cached = memoryCache.get('products:catalog:all');
    expect(cached).toBeDefined();
    expect(cached).toEqual(firstRun);
  });

  it('should invalidate cache when triggered', async () => {
    productService.invalidateCatalogCache();
    expect(memoryCache.get('products:catalog:all')).toBeNull();
  });
});
