import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generatePassword } from '../../lib/auth/password';

describe('password', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'wrong password')).toBe(false);
  });
  it('rejects too-short passwords', async () => {
    await expect(hashPassword('short')).rejects.toThrow();
  });
  it('generates passwords of length 12 with no ambiguous chars', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p.length).toBe(12);
      expect(p).not.toMatch(/[0OIl1]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[!@#$%^&*]/);
    }
  });
});
