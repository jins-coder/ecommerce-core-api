import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { orderService } from '../services/order.service.js';

export async function createOrderHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { items } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Order items array is required' });
    return;
  }

  try {
    const order = await orderService.createOrder(userId, items);
    res.status(201).json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to process order' });
  }
}
