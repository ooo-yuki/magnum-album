-- Рейтинг привязан к аккаунту: без user_id строка в публичные топы не попадает.
ALTER TABLE "magnum_leaderboard" ADD COLUMN IF NOT EXISTS "user_id" integer REFERENCES "magnum_users"("id") ON DELETE CASCADE;

-- Историю связываем с аккаунтами по имени; несвязанные строки остаются вне топов.
UPDATE "magnum_leaderboard" l SET "user_id" = u."id" FROM "magnum_users" u
  WHERE l."user_id" IS NULL AND lower(u."username") = lower(l."player");

CREATE INDEX IF NOT EXISTS "magnum_leaderboard_user_game_idx" ON "magnum_leaderboard" ("user_id", "game", "score" DESC);
