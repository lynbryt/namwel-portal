// Password hashing using argon2id.
// `@node-rs/argon2` is a pure-Rust, statically-linked implementation that
// works on Vercel's serverless runtime (the older `argon2` package is a
// native node-gyp addon that fails to load on Lambda/Vercel).
import { hash, verify, Options } from '@node-rs/argon2';

// `Algorithm` is a const enum in @node-rs/argon2, which can't be used with
// TypeScript's isolatedModules. Use the numeric value directly:
//   Argon2d = 0, Argon2i = 1, Argon2id = 2
const ARGON2ID = 2 as const;

const OPTS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 19456,  // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) {
    throw new Error('password must be at least 8 characters');
  }
  return hash(plain, OPTS);
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashStr, plain);
  } catch {
    return false;
  }
}

// Generate a one-time password. 12 chars, mixed case + digits + symbol,
// no visually ambiguous characters.
export function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
  const lower = 'abcdefghijkmnpqrstuvwxyz'; // no l
  const digits = '23456789';                 // no 0, 1
  const symbols = '!@#$%^&*';

  const all = upper + lower + digits + symbols;
  const out: string[] = [];

  // guarantee at least one of each class
  out.push(upper[Math.floor(Math.random() * upper.length)]);
  out.push(lower[Math.floor(Math.random() * lower.length)]);
  out.push(digits[Math.floor(Math.random() * digits.length)]);
  out.push(symbols[Math.floor(Math.random() * symbols.length)]);

  // fill the rest
  for (let i = 4; i < 12; i++) {
    out.push(all[Math.floor(Math.random() * all.length)]);
  }

  // shuffle (Fisher–Yates)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out.join('');
}
