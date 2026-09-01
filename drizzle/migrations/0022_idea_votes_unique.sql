-- 0022: fix NeonDbError ON CONFLICT (user_id, idea_id) — ensure unique indexes exist for dedup
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_idea_votes_user_idea_unique" ON "magnum_idea_votes" ("user_id", "idea_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_idea_bookmarks_user_idea_unique" ON "magnum_idea_bookmarks" ("user_id", "idea_id");
