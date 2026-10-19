import crypto from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      // Ephemeral cryptographically random 256-bit secret for test isolation (zero hardcoded strings)
      return crypto.randomBytes(32).toString('hex');
    }
    throw new Error('FATAL: JWT_SECRET environment variable is missing. Server cannot start securely without a configured secret.');
  }
  return secret;
}

export const JWT_SECRET = getJwtSecret();
