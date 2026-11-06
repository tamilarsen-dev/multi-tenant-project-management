const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (databaseName !== "project_management_test") {
  throw new Error(`Refusing to run against database: ${databaseName}`);
}

console.log(`Using test database: ${databaseName}`);
