import { neon } from '@neondatabase/serverless';
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const sql = neon(url);
console.log('try alter');
try {
  const r = await sql`ALTER TABLE magnum_users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' NOT NULL`;
  console.log('alter ok', r);
} catch(e){ console.error('alter err', e); }
const cols = await sql`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='magnum_users' ORDER BY ordinal_position`;
console.log(JSON.stringify(cols,null,2));
try {
  const r2 = await sql`CREATE UNIQUE INDEX IF NOT EXISTS magnum_users_username_lower_unique ON magnum_users (LOWER(username))`;
  console.log('idx ok', r2);
} catch(e){ console.error('idx err', e); }
try {
  const r3 = await sql`UPDATE magnum_users SET role='admin' WHERE LOWER(username) IN ('5opka','admin') AND (role IS NULL OR role='user')`;
  console.log('update ok', r3);
} catch(e){ console.error('update err', e); }
const idx = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='magnum_users'`;
console.log(JSON.stringify(idx,null,2));
