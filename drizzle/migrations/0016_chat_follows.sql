-- 0016: global chat persisted + social follows
CREATE TABLE IF NOT EXISTS "magnum_chat_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "body" text NOT NULL CHECK (char_length("body") >= 1 AND char_length("body") <= 500),
  "reply_to" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_follows" (
  "id" serial PRIMARY KEY NOT NULL,
  "follower_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "following_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "magnum_follows_no_self" CHECK ("follower_id" <> "following_id"),
  CONSTRAINT "magnum_follows_unique" UNIQUE ("follower_id","following_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_chat_user_idx" ON "magnum_chat_messages" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_chat_created_idx" ON "magnum_chat_messages" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_follows_follower_idx" ON "magnum_follows" ("follower_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_follows_following_idx" ON "magnum_follows" ("following_id");
