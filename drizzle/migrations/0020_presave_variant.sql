-- AB variant for presave clicks
ALTER TABLE "magnum_presave_clicks" ADD COLUMN IF NOT EXISTS "variant" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_presave_clicks_variant_idx" ON "magnum_presave_clicks" ("variant");
