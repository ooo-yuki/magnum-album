-- 0032: crash 42 — шахта-краш x1.2-42 provably fair
CREATE TABLE IF NOT EXISTS "magnum_crash_rounds" (
  "id" serial primary key,
  "crash_at" double precision not null,
  "seed" text not null,
  "created_at" timestamp default now() not null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_crash_bets" (
  "id" serial primary key,
  "user_id" integer not null references "magnum_users"("id") on delete cascade,
  "round_id" integer not null references "magnum_crash_rounds"("id") on delete cascade,
  "stake" integer not null,
  "cashout" double precision,
  "payout" integer,
  "created_at" timestamp default now() not null,
  unique("user_id", "round_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_crash_pot" (
  "id" integer primary key,
  "pot" integer default 0 not null
);
--> statement-breakpoint
INSERT INTO "magnum_crash_pot" ("id","pot") VALUES (1,0) ON CONFLICT ("id") DO NOTHING;
