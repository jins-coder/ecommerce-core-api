import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../utils/db.js';
import { User } from '../models/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-12345';

export class AuthService {
  private revokedTokens: Set<string> = new Set();

  async authenticateUser(email: string, passwordPlain: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> } | null> {
    const users = Array.from(db.users.values());
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!user) {
      // Execute dummy compare to mitigate timing-based user enumeration attacks
      await bcrypt.compare(passwordPlain, '$2a$10$wT8B18X3gGzM3r2n5YdGTu6x3aW4P5o7B9s0C1d2E3f4G5h6I7j8K');
      return null;
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, jti: `jti_${Date.now()}_${Math.random()}` },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const { passwordHash, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  async revokeToken(token: string): Promise<void> {
    this.revokedTokens.add(token);
  }

  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }

  async getUserById(userId: string): Promise<User | null> {
    return db.users.get(userId) || null;
  }
}

export const authService = new AuthService();
