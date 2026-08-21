// Shared reference + password generators (used by both the create-test-session
// script and the admin "Create signing session" form, so they stay in sync).

import { generateReference as _generateReference, isValidReference } from '@/lib/auth/reference';
import { generatePassword as _generatePassword } from '@/lib/auth/password';

export const generateReference = _generateReference;
export const generatePassword = _generatePassword;
export { isValidReference };

// Try up to N times to generate a reference that doesn't already exist.
// Caller passes an async `existsInDb(ref: string) => boolean`.
export async function generateUniqueReference(
  existsInDb: (ref: string) => Promise<boolean>,
  maxAttempts = 5,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const ref = _generateReference();
    if (!(await existsInDb(ref))) return ref;
  }
  throw new Error('failed to generate unique reference after ' + maxAttempts + ' attempts');
}
