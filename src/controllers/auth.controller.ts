import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const result = await authService.authenticateUser(email, password);
  if (!result) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  res.status(200).json(result);
}
