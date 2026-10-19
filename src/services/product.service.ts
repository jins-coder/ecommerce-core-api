import { db } from '../utils/db.js';
import { Product } from '../models/types.js';
import { inventoryService } from './inventory.service.js';
import { memoryCache } from '../utils/cache.js';

export interface ProductWithInventory extends Product {
  availableStock: number;
}

const CATALOG_CACHE_KEY = 'products:catalog:all';
const CACHE_TTL_SECONDS = 60;

export class ProductService {
  /**
   * High performance catalog retrieval with Cache-Aside pattern
   * and single-pass batch inventory lookup (O(1) resolution).
   */
  async getAllProducts(): Promise<ProductWithInventory[]> {
    // Check Cache-Aside layer
    const cached = memoryCache.get<ProductWithInventory[]>(CATALOG_CACHE_KEY);
    if (cached) {
      // Deep clone to prevent callers from corrupting nested structures like tags: string[]
      return structuredClone(cached);
    }

    const products = Array.from(db.products.values());
    const productIds = products.map((p) => p.id);

    // Batch fetch inventory in a single pass instead of N+1 individual queries
    const stockMap = await inventoryService.getBatchStock(productIds);

    const results: ProductWithInventory[] = products.map((prod) => ({
      ...prod,
      availableStock: stockMap.get(prod.id) ?? 0,
    }));

    // Cache computed results
    memoryCache.set(CATALOG_CACHE_KEY, results, CACHE_TTL_SECONDS);
    return structuredClone(results);
  }

  async getProductById(id: string): Promise<ProductWithInventory | null> {
    const prod = db.products.get(id);
    if (!prod) return null;

    const stock = await inventoryService.getStock(prod.id);
    return {
      ...prod,
      availableStock: stock ? stock.availableStock : 0,
    };
  }

  invalidateCatalogCache(): void {
    memoryCache.delete(CATALOG_CACHE_KEY);
  }
}

export const productService = new ProductService();
