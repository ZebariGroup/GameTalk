import { describe, expect, it } from 'vitest';
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '@/lib/adminSession';

describe('adminSession', () => {
  const secret = 'test-secret-key-for-hmac-only';

  it('creates a verifiable token', async () => {
    const token = await createAdminSessionToken(secret);
    expect(await verifyAdminSessionToken(token, secret)).toBe(true);
  });

  it('rejects wrong secret', async () => {
    const token = await createAdminSessionToken(secret);
    expect(await verifyAdminSessionToken(token, 'other')).toBe(false);
  });

  it('rejects tampered token', async () => {
    const token = await createAdminSessionToken(secret);
    const tampered = token.slice(0, -4) + 'dead';
    expect(await verifyAdminSessionToken(tampered, secret)).toBe(false);
  });

  it('rejects missing token', async () => {
    expect(await verifyAdminSessionToken(undefined, secret)).toBe(false);
  });
});
