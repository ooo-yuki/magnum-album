-- 0037: единая валюта — сливаем "пыль" (magnum_dust) в общий баланс monет (magnum_coins).
-- На момент миграции magnum_dust не содержал ни одной строки с ненулевым балансом,
-- но на всякий случай переносим любые остатки перед удалением таблицы.
UPDATE magnum_coins c
SET balance = c.balance + d.balance
FROM magnum_dust d
WHERE d.user_id = c.user_id AND d.balance > 0;
--> statement-breakpoint
INSERT INTO magnum_coins (user_id, balance)
SELECT d.user_id, 1000 + d.balance
FROM magnum_dust d
WHERE d.balance > 0 AND NOT EXISTS (SELECT 1 FROM magnum_coins c WHERE c.user_id = d.user_id);
--> statement-breakpoint
DROP TABLE IF EXISTS magnum_dust;
