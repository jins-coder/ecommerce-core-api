import express, { Express } from 'express';
import cors from 'cors';
import { loginHandler, logoutHandler } from './controllers/auth.controller.js';
import { getProductsHandler, getProductByIdHandler } from './controllers/product.controller.js';
import { createOrderHandler } from './controllers/order.controller.js';
import { authenticate } from './middleware/auth.middleware.js';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes
  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/logout', authenticate as any, logoutHandler as any);

  // Product routes
  app.get('/api/products', getProductsHandler);
  app.get('/api/products/:id', getProductByIdHandler);

  // Order routes (Protected)
  app.post('/api/orders', authenticate as any, createOrderHandler as any);

  return app;
}
