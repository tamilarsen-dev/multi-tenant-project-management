import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    await client.connect();

    const result = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS username,
        inet_client_addr() AS client_address
    `);

    console.log(result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
