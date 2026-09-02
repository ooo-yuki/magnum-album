import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) { console.error('no url'); process.exit(1); }
const sql = neon(url);
const content = readFileSync('drizzle/migrations/0024_auth_hardening.sql','utf8');
const statements = content.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
for (const st of statements) {
  console.log('RUN:', st.slice(0,130).replace(/\n/g,' '));
  try {
    const r = await sql.unsafe(st);
    console.log(' -> ok', JSON.stringify(r).slice(0,200));
  } catch(e){ console.error('ERR', e); }
}
console.log('--- columns ---');
const cols = await sql`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='magnum_users' ORDER BY ordinal_position`;
console.log(JSON.stringify(cols,null,2));
console.log('--- indexes ---');
const idx = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='magnum_users'`;
console.log(JSON.stringify(idx,null,2));
