import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./client.js";

/** A transaction handle. Services pass it to repositories and never call Prisma methods on it. */
export type Tx = Prisma.TransactionClient;

/** Anything a repository can query through: the shared client or a transaction. */
export type Db = typeof prisma | Tx;

/**
 * Runs `work` in one database transaction (READ COMMITTED). Everything written
 * through `tx` commits together or rolls back together.
 */
export function runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(work, { maxWait: 5_000, timeout: 10_000 });
}

export { prisma as db };
