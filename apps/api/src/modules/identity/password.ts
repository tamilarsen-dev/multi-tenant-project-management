import argon2 from "argon2";

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same Argon2id work as a real verification when the email is unknown,
 * so response time does not reveal whether an account exists (docs/design/security.md §3).
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  await argon2.verify(await dummyHash, password);
  return false;
}
