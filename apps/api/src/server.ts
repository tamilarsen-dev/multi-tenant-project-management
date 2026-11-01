import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { app } from "./app.js";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API server started");
});

let isShuttingDown = false;

async function shutdown(signal: "SIGINT" | "SIGTERM") {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info({ signal }, "Shutdown signal received");

  try {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    logger.info("HTTP server closed");

    await prisma.$disconnect();

    logger.info("Database connection closed");
  } catch (err) {
    logger.error({ err }, "Graceful shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
