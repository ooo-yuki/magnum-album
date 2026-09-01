CREATE TABLE "magnum_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magnum_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer REFERENCES "magnum_users"("id"),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "magnum_coins" (
	"user_id" integer PRIMARY KEY NOT NULL REFERENCES "magnum_users"("id"),
	"balance" integer DEFAULT 1000
);
