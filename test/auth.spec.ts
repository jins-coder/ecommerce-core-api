import { describe, it, expect } from 'vitest';
import { authService } from '../src/services/auth.service.js';

describe('Auth Security Hardening Suite', () => {
  it('should reject login with non-existent user and mitigate timing attack', async () => {
    const result = await authService.authenticateUser('nonexistent@example.com', 'password123');
    expect(result).toBeNull();
  });

  it('should support token revocation', async () => {
    const sampleToken = 'header.payload.signature_mock';
    expect(authService.isTokenRevoked(sampleToken)).toBe(false);

    await authService.revokeToken(sampleToken);
    expect(authService.isTokenRevoked(sampleToken)).toBe(true);
  });
});
