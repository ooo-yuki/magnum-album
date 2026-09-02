-- Косметика в публичных рейтингах читается пачкой по equipped=true,
-- а инвентарь — по user_id. Индекс закрывает оба запроса.
CREATE INDEX IF NOT EXISTS "magnum_cosmetics_user_equipped_idx" ON "magnum_cosmetics" ("user_id", "equipped");
-- magnum_sessions(user_id) уже создан в 0031_sessions_revoked.sql
