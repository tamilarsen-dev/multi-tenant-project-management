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

  /**
   * Express `trust proxy` (security §4). Unset: the socket address is the client.
   * Set to the address of the one trusted hop, e.g. "loopback" when the web BFF
   * runs on the same host, so its X-Forwarded-For identifies the real client.
   */
  TRUST_PROXY: z.string().trim().min(1).optional(),
});

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

export const env = envSchema.parse(process.env);

export function getDatabaseEnv() {
  return databaseEnvSchema.parse(process.env);
}
