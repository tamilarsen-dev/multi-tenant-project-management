export const API_ERRORS = {
  INVALID_JSON: {
    statusCode: 400,
    message: "Request body contains invalid JSON",
  },
  VALIDATION_ERROR: {
    statusCode: 400,
    message: "Request validation failed",
  },
  UNAUTHENTICATED: {
    statusCode: 401,
    message: "Authentication is required",
  },
  FORBIDDEN: {
    statusCode: 403,
    message: "You do not have permission to perform this action",
  },
  NOT_FOUND: {
    statusCode: 404,
    message: "Resource not found",
  },
  CONFLICT: {
    statusCode: 409,
    message: "The request conflicts with the current resource state",
  },
  PAYLOAD_TOO_LARGE: {
    statusCode: 413,
    message: "Request body exceeds the allowed size",
  },
  RATE_LIMIT_EXCEEDED: {
    statusCode: 429,
    message: "Too many requests",
  },
  INTERNAL_SERVER_ERROR: {
    statusCode: 500,
    message: "An unexpected error occurred",
  },
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

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
