// Reference code generator and parser.
// Format: NMT-XXXXXX where X is from the unambiguous alphabet
// [ABCDEFGHJKLMNPQRSTUVWXYZ23456789] (no 0/O/1/I).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'NMT-';
const LEN = 6;

export function generateReference(): string {
  let out = '';
  for (let i = 0; i < LEN; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return PREFIX + out;
}

export function normaliseReference(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

const REF_RE = /^NMT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export function isValidReference(input: string): boolean {
  return REF_RE.test(normaliseReference(input));
}
