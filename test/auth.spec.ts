import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { authService } from '../src/services/auth.service.js';
import { db } from '../src/utils/db.js';
import { authenticate, AuthenticatedRequest } from '../src/middleware/auth.middleware.js';

describe('Auth Security Hardening Suite', () => {
  it('should execute dummy comparison on non-existent user to verify timing defense', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare');
    const result = await authService.authenticateUser('nonexistent_user_99@example.com', 'somePassword123');
    
    expect(result).toBeNull();
    // Verifies dummy compare is executed against static hash (fails if dummy compare is removed)
    expect(compareSpy).toHaveBeenCalledWith('somePassword123', expect.any(String));
    compareSpy.mockRestore();
  });

  it('should reject login when password does not match', async () => {
    // Seeded user alex@example.com
    const result = await authService.authenticateUser('alex@example.com', 'wrongpassword');
    expect(result).toBeNull();
  });

  it('should authenticate valid credentials and issue JWT token', async () => {
    // Hash a known password for testing
    const testHash = await bcrypt.hash('CorrectPass123!', 10);
    db.users.set('test_auth_usr', {
      id: 'test_auth_usr',
      email: 'tester@example.com',
      passwordHash: testHash,
      name: 'Test Candidate',
      role: 'customer',
      createdAt: new Date().toISOString(),
    });

    const result = await authService.authenticateUser('tester@example.com', 'CorrectPass123!');
    expect(result).not.toBeNull();
    expect(result?.token).toBeDefined();
    expect(result?.user.email).toBe('tester@example.com');
  });

  it('should support token revocation and evict expired tokens without memory leak', async () => {
    const sampleToken = 'header.payload.signature_mock';
    
    // Revoke with a 50ms short TTL to test eviction
    await authService.revokeToken(sampleToken, 50);
    expect(authService.isTokenRevoked(sampleToken)).toBe(true);

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 60));
    
    // Once expired, isTokenRevoked should evict it and return false
    expect(authService.isTokenRevoked(sampleToken)).toBe(false);
  });

  it('should block revoked token in auth middleware with 401', async () => {
    const testToken = 'mock_jwt_token_for_middleware_test';
    await authService.revokeToken(testToken);

    const mockReq = {
      headers: { authorization: `Bearer ${testToken}` },
    } as AuthenticatedRequest;

    let statusCode: number | null = null;
    let responseBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    };

    const nextFn = vi.fn();

    authenticate(mockReq, mockRes, nextFn);

    expect(statusCode).toBe(401);
    expect(responseBody).toEqual({ error: 'Token has been revoked' });
    expect(nextFn).not.toHaveBeenCalled();
  });
});
