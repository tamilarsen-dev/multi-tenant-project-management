import { z } from "zod";

const envScheme = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export const env = envScheme.parse(process.env);
