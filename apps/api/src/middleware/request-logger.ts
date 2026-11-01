import { pinoHttp } from "pino-http";
import { logger } from "../config/logger.js";

export const requestLogger = pinoHttp({
  logger,

  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.path,
      };
    },

    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
