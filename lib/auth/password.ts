// Password hashing using argon2id.
// `argon2` is a native node addon; for edge runtimes use `@node-rs/argon2`.
// We deliberately use argon2id (memory-hard) per the spec.
import argon2 from 'argon2';

const OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,  // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) {
    throw new Error('password must be at least 8 characters');
  }
  return argon2.hash(plain, OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
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
