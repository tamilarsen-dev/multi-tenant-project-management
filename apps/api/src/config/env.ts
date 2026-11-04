import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(z.url().min(1))),
});

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

export const env = envSchema.parse(process.env);

export function getDatabaseEnv() {
  return databaseEnvSchema.parse(process.env);
}
