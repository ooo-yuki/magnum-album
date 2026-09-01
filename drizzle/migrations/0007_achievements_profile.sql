-- magnum_mining_vault: лимитированные Vault-ящики (если не создан ранее)
CREATE TABLE IF NOT EXISTS "magnum_mining_vault" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id"),
  "vault_id" text NOT NULL,
  "claimed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_mining_vault_user_idx" ON "magnum_mining_vault" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_mining_vault_vault_idx" ON "magnum_mining_vault" ("vault_id");
--> statement-breakpoint
-- magnum_user_achievements: per-user unlocked achievements (Neon, no localStorage)
CREATE TABLE IF NOT EXISTS "magnum_user_achievements" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id"),
  "achievement_id" text NOT NULL,
  "unlocked_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("user_id","achievement_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_user_achievements_user_idx" ON "magnum_user_achievements" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_user_achievements_aid_idx" ON "magnum_user_achievements" ("achievement_id");
