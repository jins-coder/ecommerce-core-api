import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const { email, password } = parseResult.data;
  const result = await authService.authenticateUser(email, password);

  if (!result) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  res.status(200).json(result);
}

export async function logoutHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.token) {
    await authService.revokeToken(req.token);
  }
  res.status(200).json({ message: 'Successfully logged out and session revoked' });
}
