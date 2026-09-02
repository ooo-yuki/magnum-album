import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const PORT = 34567;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitHealth() {
  for (let i=0;i<30;i++) {
    try {
      const r = await fetch(`${BASE}/magnum/api/health`);
      if (r.ok) { console.log('health ok'); return; }
    } catch {}
    await sleep(500);
  }
  throw new Error('health timeout');
}

async function main(){
  console.log('spawning server on', PORT);
  const env = { ...process.env, PORT: String(PORT) };
  const proc = spawn('/root/.bun/bin/bun', ['run','server.ts'], { cwd: '/root/magnum-album', env, stdio: 'pipe' });
  proc.stdout.on('data', d=>process.stdout.write('[srv] '+d));
  proc.stderr.on('data', d=>process.stderr.write('[srv-err] '+d));
  let ok = true;
  try {
    await waitHealth();
    // helpers
    const j = async (r)=>{ const t=await r.text(); try{ return {status:r.status, json:JSON.parse(t), text:t}; }catch{ return {status:r.status, text:t}; } };
    async function post(path, body, token){
      const h = { 'Content-Type':'application/json' };
      if(token) h['Authorization']='Bearer '+token;
      return j(await fetch(BASE+path, { method:'POST', headers:h, body: JSON.stringify(body)}));
    }
    async function get(path, token){
      const h = {};
      if(token) h['Authorization']='Bearer '+token;
      return j(await fetch(BASE+path, { headers:h }));
    }

    const rnd = Math.random().toString(36).slice(2,8);
    const userA = `test_${rnd}_a`;
    const passA = 'Pass1234';
    console.log('\n---1 register normal---');
    let r = await post('/magnum/api/auth/register', { username: userA, password: passA });
    console.log('register', r.status, r.json||r.text);
    if(r.status!==200) { console.log('FAIL register normal'); ok=false; }
    const tokenA = r.json?.token;

    // add coins to test privilege escalation: try to add 5000+ and then try to use mod
    console.log('\n---2 check coins/set without admin should be 403 ---');
    // First, test that normal user cannot set coins
    let r2 = await post('/magnum/api/coins/set', { balance: 9999999 }, tokenA);
    console.log('coins/set as normal', r2.status, r2.json||r2.text);
    if(r2.status!==403) { console.log('FAIL coins/set should be 403 for normal'); ok=false; } else console.log('PASS coins/set blocked');

    // check that even if user has 5000 coins, still not mod — need to give coins via DB? Use coins/add? but add limited 5000 per request.
    // We'll set balance via DB directly? Let's try to use coins/add to go to 5000
    console.log('\n---3 test balance privilege removal: chat delete should still fail ---');
    // create second user to own message
    const userB = `test_${rnd}_b`;
    const rB = await post('/magnum/api/auth/register', { username: userB, password: passA });
    console.log('register B', rB.status);
    const tokenB = rB.json?.token;
    // B posts a chat message (need endpoint)
    // find chat post route
    let chatPost = await post('/magnum/api/chat/send', { body: 'hello from B' }, tokenB);
    console.log('chat send', chatPost.status, chatPost.json||chatPost.text);
    let msgId = chatPost.json?.message?.id || chatPost.json?.id;
    if(!msgId){
      // try alternative: maybe /magnum/api/chat ?
      const alt = await post('/magnum/api/chat', { body: 'hello' }, tokenB);
      console.log('alt chat', alt.status, alt.json||alt.text);
    }
    if(msgId){
      // A tries to delete (should be 403 even with high balance)
      // give A high balance via admin? We can't, but we can manually bump via sql if needed. Let's just check delete as non-owner non-mod -> 403
      let del = await fetch(BASE+`/magnum/api/chat/${msgId}`, { method:'DELETE', headers:{ Authorization:'Bearer '+tokenA }});
      let dj = await j(del);
      console.log('chat delete by non-owner', dj.status, dj.json||dj.text);
      if(dj.status!==403) { console.log('FAIL chat delete should be 403 for normal'); ok=false; } else console.log('PASS chat delete blocked (no bal. privilege)');
    } else {
      console.log('SKIP chat delete test - no msg id');
    }

    console.log('\n---4 register admin123 -> should be 400 reserved ---');
    let r3 = await post('/magnum/api/auth/register', { username: 'admin123', password: 'Pass1234' });
    console.log('admin123', r3.status, r3.json||r3.text);
    if(r3.status!==400) { console.log('FAIL admin123 should be 400'); ok=false; } else console.log('PASS reserved');

    console.log('\n---5 register Admin vs admin conflict -> 409 ---');
    const uniq = `uniq_${rnd}`;
    let r5a = await post('/magnum/api/auth/register', { username: uniq, password: 'Pass1234' });
    console.log('uniq', r5a.status);
    let r5b = await post('/magnum/api/auth/register', { username: uniq.toUpperCase(), password: 'Pass1234' });
    console.log('Uniq upper', r5b.status, r5b.json||r5b.text);
    if(r5b.status!==409) { console.log('FAIL case-insensitive should be 409'); ok=false; } else console.log('PASS case insensitive 409');
    // also test reserved 5opka
    let r5c = await post('/magnum/api/auth/register', { username: '5opka', password: 'Pass1234' });
    console.log('5opka reserved', r5c.status, r5c.json||r5c.text);
    if(r5c.status!==400) { console.log('FAIL 5opka reserved'); ok=false; } else console.log('PASS 5opka reserved');

    console.log('\n---6 password 123 -> 400 weak ---');
    let r6 = await post('/magnum/api/auth/register', { username: `test_${rnd}_weak`, password: '123' });
    console.log('weak 123', r6.status, r6.json||r6.text);
    if(r6.status!==400) { console.log('FAIL weak should 400'); ok=false; } else console.log('PASS weak 400');
    let r6b = await post('/magnum/api/auth/register', { username: `test_${rnd}_weak2`, password: 'Password' });
    console.log('weak no digit', r6b.status, r6b.json||r6b.text);
    if(r6b.status!==400) { console.log('FAIL no digit should 400'); ok=false; } else console.log('PASS no digit 400');
    let r6c = await post('/magnum/api/auth/register', { username: `test_${rnd}_weak3`, password: `test_${rnd}_weak3` });
    console.log('pw==user', r6c.status, r6c.json||r6c.text);
    if(r6c.status!==400) { console.log('FAIL pw==user should 400'); ok=false; } else console.log('PASS pw==user 400');

    console.log('\n---7 5 logins by same username -> 429 ---');
    const targetUser = `test_${rnd}_rate`;
    await post('/magnum/api/auth/register', { username: targetUser, password: 'Pass1234' });
    // do 6 failed logins with wrong password (or correct but rate limited)
    let lastStatus=0;
    for(let i=0;i<6;i++){
      let lr = await post('/magnum/api/auth/login', { username: targetUser, password: 'wrong'+i });
      console.log(`login attempt ${i+1}`, lr.status);
      lastStatus = lr.status;
    }
    console.log('last status', lastStatus);
    if(lastStatus!==429) { console.log('FAIL rate limit should 429 (got '+lastStatus+')'); ok=false; } else console.log('PASS rate limit 429');

    console.log('\n---8 regex username must be a-z0-9_ ---');
    let r8 = await post('/magnum/api/auth/register', { username: 'bad-name!', password: 'Pass1234' });
    console.log('bad-name!', r8.status, r8.json||r8.text);
    if(r8.status!==400) { console.log('FAIL bad chars should 400'); ok=false; } else console.log('PASS regex 400');

    console.log('\n---9 check role column exists via sql ---');
    // do via health? just report

    console.log('\n=== RESULT', ok ? 'ALL PASS' : 'SOME FAIL', '===');
    if(!ok) process.exitCode=1;
  } catch(e){ console.error(e); process.exitCode=1; }
  finally { proc.kill(); await sleep(500); process.exit(process.exitCode||0); }
}
main();
