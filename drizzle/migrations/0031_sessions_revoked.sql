ALTER TABLE "magnum_sessions" ADD COLUMN IF NOT EXISTS "revoked" boolean DEFAULT false NOT NULL;
ALTER TABLE "magnum_sessions" ADD COLUMN IF NOT EXISTS "ip" text;
ALTER TABLE "magnum_sessions" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "magnum_sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp DEFAULT now();
ALTER TABLE "magnum_sessions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
DO $$ BEGIN
  BEGIN
    ALTER TABLE "magnum_sessions" DROP CONSTRAINT IF EXISTS "magnum_sessions_user_id_fkey";
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    ALTER TABLE "magnum_sessions" ADD CONSTRAINT "magnum_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "magnum_users"("id") ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END;
END $$;
CREATE INDEX IF NOT EXISTS "magnum_sessions_user_id_idx" ON "magnum_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "magnum_sessions_expires_at_idx" ON "magnum_sessions" ("expires_at");
CREATE INDEX IF NOT EXISTS "magnum_sessions_revoked_idx" ON "magnum_sessions" ("revoked");
