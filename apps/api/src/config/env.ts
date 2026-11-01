import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

export const env = envSchema.parse(process.env);

export function getDatabaseEnv() {
  return databaseEnvSchema.parse(process.env);
}
