-- Тестовые аккаунты не должны быть видны на живом сайте (AGENTS.md).
-- Скрываем флагом, а не удалением: обратимо и не рвёт внешние ключи.
ALTER TABLE "magnum_users" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "magnum_users_hidden_idx" ON "magnum_users" ("hidden");

-- Аккаунты, нагенеренные автотестами и агентами.
UPDATE "magnum_users" SET "hidden" = true WHERE lower("username") IN (
  'shopfix_1788300069','spec42_1788300404816','admin123','uniq_ee94sw',
  't_s4ac_a','t_s4ac_b','uq_s4ac','t_s4ac_rate','tx_mtj8rw03_913w',
  'race7ojpnc','race2y2mfaa','shop20jst9','shopt9o42w','race2m8am6h',
  'racee77t44','race2ahyg5v','race677q1c','shopkw44je',
  'sess_test_1788303319_66981','t1788303334_5218',
  't86_test_funnel','t86_test_funnel2','testshop42','123123'
);
