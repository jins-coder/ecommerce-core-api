import { Request, Response } from 'express';
import { productService } from '../services/product.service.js';

export async function getProductsHandler(req: Request, res: Response): Promise<void> {
  const products = await productService.getAllProducts();
  res.status(200).json({ products, count: products.length });
}

export async function getProductByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const product = await productService.getProductById(id);

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.status(200).json({ product });
}
