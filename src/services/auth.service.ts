import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../utils/db.js';
import { User } from '../models/types.js';
import { JWT_SECRET } from '../config/env.js';

export class AuthService {
  // Map token -> expiry timestamp in ms to enable automated eviction
  private revokedTokens: Map<string, number> = new Map();

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

  /**
   * Revokes token with expiration TTL matching token lifespan (2 hours)
   * Prevents unbounded in-memory leak by evicting stale tokens.
   */
  async revokeToken(token: string, ttlMs: number = 2 * 60 * 60 * 1000): Promise<void> {
    this.pruneExpiredRevocations();
    this.revokedTokens.set(token, Date.now() + ttlMs);
  }

  isTokenRevoked(token: string): boolean {
    this.pruneExpiredRevocations();
    return this.revokedTokens.has(token);
  }

  pruneExpiredRevocations(): void {
    const now = Date.now();
    for (const [token, expiry] of this.revokedTokens.entries()) {
      if (now > expiry) {
        this.revokedTokens.delete(token);
      }
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    return db.users.get(userId) || null;
  }
}

export const authService = new AuthService();
