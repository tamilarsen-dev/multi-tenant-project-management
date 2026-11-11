import { AppError } from "../../http/errors.js";
import { isUniqueViolation } from "../../db/errors.js";
import { db as defaultDb, type Db } from "../../db/transaction.js";

export function findUserByEmail(email: string, db: Db = defaultDb) {
  return db.user.findUnique({ where: { email } });
}

export async function createUser(
  data: { email: string; passwordHash: string; displayName: string },
  db: Db = defaultDb,
) {
  try {
    return await db.user.create({ data });
  } catch (error) {
    if (isUniqueViolation(error, { constraint: "users_email_unique", fields: ["email"] })) {
      throw new AppError("EMAIL_ALREADY_EXISTS");
    }
    throw error;
  }
}
