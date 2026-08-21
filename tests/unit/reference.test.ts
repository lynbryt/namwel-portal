import { describe, it, expect } from 'vitest';
import { generateReference, normaliseReference, isValidReference } from '../../lib/auth/reference';

describe('reference code', () => {
  it('matches the NMT-XXXXXX format', () => {
    for (let i = 0; i < 50; i++) {
      const r = generateReference();
      expect(r).toMatch(/^NMT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });
  it('never contains ambiguous chars (0, O, 1, I)', () => {
    for (let i = 0; i < 100; i++) {
      const r = generateReference();
      expect(r).not.toMatch(/[0O1I]/);
    }
  });
  it('validates input correctly', () => {
    expect(isValidReference('NMT-7K3M9X')).toBe(true);
    expect(isValidReference('nmt-7k3m9x')).toBe(true);
    expect(isValidReference('NMT-7K3M90')).toBe(false); // 0
    expect(isValidReference('NMT-7K3M9I')).toBe(false); // I
    expect(isValidReference('NMT-7K3M9')).toBe(false);  // too short
    expect(isValidReference('XX-7K3M9X')).toBe(false);  // wrong prefix
  });
  it('normalises input', () => {
    expect(normaliseReference('  nmt-7k3m9x  ')).toBe('NMT-7K3M9X');
  });
});
