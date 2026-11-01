import { prisma } from "../../src/config/prisma.js";

try {
  await prisma.$connect();
  console.log("Prisma runtime connection successful");
} catch (error) {
  console.error("Prisma runtime connection failed");
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
