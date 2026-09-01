CREATE TABLE "magnum_mining" (
	"user_id" integer PRIMARY KEY NOT NULL REFERENCES "magnum_users"("id"),
	"balance" integer DEFAULT 0 NOT NULL,
	"upgrades" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "magnum_ideas" ADD COLUMN "user_id" integer REFERENCES "magnum_users"("id");
