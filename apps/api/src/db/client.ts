import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import { getDatabaseEnv } from "../config/env.js";

const { DATABASE_URL } = getDatabaseEnv();

// Connection and timeout baseline: docs/design/database.md §7.11.
const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  idle_in_transaction_session_timeout: 10_000,
  options: "-c lock_timeout=3000",
});

/** The only PrismaClient instance. Import it only from src/db and *.repository.ts files (ADR-0009). */
export const prisma = new PrismaClient({ adapter });
