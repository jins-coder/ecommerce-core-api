import { describe, it, expect } from 'vitest';
import { productService } from '../src/services/product.service.js';
import { orderService } from '../src/services/order.service.js';
import { db } from '../src/utils/db.js';

describe('E-Commerce Core API Test Suite', () => {
  it('should list seeded products with inventory count', async () => {
    const products = await productService.getAllProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toHaveProperty('availableStock');
  });

  it('should create order and deduct stock', async () => {
    const initialStock = (await db.inventory.get('prod_101'))?.availableStock || 0;
    const order = await orderService.createOrder('usr_1', [
      { productId: 'prod_101', quantity: 2, unitPrice: 89.99 },
    ]);

    expect(order).toBeDefined();
    expect(order.status).toBe('confirmed');

    const updatedStock = (await db.inventory.get('prod_101'))?.availableStock;
    expect(updatedStock).toBe(initialStock - 2);
  });
});
