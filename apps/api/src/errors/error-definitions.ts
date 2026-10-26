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
  INTERNAL_SERVER_ERROR: {
    statusCode: 500,
    message: "An unexpected error occurred",
  },
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;
