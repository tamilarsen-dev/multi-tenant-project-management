import { afterAll } from "vitest";

import { prisma } from "../src/db/client.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

// Tests truncate tables. Never let them touch a non-test database.
if (databaseName !== "project_management_test") {
  throw new Error(`Refusing to run tests against database: ${databaseName}`);
}

afterAll(async () => {
  await prisma.$disconnect();
});
