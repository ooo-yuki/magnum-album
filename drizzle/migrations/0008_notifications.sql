-- magnum_notifications: inbox per user (Neon, no localStorage) + vault was in 0007
CREATE TABLE IF NOT EXISTS "magnum_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id"),
  "title" text NOT NULL,
  "body" text NOT NULL,
  "kind" text DEFAULT 'info' NOT NULL,
  "read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_notifications_user_idx" ON "magnum_notifications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_notifications_read_idx" ON "magnum_notifications" ("read");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_notifications_created_idx" ON "magnum_notifications" ("created_at");
