import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);

async function main(){
  // Clean if exists (idempotent)
  await sql`DELETE FROM magnum_ideas WHERE title IN ('Мультиплеер арена','Эко-челлендж','Магазин скинов')`;
  const rows = await sql`
    INSERT INTO magnum_ideas (title, description, votes, status) VALUES
      ('Мультиплеер арена', 'Дуэль hot-seat и по сети: сразись с другим братухой в реальном времени', 42, 'approved'),
      ('Эко-челлендж', '8 вопросов про Кемерово и Кузбасс — проверь свой эко-рейтинг', 27, 'approved'),
      ('Магазин скинов', '12 скинов 42-движения: от классики до лимиток MAGNUM', 15, 'pending')
    RETURNING *;
  `;
  console.log('INSERTED', rows.length, rows);
  const all = await sql`SELECT * FROM magnum_ideas ORDER BY id`;
  console.log('SELECT', all);
}
main().catch(e=>{console.error(e); process.exit(1)});
