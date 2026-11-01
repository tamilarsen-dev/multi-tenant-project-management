import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { getDatabaseEnv } from "./env.js";

const { DATABASE_URL } = getDatabaseEnv();

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
