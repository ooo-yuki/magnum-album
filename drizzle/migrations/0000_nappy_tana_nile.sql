CREATE TABLE "magnum_eco_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"player" text,
	"score" integer,
	"rank" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magnum_frames" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"verified" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magnum_ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"votes" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magnum_leaderboard" (
	"id" serial PRIMARY KEY NOT NULL,
	"player" text,
	"score" integer,
	"game" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magnum_shop_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"skin_id" text,
	"purchased_at" timestamp DEFAULT now()
);
