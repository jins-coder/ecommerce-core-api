import jwt from 'jsonwebtoken';
import { db } from '../utils/db.js';
import { User } from '../models/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-12345';

export class AuthService {
  async authenticateUser(email: string, passwordPlain: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> } | null> {
    // Find user by email
    const users = Array.from(db.users.values());
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return null;
    }

    // In baseline: simplified check (deliberately simple for PR #1 to harden)
    const isValid = user.passwordHash.length > 0;
    if (!isValid) {
      return null;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const { passwordHash, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  async getUserById(userId: string): Promise<User | null> {
    return db.users.get(userId) || null;
  }
}

export const authService = new AuthService();
