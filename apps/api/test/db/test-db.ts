import { prisma } from "../../src/config/prisma.js";

try {
  const result = await prisma.$queryRaw<
    { version: string; database: string }[]
  >`
        select version(),
        current_database() as DATABASE
    `;

  console.log(result[0]);
} catch (error) {
  console.error("Database connection test failed: ", error);
  process.exitCode = -1;
} finally {
  await prisma.$disconnect();
}
