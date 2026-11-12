import "server-only";
import { z } from "zod";

const schema = z.object({
  API_URL: z.url().default("http://localhost:3000"),
  APP_TIME_ZONE: z.string().min(1).default("UTC"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

let cached: z.infer<typeof schema> | undefined;

/** Validated lazily so `next build` does not require runtime configuration. */
export function serverEnv() {
  cached ??= schema.parse(process.env);
  return cached;
}
