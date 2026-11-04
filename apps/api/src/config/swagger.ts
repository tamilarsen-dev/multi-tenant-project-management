import { readFileSync } from "node:fs";
import { parse } from "yaml";

export const swaggerDocument = parse(
  readFileSync(new URL("../../docs/openapi.yaml", import.meta.url), "utf8"),
);
