-- M1: align identity and organization tables with docs/design/database.md.
-- Forward-only; existing rows are backfilled before constraints are added.

-- Enums (ADR-0005) ------------------------------------------------------------
CREATE TYPE "membership_status" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "activity_event_type" AS ENUM ('ORGANIZATION_CREATED', 'ORGANIZATION_UPDATED');

-- users -----------------------------------------------------------------------
ALTER TABLE "users"
  ALTER COLUMN "email" TYPE VARCHAR(254),
  ALTER COLUMN "password_hash" TYPE TEXT;
ALTER INDEX "users_email_key" RENAME TO "users_email_unique";
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_nonempty" CHECK (length(trim("email")) > 0),
  ADD CONSTRAINT "users_display_name_nonempty" CHECK (length(trim("display_name")) > 0);

-- sessions: absolute lifetime (ADR-0003) and RESTRICT --------------------------
ALTER TABLE "sessions" ADD COLUMN "absolute_expires_at" TIMESTAMPTZ(3);
UPDATE "sessions"
  SET "absolute_expires_at" = GREATEST("created_at" + INTERVAL '30 days', "expires_at");
ALTER TABLE "sessions" ALTER COLUMN "absolute_expires_at" SET NOT NULL;
ALTER INDEX "sessions_token_hash_key" RENAME TO "sessions_token_hash_unique";
ALTER TABLE "sessions"
  DROP CONSTRAINT "sessions_user_id_fkey",
  ADD CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "sessions_token_hash_length" CHECK (char_length("token_hash") = 64),
  ADD CONSTRAINT "sessions_expiry_after_creation" CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "sessions_expiry_within_absolute" CHECK ("expires_at" <= "absolute_expires_at");

-- organizations: optimistic concurrency ----------------------------------------
ALTER TABLE "organizations"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "organizations_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "organizations_name_nonempty" CHECK (length(trim("name")) > 0);

-- memberships: identifier and lifecycle ----------------------------------------
ALTER TABLE "memberships"
  ADD COLUMN "id" UUID,
  ADD COLUMN "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "joined_at" TIMESTAMPTZ(3),
  ADD COLUMN "removed_at" TIMESTAMPTZ(3),
  ADD COLUMN "updated_at" TIMESTAMPTZ(3);
UPDATE "memberships"
  SET "id" = gen_random_uuid(), "joined_at" = "created_at", "updated_at" = "created_at";
ALTER TABLE "memberships"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "joined_at" SET NOT NULL,
  ALTER COLUMN "joined_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updated_at" SET NOT NULL,
  ALTER COLUMN "role" DROP DEFAULT,
  ADD CONSTRAINT "memberships_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "memberships_status_timestamp_consistent" CHECK (
    ("status" = 'ACTIVE' AND "removed_at" IS NULL)
    OR ("status" = 'REMOVED' AND "removed_at" IS NOT NULL)
  ),
  DROP CONSTRAINT "memberships_organization_id_fkey",
  ADD CONSTRAINT "memberships_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP CONSTRAINT "memberships_user_id_fkey",
  ADD CONSTRAINT "memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "memberships_id_unique" ON "memberships"("id");
CREATE UNIQUE INDEX "memberships_org_id_unique" ON "memberships"("organization_id", "id");
DROP INDEX "memberships_user_id_idx";
CREATE INDEX "memberships_user_status_idx" ON "memberships"("user_id", "status");
CREATE INDEX "memberships_org_roster_idx"
  ON "memberships"("organization_id", "status", "joined_at" DESC, "id" DESC);

-- activities: append-only Organization stream -----------------------------------
-- issue_id has no FK yet; the migration that creates "issues" adds
-- activities_issue_tenant_fk (organization_id, issue_id) -> issues(organization_id, id).
CREATE TABLE "activities" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "issue_id" UUID,
  "event_type" "activity_event_type" NOT NULL,
  "metadata" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activities_metadata_object" CHECK (jsonb_typeof("metadata") = 'object')
);

CREATE UNIQUE INDEX "activities_org_id_unique" ON "activities"("organization_id", "id");
CREATE INDEX "activities_org_listing_idx"
  ON "activities"("organization_id", "created_at" DESC, "id" DESC);

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "activities_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
