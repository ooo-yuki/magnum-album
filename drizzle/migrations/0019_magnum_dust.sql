-- 0019: magnum_dust — prism/crystal dust vault (was only ensureDustTable CREATE IF NOT EXISTS, no migration)
CREATE TABLE IF NOT EXISTS "magnum_dust" (
  "user_id" integer PRIMARY KEY REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "balance" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_magnum_dust_updated" ON "magnum_dust" ("updated_at");
