import { prisma } from "../../src/db/client.js";

const TABLES = ["activities", "memberships", "organizations", "sessions", "users"];

/** Empties every application table. Called in beforeEach (docs/engineering/testing.md §3). */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

/**
 * Makes every INSERT into `table` fail inside PostgreSQL while `work` runs, to prove
 * that the surrounding transaction rolls back (docs/engineering/testing.md §4.4).
 */
export async function withFailingInserts<T>(table: string, work: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION test_fail_insert() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER test_fail_insert BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION test_fail_insert()`,
  );
  try {
    return await work();
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_insert ON "${table}"`);
  }
}
