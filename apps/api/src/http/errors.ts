/**
 * Error catalog. Mirrors docs/design/api/errors.md: a code's name and status
 * never change once released. Adding a condition means adding a code here,
 * to the OpenAPI document, and to a test.
 */
export const ERROR_CATALOG = {
  // Request and transport
  INVALID_JSON: { status: 400, message: "Request body contains invalid JSON" },
  VALIDATION_ERROR: { status: 400, message: "Request validation failed" },
  ROUTE_NOT_FOUND: { status: 404, message: "Route not found" },
  PAYLOAD_TOO_LARGE: { status: 413, message: "Request body exceeds the allowed size" },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "Request body must be sent as application/json" },
  RATE_LIMIT_EXCEEDED: { status: 429, message: "Too many requests" },
  INTERNAL_SERVER_ERROR: { status: 500, message: "An unexpected error occurred" },

  // Authentication and authorization
  MISSING_AUTHENTICATION: { status: 401, message: "Authentication is required" },
  INVALID_SESSION: { status: 401, message: "The session is invalid or has expired" },
  INVALID_CREDENTIALS: { status: 401, message: "Email or password is incorrect" },
  FORBIDDEN: { status: 403, message: "You do not have permission to perform this action" },
  INVITATION_EMAIL_MISMATCH: { status: 403, message: "This invitation was sent to a different email address" },

  // Not found
  ORGANIZATION_NOT_FOUND: { status: 404, message: "Organization not found" },
  MEMBERSHIP_NOT_FOUND: { status: 404, message: "Membership not found" },
  INVITATION_NOT_FOUND: { status: 404, message: "Invitation not found" },
  PROJECT_NOT_FOUND: { status: 404, message: "Project not found" },
  ISSUE_NOT_FOUND: { status: 404, message: "Issue not found" },
  LABEL_NOT_FOUND: { status: 404, message: "Label not found" },
  COMMENT_NOT_FOUND: { status: 404, message: "Comment not found" },
  NOTIFICATION_NOT_FOUND: { status: 404, message: "Notification not found" },

  // Conflicts
  EMAIL_ALREADY_EXISTS: { status: 409, message: "An account with this email already exists" },
  VERSION_CONFLICT: { status: 409, message: "The resource was modified by another request" },
  LAST_OWNER_REQUIRED: { status: 409, message: "The organization must keep at least one active owner" },
  ALREADY_ORGANIZATION_MEMBER: { status: 409, message: "This user is already a member of the organization" },
  PENDING_INVITATION_EXISTS: { status: 409, message: "A pending invitation already exists for this email" },
  INVITATION_NOT_PENDING: { status: 409, message: "The invitation is no longer pending" },
  INVITATION_EXPIRED: { status: 409, message: "The invitation has expired" },
  MEMBERSHIP_ALREADY_ACTIVE: { status: 409, message: "You are already an active member of this organization" },
  PROJECT_ARCHIVED: { status: 409, message: "The project is archived" },
  ISSUE_ARCHIVED: { status: 409, message: "The issue is archived" },
  LABEL_ARCHIVED: { status: 409, message: "The label is archived" },
  LABEL_NAME_ALREADY_EXISTS: { status: 409, message: "An active label with this name already exists" },
  COMMENT_DELETED: { status: 409, message: "The comment has been deleted" },

  // Domain rules
  INVALID_STATUS_TRANSITION: { status: 422, message: "The requested status transition is not allowed" },
  ASSIGNEE_NOT_ACTIVE: { status: 422, message: "The assignee is not an active member" },

  // Throttling
  RESEND_COOLDOWN: { status: 429, message: "Please wait before resending this invitation" },
  RESEND_LIMIT_REACHED: { status: 429, message: "This invitation has been resent too many times" },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export type ErrorDetails = Record<string, unknown>;

/**
 * An expected failure. Services throw it; the error handler is the only place
 * that turns it into an HTTP response.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetails;

  constructor(code: ErrorCode, options: { message?: string; details?: ErrorDetails } = {}) {
    super(options.message ?? ERROR_CATALOG[code].message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CATALOG[code].status;
    this.details = options.details;
  }
}
