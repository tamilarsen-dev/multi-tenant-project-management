import type { components } from "./schema";

/** DTOs generated from the API's OpenAPI bundle (`pnpm --filter web api:types`). */
type Schemas = components["schemas"];

export type User = Schemas["User"];
export type Session = Schemas["Session"];
export type Organization = Schemas["Organization"];
export type Membership = Schemas["Membership"];
export type OrganizationRole = Schemas["OrganizationRole"];
export type OrganizationWithMembership = Schemas["OrganizationWithMembership"];
export type Pagination = Schemas["Pagination"];
export type AuthResponse = Schemas["AuthResponse"]["data"];
export type ApiErrorBody = Schemas["ErrorResponse"]["error"];
export type FieldIssue = Schemas["ValidationErrorDetails"]["fields"][number];
