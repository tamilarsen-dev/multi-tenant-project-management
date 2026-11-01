import { API_ERRORS, type ApiErrorCode } from "./error-definitions.js";

export type ErrorDetails = Record<string, unknown>;

export type AppErrorOptions = {
  message?: string;
  details?: ErrorDetails;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: ErrorDetails;

  constructor(code: ApiErrorCode, options: AppErrorOptions = {}) {
    const definition = API_ERRORS[code];

    super(options.message ?? definition.message);

    this.name = "AppError";
    this.code = code;
    this.statusCode = definition.statusCode;
    this.details = options.details;
  }
}
