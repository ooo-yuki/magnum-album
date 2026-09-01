-- 0018: fix magnum_subscriptions — add ends_at + started_at + id PK (old 4-col schema user_id PK tier expires_at created_at, missing drizzle id/started_at/ends_at)
ALTER TABLE "magnum_subscriptions" ADD COLUMN IF NOT EXISTS "started_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE "magnum_subscriptions" SET "started_at" = COALESCE("started_at", "created_at", now()) WHERE "started_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "magnum_subscriptions" ALTER COLUMN "started_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "magnum_subscriptions" ALTER COLUMN "started_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "magnum_subscriptions" ADD COLUMN IF NOT EXISTS "ends_at" timestamp;
--> statement-breakpoint
-- backfill ends_at from old expires_at where possible (if expires_at column exists)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='magnum_subscriptions' AND column_name='expires_at') THEN EXECUTE 'UPDATE "magnum_subscriptions" SET "ends_at" = "expires_at" WHERE "ends_at" IS NULL AND "expires_at" IS NOT NULL'; END IF; END $$;
--> statement-breakpoint
-- id column: ensure serial with PK (old table had user_id PK, id was missing)
ALTER TABLE "magnum_subscriptions" ADD COLUMN IF NOT EXISTS "id" integer;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "magnum_subscriptions_id_seq";
--> statement-breakpoint
ALTER TABLE "magnum_subscriptions" ALTER COLUMN "id" SET DEFAULT nextval('magnum_subscriptions_id_seq');
--> statement-breakpoint
UPDATE "magnum_subscriptions" SET "id" = nextval('magnum_subscriptions_id_seq') WHERE "id" IS NULL;
--> statement-breakpoint
ALTER TABLE "magnum_subscriptions" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint
ALTER SEQUENCE "magnum_subscriptions_id_seq" OWNED BY "magnum_subscriptions"."id";
--> statement-breakpoint
SELECT setval('magnum_subscriptions_id_seq', COALESCE((SELECT MAX("id") FROM "magnum_subscriptions"), 0) + 1, false);
--> statement-breakpoint
DO $$
DECLARE pk_col text;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY a.attnum) INTO pk_col
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
  WHERE c.conrelid='magnum_subscriptions'::regclass AND c.contype='p';
  IF pk_col IS NULL OR pk_col <> 'id' THEN
    -- drop existing PK if any (was user_id)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='magnum_subscriptions'::regclass AND contype='p') THEN
      EXECUTE (SELECT 'ALTER TABLE "magnum_subscriptions" DROP CONSTRAINT "' || conname || '"' FROM pg_constraint WHERE conrelid='magnum_subscriptions'::regclass AND contype='p' LIMIT 1);
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS "magnum_subscriptions_id_unique" ON "magnum_subscriptions" ("id");
    EXECUTE 'ALTER TABLE "magnum_subscriptions" ADD PRIMARY KEY ("id")';
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_magnum_subscriptions_user" ON "magnum_subscriptions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_magnum_subscriptions_ends_at" ON "magnum_subscriptions" ("ends_at");
