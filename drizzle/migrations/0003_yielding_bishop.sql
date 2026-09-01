-- Custom SQL migration for SHOP+ECO+FRAME: ensure correct schema (idempotent)
-- magnum_shop_inventory: user_id integer FK + equipped boolean
ALTER TABLE "magnum_shop_inventory" ADD COLUMN IF NOT EXISTS "equipped" boolean DEFAULT false;
-- user_id already converted to integer via manual fix; ensure FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='magnum_shop_inventory_user_id_fkey') THEN
    ALTER TABLE "magnum_shop_inventory" ADD CONSTRAINT "magnum_shop_inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "magnum_users"("id");
  END IF;
END $$;

-- magnum_eco_results: ensure user_id integer FK
ALTER TABLE "magnum_eco_results" ADD COLUMN IF NOT EXISTS "user_id" integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='magnum_eco_results_user_id_fkey') THEN
    ALTER TABLE "magnum_eco_results" ADD CONSTRAINT "magnum_eco_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "magnum_users"("id");
  END IF;
END $$;

-- magnum_frames: ensure user_id integer (already converted)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='magnum_frames_user_id_fkey') THEN
    ALTER TABLE "magnum_frames" ADD CONSTRAINT "magnum_frames_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "magnum_users"("id");
  END IF;
END $$;
