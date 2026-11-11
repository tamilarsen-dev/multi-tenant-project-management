/** Response DTOs: docs/design/api/contract.md §2.1–2.2. */

export function toUserDto(user: { id: string; email: string; displayName: string; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toSessionDto(
  session: { id: string; expiresAt: Date; absoluteExpiresAt: Date },
  accessToken: string,
) {
  return {
    id: session.id,
    accessToken,
    tokenType: "Bearer" as const,
    expiresAt: session.expiresAt.toISOString(),
    absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
  };
}
