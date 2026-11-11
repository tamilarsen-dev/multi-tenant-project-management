# 0004. Cursor pagination with exact total count

- Status: Accepted
- Date: 2026-11-09

## Context

Issue, Activity, Comment, and Notification lists grow continuously and change while users page through them. Offset pagination skips or repeats rows when rows are inserted between requests and gets slower as the offset grows. The UI also wants to show how many items match a filter.

## Decision

1. Collections use keyset (cursor) pagination: `limit` (1–100, default 20) and an opaque `cursor`.
2. Every collection has a deterministic order ending in `id`; the order is stated per endpoint.
3. The cursor is base64url-encoded JSON of the last row's sort-key values. It is validated on input; it never widens the query, because tenant and authorization filters always come from the current request.
4. Responses include `pagination: { nextCursor, hasMore, totalCount }`, where `totalCount` is an exact `COUNT(*)` with the same filters and scope.
5. Invalid `limit` or `cursor` is rejected with `400`, never silently corrected.

## Alternatives considered

- **Offset pagination.** Simple and supports "jump to page N", but unstable under inserts and slow for deep pages. Rejected.
- **Cursor without `totalCount`.** Cheapest, but the UI cannot show counts. Rejected for V1.
- **Signed (HMAC) cursors.** Prevent clients from forging cursors, but a forged cursor can only position within data the actor may already see, so signing adds a key to manage for no security gain. Rejected.

## Consequences

- Each list request runs two queries (page and count). If `COUNT(*)` becomes a measured bottleneck, revisit with an estimated count or drop `totalCount` in a new API version.
- Indexes must match each endpoint's filter and sort columns ([Database §6](../design/database.md#6-index-strategy)).
- A shared pagination helper encodes and decodes cursors so every module behaves the same.
