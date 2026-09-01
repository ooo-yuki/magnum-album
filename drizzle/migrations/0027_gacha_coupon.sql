-- gacha coupon 42: GACHA42 (10× roll) + GACHADUST (420 dust) → reuse magnum_promo_codes
INSERT INTO "magnum_promo_codes" ("code","reward","max_uses","uses","expires_at") VALUES
  ('GACHA42', 0, 1000, 0, now() + interval '30 days'),
  ('GACHADUST', 0, 1000, 0, now() + interval '30 days')
ON CONFLICT ("code") DO NOTHING;
