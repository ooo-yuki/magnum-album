-- 0021: magnum_pity — gacha pity 90/180 + 50/50 + soft-pity 65
CREATE TABLE IF NOT EXISTS "magnum_pity" (
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "banner_type" text NOT NULL,
  "pity_counter" integer DEFAULT 0 NOT NULL,
  "pity_5star" integer DEFAULT 0 NOT NULL,
  "lost_50_50" boolean DEFAULT false NOT NULL,
  "pulls" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "banner_type")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_magnum_pity_user" ON "magnum_pity" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_magnum_pity_banner" ON "magnum_pity" ("banner_type");
