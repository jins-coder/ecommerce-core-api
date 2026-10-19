import { db } from '../utils/db.js';
import { Product } from '../models/types.js';
import { inventoryService } from './inventory.service.js';

export interface ProductWithInventory extends Product {
  availableStock: number;
}

export class ProductService {
  async getAllProducts(): Promise<ProductWithInventory[]> {
    const products = Array.from(db.products.values());
    const results: ProductWithInventory[] = [];

    // Baseline: N+1 query loop fetching inventory individually per product
    for (const prod of products) {
      const stock = await inventoryService.getStock(prod.id);
      results.push({
        ...prod,
        availableStock: stock ? stock.availableStock : 0,
      });
    }

    return results;
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
}

export const productService = new ProductService();
