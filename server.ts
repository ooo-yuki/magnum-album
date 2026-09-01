/**
 * Прокси /magnum/api/ai → Xiaomi MiMo v2.5 (vision).
 * Ключ XIAOMI_API_KEY живёт ТОЛЬКО на сервере, в клиентский бандл не попадает.
 * + Кастом-авторизация MAGNUM (magnum_users/sessions/coins) без Neon Auth.
 * + Ideas / Mining / WebSocket duel (2-4 игрока) — всё в Neon, без localStorage.
 */

import { neon } from "@neondatabase/serverless";

const MIMO_BASE = process.env.MIMO_BASE_URL || "https://token-plan-sgp.xiaomimimo.com/v1";
const MIMO_MODEL = process.env.MIMO_MODEL || "mimo-v2.5";

// ---- Neon ----
function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not configured");
  return neon(url);
}

// ---- Rate limit (in-memory token bucket) ----
const rateMap = new Map<string, number[]>();
function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = rateMap.get(key) ?? [];
  const fresh = arr.filter((t) => now - t < windowMs);
  if (fresh.length >= limit) {
    rateMap.set(key, fresh);
    return false;
  }
  fresh.push(now);
  rateMap.set(key, fresh);
  if (rateMap.size > 4000) {
    const toDel = Math.floor(rateMap.size * 0.2);
    let i = 0;
    for (const k of rateMap.keys()) {
      if (i++ >= toDel) break;
      rateMap.delete(k);
    }
  }
  return true;
}
function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}

// ---- Cookie / Token helpers ----
function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(name + "=")) return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const url = new URL(req.url);
  const qp = url.searchParams.get("token");
  if (qp) return qp;
  return getCookie(req, "magnum_token");
}

function cookieForToken(token: string, expiresAt: Date): string {
  return `magnum_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000; Expires=${expiresAt.toUTCString()}`;
}

function clearCookie(): string {
  return `magnum_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

async function getUserByToken(token: string): Promise<{ id: number; username: string } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.username FROM magnum_sessions s
    JOIN magnum_users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as { id: number; username: string };
  return { id: Number(r.id), username: String(r.username) };
}

// ---- Auth handlers ----
async function handleRegister(req: Request): Promise<Response> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`auth:register:${ip}`, 5, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || username.length < 3) return Response.json({ error: "username min 3 chars" }, { status: 400 });
  if (!password || password.length < 3) return Response.json({ error: "password min 3 chars" }, { status: 400 });
  if (username.length > 32) return Response.json({ error: "username too long" }, { status: 400 });

  const sql = getSql();
  const exists = await sql`SELECT id FROM magnum_users WHERE username = ${username} LIMIT 1`;
  if (exists.length > 0) return Response.json({ error: "username taken" }, { status: 409 });

  const hash = await Bun.password.hash(password);
  let userId: number;
  try {
    const inserted = await sql`INSERT INTO magnum_users (username, password_hash) VALUES (${username}, ${hash}) RETURNING id`;
    userId = Number((inserted[0] as { id: number }).id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) {
      return Response.json({ error: "username taken" }, { status: 409 });
    }
    console.error("[register] insert failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }

  try {
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${userId}, 1000) ON CONFLICT (user_id) DO NOTHING`;
  } catch (e) {
    console.error("[register] coins insert failed", e);
  }
  try {
    await sql`INSERT INTO magnum_mining (user_id, balance, upgrades) VALUES (${userId}, 0, '[]'::jsonb) ON CONFLICT (user_id) DO NOTHING`;
  } catch (e) { console.error("[register] mining insert failed", e); }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO magnum_sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresAt.toISOString()})`;

  return Response.json(
    { token, user: { id: userId, username } },
    { headers: { "Set-Cookie": cookieForToken(token, expiresAt) } }
  );
}

async function handleLogin(req: Request): Promise<Response> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`auth:login:${ip}`, 8, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return Response.json({ error: "username and password required" }, { status: 400 });

  const sql = getSql();
  const rows = await sql`SELECT id, username, password_hash FROM magnum_users WHERE username = ${username} LIMIT 1`;
  if (rows.length === 0) return Response.json({ error: "invalid credentials" }, { status: 401 });
  const row = rows[0] as { id: number; username: string; password_hash: string };
  const ok = await Bun.password.verify(password, row.password_hash);
  if (!ok) return Response.json({ error: "invalid credentials" }, { status: 401 });

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO magnum_sessions (token, user_id, expires_at) VALUES (${token}, ${Number(row.id)}, ${expiresAt.toISOString()})`;

  return Response.json(
    { token, user: { id: Number(row.id), username: row.username } },
    { headers: { "Set-Cookie": cookieForToken(token, expiresAt) } }
  );
}

async function handleMe(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const user = await getUserByToken(token);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json({ user });
  } catch (e) {
    console.error("[me] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleLogout(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (token) {
    try {
      const sql = getSql();
      await sql`DELETE FROM magnum_sessions WHERE token = ${token}`;
    } catch (e) {
      console.error("[logout] delete failed", e);
    }
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } });
}

// ---- Coins handlers (require auth) ----
async function handleCoinsGet(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const sql = getSql();
  const rows = await sql`SELECT balance FROM magnum_coins WHERE user_id = ${user.id} LIMIT 1`;
  if (rows.length === 0) {
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    return Response.json({ balance: 1000 });
  }
  return Response.json({ balance: Number((rows[0] as { balance: number }).balance) });
}

// ---- Coins leaderboard (top 20) ----
async function handleCoinsTop(): Promise<Response> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT u.username, c.balance, s.skin_id as avatar, COALESCE(f.verified,false) as verified FROM magnum_coins c JOIN magnum_users u ON u.id=c.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=c.user_id AND s.equipped=true LEFT JOIN magnum_frames f ON f.user_id=c.user_id ORDER BY c.balance DESC LIMIT 20`;
    const top = rows.map((r: unknown) => {
      const x = r as { username: string; balance: number; avatar: string | null; verified: boolean | null };
      return { username: String(x.username), balance: Number(x.balance), avatar: x.avatar || null, verified: Boolean(x.verified) };
    });
    return Response.json({ top, count: top.length });
  } catch (e) {
    console.error("[coins top] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleCoinsAdd(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`coins:add:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });

  let body: { amount?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) return Response.json({ error: "amount must be integer" }, { status: 400 });
  if (amount === 0) return Response.json({ error: "amount cannot be 0" }, { status: 400 });
  if (Math.abs(amount) > 10000) return Response.json({ error: "amount too large" }, { status: 400 });

  const sql = getSql();
  await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
  const updated = await sql`UPDATE magnum_coins SET balance = balance + ${amount} WHERE user_id = ${user.id} RETURNING balance`;
  const balance = Number((updated[0] as { balance: number }).balance);
  return Response.json({ balance });
}

// ---- Ideas handlers ----
async function handleIdeasGet(): Promise<Response> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT * FROM magnum_ideas ORDER BY votes DESC, id ASC`;
    return Response.json({ ideas: rows });
  } catch (e) {
    console.error("[ideas get] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleIdeasPost(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`ideas:post:${user.id}:${ip}`, 10, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });

  let body: { title?: string; description?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 300) : "";
  if (!title || title.length < 4) return Response.json({ error: "title min 4 chars" }, { status: 400 });

  try {
    const sql = getSql();
    const rows = await sql`INSERT INTO magnum_ideas (title, description, votes, status, user_id) VALUES (${title}, ${description}, 0, 'pending', ${user.id}) RETURNING *`;
    return Response.json({ idea: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("[ideas post] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Ideas vote with dedup (magnum_idea_votes) + anon fallback ----
async function handleIdeasVote(req: Request, idStr: string): Promise<Response> {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "invalid id" }, { status: 400 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`ideas:vote:${ip}:${id}`, 12, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  const token = extractToken(req);
  let authed: { id: number; username: string } | null = null;
  if (token) { try { authed = await getUserByToken(token); } catch (e) { console.error("[ideas vote] getUserByToken failed", e); } }
  try {
    const sql = getSql();
    // authed: dedup via magnum_idea_votes
    if (authed) {
      const ex = await sql`SELECT id FROM magnum_idea_votes WHERE user_id=${authed.id} AND idea_id=${id} LIMIT 1`;
      if (ex.length > 0) return Response.json({ error: "already voted", ideaId: id }, { status: 409 });
      const voted = await sql`INSERT INTO magnum_idea_votes (user_id, idea_id) VALUES (${authed.id}, ${id}) ON CONFLICT (user_id, idea_id) DO NOTHING RETURNING id`;
      if (voted.length === 0) return Response.json({ error: "already voted", ideaId: id }, { status: 409 });
      const rows = await sql`UPDATE magnum_ideas SET votes = COALESCE(votes,0) + 1 WHERE id = ${id} RETURNING *`;
      if (rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });
      // ledger: +1 coin for vote?
      return Response.json({ idea: rows[0], voted: true });
    }
    // P0 #4: anon vote blocked — requires auth to prevent IP-rotation farm (was anon votes+1 without dedup)
    if (!authed) return Response.json({ error: "unauthorized — войди чтобы голосовать" }, { status: 401 });
    // dead code removed: anon branch no longer allowed
  } catch (e) {
    console.error("[ideas vote] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Idea bookmarks (Neon magnum_idea_bookmarks) — закладки без localStorage ----
async function handleIdeaBookmark(req: Request, idStr: string): Promise<Response> {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "invalid id" }, { status: 400 });
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`idea:bookmark:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  try {
    const sql = getSql();
    const exists = await sql`SELECT id FROM magnum_ideas WHERE id=${id} LIMIT 1`;
    if (exists.length === 0) return Response.json({ error: "not found" }, { status: 404 });
    const already = await sql`SELECT id FROM magnum_idea_bookmarks WHERE user_id=${user.id} AND idea_id=${id} LIMIT 1`;
    if (already.length > 0) {
      await sql`DELETE FROM magnum_idea_bookmarks WHERE user_id=${user.id} AND idea_id=${id}`;
      return Response.json({ ok: true, bookmarked: false, ideaId: id });
    }
    await sql`INSERT INTO magnum_idea_bookmarks (user_id, idea_id) VALUES (${user.id}, ${id})`;
    return Response.json({ ok: true, bookmarked: true, ideaId: id });
  } catch (e) {
    console.error("[idea bookmark] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}
async function handleIdeaBookmarksGet(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT idea_id FROM magnum_idea_bookmarks WHERE user_id=${user.id} ORDER BY created_at DESC`;
    const ids = rows.map((r: unknown) => Number((r as { idea_id: number }).idea_id));
    return Response.json({ bookmarks: ids });
  } catch (e) {
    console.error("[bookmarks get] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Daily claim (streak 1-7, reward 42*streak) + ledger ----
async function handleDailyStatus(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT streak, claimed_at, reward FROM magnum_daily_claims WHERE user_id=${user.id} ORDER BY claimed_at DESC LIMIT 1`;
    if (rows.length === 0) return Response.json({ canClaim: true, streak: 0, nextReward: 42, lastClaim: null });
    const last = rows[0] as { streak: number; claimed_at: string; reward: number };
    const lastMs = new Date(last.claimed_at).getTime();
    const diffH = (Date.now() - lastMs) / 3600000;
    if (diffH < 20) {
      const waitMs = Math.ceil((20 * 3600000 - (Date.now() - lastMs)) / 1000) * 1000;
      return Response.json({ canClaim: false, streak: Number(last.streak), lastClaim: last.claimed_at, waitMs, nextReward: Math.min(7, Number(last.streak) + 1) * 42 });
    }
    const streakBroken = diffH > 44;
    const nextStreak = streakBroken ? 1 : Math.min(7, Number(last.streak) + 1);
    return Response.json({ canClaim: true, streak: Number(last.streak), lastClaim: last.claimed_at, nextStreak, nextReward: nextStreak * 42, streakBroken });
  } catch (e) { console.error("[daily status] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}

async function handleDailyClaim(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`daily:claim:${user.id}:${ip}`, 3, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT streak, claimed_at FROM magnum_daily_claims WHERE user_id=${user.id} ORDER BY claimed_at DESC LIMIT 1`;
    let nextStreak = 1;
    if (rows.length > 0) {
      const last = rows[0] as { streak: number; claimed_at: string };
      const diffH = (Date.now() - new Date(last.claimed_at).getTime()) / 3600000;
      if (diffH < 20) return Response.json({ error: "already claimed", waitH: (20 - diffH).toFixed(1) }, { status: 429 });
      nextStreak = diffH > 44 ? 1 : Math.min(7, Number(last.streak) + 1);
    }
    const reward = nextStreak * 42;
    await sql`INSERT INTO magnum_daily_claims (user_id, streak, reward) VALUES (${user.id}, ${nextStreak}, ${reward})`;
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    const upd = await sql`UPDATE magnum_coins SET balance = balance + ${reward} WHERE user_id=${user.id} RETURNING balance`;
    const bal = Number((upd[0] as { balance: number }).balance);
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${reward}, 'daily', ${JSON.stringify({ streak: nextStreak })}::jsonb)`;
    return Response.json({ ok: true, streak: nextStreak, reward, balance: bal });
  } catch (e) { console.error("[daily claim] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}

// ---- Transactions ledger ----
async function handleTransactions(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const rows = await sql`SELECT amount, reason, meta, created_at FROM magnum_transactions WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT ${limit}`;
    return Response.json({ transactions: rows.map((r: unknown) => { const x=r as {amount:number;reason:string;meta:unknown;created_at:string}; return { amount:Number(x.amount), reason:String(x.reason), meta:x.meta, created_at:x.created_at }; }), count: rows.length });
  } catch (e) { console.error("[transactions] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}

// ---- Coins transfer (user -> user, min 1, fee 0) ----
async function handleCoinsTransfer(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`coins:transfer:${user.id}:${ip}`, 10, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { to?: string; username?: string; amount?: number };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const toName = typeof body.to === "string" ? body.to.trim() : typeof body.username === "string" ? body.username.trim() : "";
  const amount = Number(body.amount);
  if (!toName || toName.length < 2) return Response.json({ error: "to username required" }, { status: 400 });
  if (!Number.isInteger(amount) || amount <= 0) return Response.json({ error: "amount must be positive integer" }, { status: 400 });
  if (amount > 5000) return Response.json({ error: "amount too large (max 5000)" }, { status: 400 });
  if (toName === user.username) return Response.json({ error: "cannot transfer to self" }, { status: 400 });
  try {
    const sql = getSql();
    const target = await sql`SELECT id FROM magnum_users WHERE username=${toName} LIMIT 1`;
    if (target.length === 0) return Response.json({ error: "recipient not found" }, { status: 404 });
    const toId = Number((target[0] as { id: number }).id);
    const coins = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    let bal = coins.length ? Number((coins[0] as { balance: number }).balance) : 1000;
    if (coins.length === 0) await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    if (bal < amount) return Response.json({ error: "not enough coins", balance: bal, required: amount }, { status: 402 });
    await sql`UPDATE magnum_coins SET balance = balance - ${amount} WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${toId}, 1000) ON CONFLICT (user_id) DO UPDATE SET balance = magnum_coins.balance + ${amount}`;
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${-amount}, 'transfer_out', ${JSON.stringify({ to: toName })}::jsonb)`;
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${toId}, ${amount}, 'transfer_in', ${JSON.stringify({ from: user.username })}::jsonb)`;
    const upd = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    return Response.json({ ok: true, balance: Number((upd[0] as { balance: number }).balance), sent: amount, to: toName });
  } catch (e) { console.error("[transfer] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}

// ---- Shop handlers (magnum_shop_inventory) ----
const SHOP_PRICES: Record<string, number> = {
  "skin-common": 42,
  "skin-rare": 142,
  "skin-epic": 420,
  "skin-legendary": 1420,
  "skin_42": 42,
  "skin_142": 142,
  "skin_420": 420,
  "skin_1420": 1420,
  "basic": 42,
  "rare": 142,
  "epic": 420,
  "legendary": 1420,
  "42": 42,
  "142": 142,
  "420": 420,
  "1420": 1420,
};

function getSkinPrice(skinId: string): number | null {
  if (SHOP_PRICES[skinId] != null) return SHOP_PRICES[skinId];
  // P0 #5: strict — no heuristic fallback (was substring 42/142/etc allowed price bypass 13-33% discount abuse)
  return null;
}

async function handleShopBuy(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`shop:buy:${user.id}:${ip}`, 15, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { skinId?: string; skin_id?: string; id?: string };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const skinId = typeof body.skinId === "string" ? body.skinId.trim() : typeof body.skin_id === "string" ? body.skin_id.trim() : typeof body.id === "string" ? body.id.trim() : "";
  if (!skinId) return Response.json({ error: "skinId required" }, { status: 400 });
  const price = getSkinPrice(skinId);
  if (price == null) return Response.json({ error: "unknown skin" }, { status: 400 });
  try {
    const sql = getSql();
    const exists = await sql`SELECT id FROM magnum_shop_inventory WHERE user_id = ${user.id} AND skin_id = ${skinId} LIMIT 1`;
    if (exists.length > 0) return Response.json({ error: "already owned", skinId }, { status: 409 });
    const coins = await sql`SELECT balance FROM magnum_coins WHERE user_id = ${user.id} LIMIT 1`;
    let balance = 0;
    if (coins.length === 0) {
      await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
      balance = 1000;
    } else {
      balance = Number((coins[0] as { balance: number }).balance);
    }
    if (balance < price) return Response.json({ error: "not enough coins", price, balance, required: price }, { status: 402 });
    await sql`UPDATE magnum_coins SET balance = balance - ${price} WHERE user_id = ${user.id}`;
    const updated = await sql`SELECT balance FROM magnum_coins WHERE user_id = ${user.id} LIMIT 1`;
    const newBalance = Number((updated[0] as { balance: number }).balance);
    await sql`INSERT INTO magnum_shop_inventory (user_id, skin_id, purchased_at, equipped) VALUES (${user.id}, ${skinId}, now(), false)`;
    return Response.json({ ok: true, skinId, price, balance: newBalance });
  } catch (e) {
    console.error("[shop buy] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleShopEquip(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { skinId?: string; skin_id?: string; id?: string };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const skinId = typeof body.skinId === "string" ? body.skinId.trim() : typeof body.skin_id === "string" ? body.skin_id.trim() : typeof body.id === "string" ? body.id.trim() : "";
  if (!skinId) {
    // empty → unequip
    try {
      const sql = getSql();
      await sql`UPDATE magnum_shop_inventory SET equipped = false WHERE user_id = ${user.id}`;
      return Response.json({ ok: true, equipped: null });
    } catch (e) {
      console.error("[shop equip unequip] failed", e);
      return Response.json({ error: "db error" }, { status: 500 });
    }
  }
  try {
    const sql = getSql();
    const owned = await sql`SELECT id FROM magnum_shop_inventory WHERE user_id = ${user.id} AND skin_id = ${skinId} LIMIT 1`;
    if (owned.length === 0) return Response.json({ error: "not owned", skinId }, { status: 404 });
    await sql`UPDATE magnum_shop_inventory SET equipped = false WHERE user_id = ${user.id}`;
    await sql`UPDATE magnum_shop_inventory SET equipped = true WHERE user_id = ${user.id} AND skin_id = ${skinId}`;
    const inv = await sql`SELECT skin_id, equipped, purchased_at FROM magnum_shop_inventory WHERE user_id = ${user.id} ORDER BY purchased_at ASC`;
    return Response.json({ ok: true, equipped: skinId, inventory: inv.map((r: unknown) => {
      const x = r as { skin_id: string; equipped: boolean; purchased_at: string };
      return { skinId: String(x.skin_id), skin_id: String(x.skin_id), equipped: Boolean(x.equipped), purchased_at: x.purchased_at };
    }) });
  } catch (e) {
    console.error("[shop equip] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleShopInventory(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT id, skin_id, equipped, purchased_at FROM magnum_shop_inventory WHERE user_id = ${user.id} ORDER BY purchased_at ASC`;
    const inventory = rows.map((r: unknown) => {
      const x = r as { id: number; skin_id: string; equipped: boolean; purchased_at: string };
      return { id: Number(x.id), skinId: String(x.skin_id), skin_id: String(x.skin_id), equipped: Boolean(x.equipped), purchased_at: x.purchased_at };
    });
    // also fetch coins and equipped single value for backward-compat with old client expecting {coins, equipped}
    const coinsRows = await sql`SELECT balance FROM magnum_coins WHERE user_id = ${user.id} LIMIT 1`;
    const coinsVal = coinsRows.length ? Number((coinsRows[0] as { balance: number }).balance) : 1000;
    const equippedItem = inventory.find(v => v.equipped);
    const equipped = equippedItem ? equippedItem.skinId : null;
    return Response.json({ inventory, items: inventory, coins: coinsVal, balance: coinsVal, equipped });
  } catch (e) {
    console.error("[shop inventory] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleShopState(req: Request): Promise<Response> {
  // alias to inventory+coins for legacy client: GET /shop/state → {inventory, equipped, coins}
  return handleShopInventory(req);
}

async function handleShopEquipped(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT skin_id FROM magnum_shop_inventory WHERE user_id = ${user.id} AND equipped = true LIMIT 1`;
    const equipped = rows.length ? String((rows[0] as { skin_id: string }).skin_id) : null;
    return Response.json({ equipped, skinId: equipped });
  } catch (e) {
    console.error("[shop equipped] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleShopUnequip(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    await sql`UPDATE magnum_shop_inventory SET equipped = false WHERE user_id = ${user.id}`;
    return Response.json({ ok: true, equipped: null });
  } catch (e) {
    console.error("[shop unequip] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Cosmetics shop (magnum_cosmetics) — 32 предмета: рамки/баннеры/титулы ----
export type CosmeticSlot = "frame" | "banner" | "title";
export type CosmeticItem = { id: string; slot: CosmeticSlot; name: string; price: number; rarity: "common"|"rare"|"epic"|"legendary"; style: string };
export const COSMETICS_CATALOG: CosmeticItem[] = [
  { id: "frame-neon42", slot: "frame", name: "Неон 42", price: 42, rarity: "common", style: "2px solid #ff44cc" },
  { id: "frame-gold", slot: "frame", name: "Золото 42", price: 142, rarity: "rare", style: "3px solid #ffcc00" },
  { id: "frame-rgb", slot: "frame", name: "RGB-пульс", price: 420, rarity: "epic", style: "3px solid #00ffcc" },
  { id: "frame-dragon", slot: "frame", name: "Драконьи когти", price: 1420, rarity: "legendary", style: "4px solid #ff2d55" },
  { id: "frame-ice", slot: "frame", name: "Лёд MAGNUM", price: 84, rarity: "common", style: "2px solid #7dd8ff" },
  { id: "frame-fire", slot: "frame", name: "Пламя", price: 184, rarity: "rare", style: "3px solid #ff6a00" },
  { id: "frame-toxic", slot: "frame", name: "Токсик", price: 390, rarity: "epic", style: "3px solid #7cff00" },
  { id: "frame-void", slot: "frame", name: "Войд", price: 1240, rarity: "legendary", style: "4px solid #7a1ecb" },
  { id: "frame-paper", slot: "frame", name: "Бумажный", price: 42, rarity: "common", style: "2px dashed #aaa" },
  { id: "frame-pixel", slot: "frame", name: "Пиксель 42", price: 142, rarity: "rare", style: "3px solid #5865f2" },
  { id: "frame-holo", slot: "frame", name: "Голо-рамка", price: 520, rarity: "epic", style: "3px solid #9147ff" },
  { id: "frame-crown", slot: "frame", name: "Корона", price: 2042, rarity: "legendary", style: "4px solid #ffd700" },
  { id: "banner-42wave", slot: "banner", name: "Волна 42", price: 42, rarity: "common", style: "linear-gradient(90deg,#ff44cc,#00ffcc)" },
  { id: "banner-magnum", slot: "banner", name: "MAGNUM fire", price: 142, rarity: "rare", style: "linear-gradient(90deg,#ff2d55,#ffcc00)" },
  { id: "banner-glitch", slot: "banner", name: "Глитч", price: 420, rarity: "epic", style: "linear-gradient(90deg,#5865f2,#9147ff)" },
  { id: "banner-voidstar", slot: "banner", name: "Звезда войда", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#0a0a0a,#7a1ecb 50%,#ff44cc)" },
  { id: "banner-ocean", slot: "banner", name: "Океан", price: 84, rarity: "common", style: "linear-gradient(90deg,#0c2e57,#2b7fd4)" },
  { id: "banner-sunset", slot: "banner", name: "Закат", price: 184, rarity: "rare", style: "linear-gradient(90deg,#ff7b00,#ff44cc)" },
  { id: "banner-forest", slot: "banner", name: "Лес 42", price: 390, rarity: "epic", style: "linear-gradient(90deg,#14401a,#8fe06a)" },
  { id: "banner-nebula", slot: "banner", name: "Туманность", price: 1240, rarity: "legendary", style: "linear-gradient(90deg,#1b0a3a,#ff2d55)" },
  { id: "banner-grid", slot: "banner", name: "Сетка", price: 62, rarity: "common", style: "linear-gradient(90deg,#2e3238,#b8bcc4)" },
  { id: "banner-tiger", slot: "banner", name: "Тигр", price: 520, rarity: "epic", style: "linear-gradient(90deg,#8a3c00,#ffd76a)" },
  { id: "title-bra", slot: "title", name: "Братуха", price: 42, rarity: "common", style: "#9aa4b2" },
  { id: "title-42", slot: "title", name: "42 навсегда", price: 142, rarity: "rare", style: "#5865f2" },
  { id: "title-magnum", slot: "title", name: "MAGNUM", price: 420, rarity: "epic", style: "#ff44cc" },
  { id: "title-legend", slot: "title", name: "Легенда", price: 2042, rarity: "legendary", style: "#ffcc00" },
  { id: "title-neon", slot: "title", name: "Неоновый", price: 84, rarity: "common", style: "#00ffcc" },
  { id: "title-hype", slot: "title", name: "Хайп", price: 184, rarity: "rare", style: "#9147ff" },
  { id: "title-toxic", slot: "title", name: "Токсичный", price: 390, rarity: "epic", style: "#7cff00" },
  { id: "title-vip", slot: "title", name: "VIP 42", price: 1240, rarity: "legendary", style: "#ff2d55" },
  { id: "title-noob", slot: "title", name: "Новичок", price: 22, rarity: "common", style: "#aaa" },
  { id: "title-god", slot: "title", name: "Бог 42", price: 4242, rarity: "legendary", style: "#ffd700" },
  // ── PRISM 42 — 12 неон-призм (aurora conic) ──
  { id: "frame-prism-rose", slot: "frame", name: "Призма Роза", price: 42, rarity: "common", style: "conic-gradient(from 0deg,#ff44cc,#ffcc00,#00ffcc,#5865f2,#ff44cc)" },
  { id: "frame-prism-ice", slot: "frame", name: "Призма Лёд", price: 142, rarity: "rare", style: "conic-gradient(from 45deg,#7dd8ff,#00ffcc,#9147ff,#7dd8ff)" },
  { id: "frame-prism-toxic", slot: "frame", name: "Призма Токсик", price: 420, rarity: "epic", style: "conic-gradient(from 90deg,#7cff00,#00ffcc,#ffcc00,#7cff00)" },
  { id: "frame-prism-void", slot: "frame", name: "Призма Войд", price: 1420, rarity: "legendary", style: "conic-gradient(from 180deg,#7a1ecb,#ff44cc,#0a0a0a,#7a1ecb)" },
  { id: "banner-prism-aurora", slot: "banner", name: "Аврора Призм", price: 84, rarity: "common", style: "linear-gradient(90deg,#00ffcc,#5865f2 35%,#ff44cc 70%,#ffcc00)" },
  { id: "banner-prism-neon", slot: "banner", name: "Неон Призм", price: 184, rarity: "rare", style: "linear-gradient(90deg,#ff44cc,#9147ff 40%,#00ffcc)" },
  { id: "banner-prism-sunset", slot: "banner", name: "Призм Закат", price: 390, rarity: "epic", style: "linear-gradient(90deg,#ff7b00,#ff44cc 40%,#7a1ecb)" },
  { id: "banner-prism-abyss", slot: "banner", name: "Призм Бездна", price: 1240, rarity: "legendary", style: "linear-gradient(90deg,#0a0a0a,#7a1ecb 30%,#ffcc00 70%,#ff44cc)" },
  { id: "title-prism-novice", slot: "title", name: "Призм Новичок", price: 22, rarity: "common", style: "#7dd8ff" },
  { id: "title-prism-hype", slot: "title", name: "Призм Хайп", price: 142, rarity: "rare", style: "#ff44cc" },
  { id: "title-prism-aurora", slot: "title", name: "Аврора", price: 420, rarity: "epic", style: "#9147ff" },
  { id: "title-prism-legend", slot: "title", name: "Призм Легенда", price: 2042, rarity: "legendary", style: "conic-gradient(from 0deg,#ffcc00,#ff44cc,#00ffcc,#ffcc00)" },
];
export const PRISM_IDS = new Set(COSMETICS_CATALOG.filter(c=>c.id.includes("prism")).map(c=>c.id));
export function isPrismCosmetic(id:string):boolean{ return PRISM_IDS.has(id); }
export const PRISM_CATALOG = COSMETICS_CATALOG.filter(c=>c.id.includes("prism"));
function getCosmeticPrice(id: string): number | null { return COSMETICS_CATALOG.find(c=>c.id===id)?.price ?? null; }
function getCosmeticSlot(id: string): CosmeticSlot | null { return COSMETICS_CATALOG.find(c=>c.id===id)?.slot ?? null; }
function validateCosmeticId(id: unknown): string | null { if(typeof id!=="string") return null; const sv=id.trim(); if(!sv||sv.length<2||sv.length>64||!/^[a-z0-9-]{2,64}$/.test(sv)) return null; if(sv.startsWith("-")||sv.endsWith("-")||sv.includes("--")) return null; return sv; }
async function handleCosmeticCatalog(): Promise<Response> { return Response.json({ catalog: COSMETICS_CATALOG, count: COSMETICS_CATALOG.length }); }
async function handleCosmeticInventory(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  try{ const sql=getSql(); const rows=await sql`SELECT id, cosmetic_id, slot, equipped, purchased_at FROM magnum_cosmetics WHERE user_id=${user.id} ORDER BY purchased_at ASC`;
    const inv=rows.map((r:unknown)=>{ const x=r as {id:number;cosmetic_id:string;slot:string;equipped:boolean;purchased_at:string}; return {id:Number(x.id),cosmeticId:String(x.cosmetic_id),cosmetic_id:String(x.cosmetic_id),slot:String(x.slot),equipped:Boolean(x.equipped),purchased_at:x.purchased_at};});
    return Response.json({inventory:inv,items:inv}); }catch(e){ console.error("[cosmetic inv] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleCosmeticBuy(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  let body:{cosmeticId?:string;id?:string}; try{body=(await req.json()) as typeof body;}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=validateCosmeticId(body.cosmeticId ?? body.id ?? ""); if(!raw) return Response.json({error:"cosmeticId required"},{status:400});
  const price=getCosmeticPrice(raw); if(price==null) return Response.json({error:"unknown cosmetic",cosmeticId:raw},{status:400});
  const slot=getCosmeticSlot(raw)!;
  try{ const sql=getSql();
    const ex=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
    if(ex.length>0) return Response.json({error:"already owned",cosmeticId:raw},{status:409});
    const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    let bal=0; if(coins.length===0){ await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`; bal=1000; } else bal=Number((coins[0] as {balance:number}).balance);
    if(bal<price) return Response.json({error:"not enough coins",price,balance:bal,required:price},{status:402});
    await sql`UPDATE magnum_coins SET balance=balance-${price} WHERE user_id=${user.id}`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const newBal=Number((upd[0] as {balance:number}).balance);
    await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${raw},${slot},false,now())`;
    return Response.json({ok:true,cosmeticId:raw,slot,price,balance:newBal});
  }catch(e){ console.error("[cosmetic buy] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleCosmeticEquip(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  let body:{cosmeticId?:string;id?:string}; try{body=(await req.json()) as typeof body;}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=validateCosmeticId(body.cosmeticId ?? body.id ?? ""); if(!raw) return Response.json({error:"cosmeticId required"},{status:400});
  try{ const sql=getSql();
    const owned=await sql`SELECT slot FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
    if(owned.length===0) return Response.json({error:"not owned",cosmeticId:raw},{status:404});
    const slot=String((owned[0] as {slot:string}).slot);
    await sql`UPDATE magnum_cosmetics SET equipped=false WHERE user_id=${user.id} AND slot=${slot}`;
    await sql`UPDATE magnum_cosmetics SET equipped=true WHERE user_id=${user.id} AND cosmetic_id=${raw}`;
    const rows=await sql`SELECT cosmetic_id,slot,equipped FROM magnum_cosmetics WHERE user_id=${user.id} ORDER BY purchased_at ASC`;
    return Response.json({ok:true,equipped:raw,slot,inventory:rows.map((r:unknown)=>{ const x=r as {cosmetic_id:string;slot:string;equipped:boolean}; return {cosmeticId:x.cosmetic_id,slot:x.slot,equipped:x.equipped};})});
  }catch(e){ console.error("[cosmetic equip] failed",e); return Response.json({error:"db error"},{status:500}); }
}

// ---- PRISM 42 — dust / dismantle / craft + /shop/prism & /shop/dust ----
async function ensureDustTable():Promise<void>{
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_dust (user_id integer primary key references magnum_users(id) on delete cascade, balance integer not null default 0, updated_at timestamp default now())`;
}
function prismDismantleReward(rarity:CosmeticItem["rarity"]):number{
  if(rarity==="legendary") return 420;
  if(rarity==="epic") return 142;
  if(rarity==="rare") return 42;
  return 14;
}
async function handlePrismCatalog():Promise<Response>{ return Response.json({ catalog: PRISM_CATALOG, count: PRISM_CATALOG.length, dustCosts: { common:42, rare:142, epic:420, legendary:1420 } }); }
async function handleDustGet(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  await ensureDustTable();
  const sql=getSql();
  const rows=await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
  const bal=rows.length? Number((rows[0] as {balance:number}).balance):0;
  return Response.json({ balance: bal, dust: bal });
}
async function handleDismantle(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`shop:dismantle:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{cosmeticId?:string;id?:string}; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=validateCosmeticId(body.cosmeticId??body.id??""); if(!raw) return Response.json({error:"cosmeticId required"},{status:400});
  const item=COSMETICS_CATALOG.find(c=>c.id===raw); if(!item) return Response.json({error:"unknown cosmetic",cosmeticId:raw},{status:400});
  await ensureDustTable();
  const sql=getSql();
  const owned=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
  if(owned.length===0) return Response.json({error:"not owned",cosmeticId:raw},{status:404});
  const reward=prismDismantleReward(item.rarity);
  await sql`DELETE FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw}`;
  await sql`INSERT INTO magnum_dust (user_id,balance) VALUES (${user.id},${reward}) ON CONFLICT (user_id) DO UPDATE SET balance=magnum_dust.balance+${reward}, updated_at=now()`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${reward},'dismantle',${JSON.stringify({cosmeticId:raw,reward})}::jsonb)`;
  const r=await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, dismantled:raw, reward, dust:Number((r[0] as {balance:number}).balance) });
}
async function handlePrismCraft(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`shop:craft:${user.id}:${ip}`,8,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{cosmeticId?:string;id?:string}; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=validateCosmeticId(body.cosmeticId??body.id??""); if(!raw) return Response.json({error:"cosmeticId required"},{status:400});
  const item=COSMETICS_CATALOG.find(c=>c.id===raw); if(!item) return Response.json({error:"unknown cosmetic",cosmeticId:raw},{status:400});
  if(!isPrismCosmetic(raw)) return Response.json({error:"only prism craft allowed",cosmeticId:raw},{status:400});
  await ensureDustTable();
  const sql=getSql();
  const ex=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
  if(ex.length>0) return Response.json({error:"already owned",cosmeticId:raw},{status:409});
  const cost=item.price;
  const drows=await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
  const dustBal=drows.length? Number((drows[0] as {balance:number}).balance):0;
  if(dustBal<cost) return Response.json({error:"not enough dust",cost,dust:dustBal,required:cost},{status:402});
  await sql`UPDATE magnum_dust SET balance=balance-${cost}, updated_at=now() WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${raw},${item.slot},false,now())`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-cost},'prism_craft',${JSON.stringify({cosmeticId:raw,cost})}::jsonb)`;
  const nr=await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, crafted:raw, slot:item.slot, cost, dust:Number((nr[0] as {balance:number}).balance) });
}

// ---- Shop Bundles — 8 наборов со скидкой 10-18% vs сумма ---- 
export type ShopBundle = { id:string; name:string; desc:string; emoji:string; items:string[]; slots:string[]; price:number; origPrice:number; rarity:"rare"|"epic"|"legendary"; tag:string };
export const SHOP_BUNDLES: ShopBundle[] = [
  { id:"bundle-starter",  name:"Старт 42",        desc:"Мопс + Неон-рамка + Братуха титул", emoji:"🎒", items:["mops","frame-neon42","title-bra"], slots:["skin","frame","title"], price:84,  origPrice:126, rarity:"rare", tag:"−33%" },
  { id:"bundle-neon",     name:"Неон-вайб",       desc:"Фламинго + RGB-пульс + Неоновый", emoji:"🌃", items:["flamingo","frame-rgb","title-neon"], slots:["skin","frame","title"], price:520, origPrice:624, rarity:"epic", tag:"−17%" },
  { id:"bundle-ice",      name:"Лёд и Пламя",     desc:"Панда + Лёд + Пламя + Хайп", emoji:"❄️", items:["panda","frame-ice","frame-fire","title-hype"], slots:["skin","frame","frame","title"], price:380, origPrice:452, rarity:"epic", tag:"−16%" },
  { id:"bundle-hunter",   name:"Охотник 42",      desc:"Волк + Форест-баннер + Токсичный", emoji:"🐺", items:["wolf","banner-forest","title-toxic"], slots:["skin","banner","title"], price:740, origPrice:860, rarity:"epic", tag:"−14%" },
  { id:"bundle-tiger",    name:"Тигр-легенда",    desc:"Тигр + Корона + Легенда + Грид", emoji:"🐯", items:["tiger","frame-crown","title-legend","banner-grid"], slots:["skin","frame","title","banner"], price:3100, origPrice:3586, rarity:"legendary", tag:"−14%" },
  { id:"bundle-dragon",   name:"Дракон MAGNUM",   desc:"Дракон + Драконьи когти + Бог 42", emoji:"🐉", items:["dragon","frame-dragon","title-god"], slots:["skin","frame","title"], price:5200, origPrice:6082, rarity:"legendary", tag:"−15%" },
  { id:"bundle-void",     name:"Войд-сет",        desc:"Войд-рамка + Туманность + VIP", emoji:"🕳️", items:["frame-void","banner-nebula","title-vip"], slots:["frame","banner","title"], price:2800, origPrice:3220, rarity:"legendary", tag:"−13%" },
  { id:"bundle-full42",   name:"FULL 42",         desc:"6 хитов: Лиса/Сова/Акула + Голо/Holo + MAGNUM", emoji:"💎", items:["fox","owl","shark","frame-holo","banner-magnum","title-magnum"], slots:["skin","skin","skin","frame","banner","title"], price:980, origPrice:1168, rarity:"epic", tag:"−16%" },
];
export function isValidBundleId(v:unknown):string|null{ if(typeof v!=="string")return null; const s=v.trim(); if(!s||s.length<2||s.length>40||!/^[a-z0-9-]{2,40}$/.test(s))return null; if(s.startsWith("-")||s.endsWith("-")||s.includes("--"))return null; // P0 #5 sync with ShopPage.tsx:114 — min 2, no 1-char degenerate keys
 return s; }
export function getBundleById(id:string):ShopBundle|null{ return SHOP_BUNDLES.find(b=>b.id===id)??null; }
async function handleShopBundleCatalog():Promise<Response>{ return Response.json({bundles:SHOP_BUNDLES,count:SHOP_BUNDLES.length}); }
async function handleShopBundleBuy(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`shop:bundle:${user.id}:${ip}`,10,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{bundleId?:string;id?:string}; try{body=(await req.json()) as typeof body;}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=isValidBundleId(body.bundleId??body.id??""); if(!raw) return Response.json({error:"bundleId required"},{status:400});
  const bundle=getBundleById(raw); if(!bundle) return Response.json({error:"unknown bundle",bundleId:raw},{status:400});
  try{
    const sql=getSql();
    const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    let bal=0; if(coins.length===0){ await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`; bal=1000; } else bal=Number((coins[0] as {balance:number}).balance);
    if(bal<bundle.price) return Response.json({error:"not enough coins",price:bundle.price,balance:bal,required:bundle.price},{status:402});
    // check already owned items — allow partial (skip owned), but price stays same (bundle discount incentive)
    await sql`UPDATE magnum_coins SET balance=balance-${bundle.price} WHERE user_id=${user.id}`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const newBal=Number((upd[0] as {balance:number}).balance);
    let granted: string[]=[]; let skipped: string[]=[];
    for(let i=0;i<bundle.items.length;i++){
      const itemId=bundle.items[i]!; const slot=bundle.slots[i]!;
      if(slot==="skin"){
        const ex=await sql`SELECT id FROM magnum_shop_inventory WHERE user_id=${user.id} AND skin_id=${itemId} LIMIT 1`;
        if(ex.length>0){ skipped.push(itemId); continue; }
        await sql`INSERT INTO magnum_shop_inventory (user_id,skin_id,purchased_at,equipped) VALUES (${user.id},${itemId},now(),false)`;
        granted.push(itemId);
      } else {
        const ex=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${itemId} LIMIT 1`;
        if(ex.length>0){ skipped.push(itemId); continue; }
        await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${itemId},${slot},false,now())`;
        granted.push(itemId);
      }
    }
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-bundle.price},'shop_bundle',${JSON.stringify({bundleId:bundle.id,price:bundle.price,granted,skipped})}::jsonb)`;
    return Response.json({ok:true,bundleId:bundle.id,price:bundle.price,balance:newBal,granted,skipped,alreadyOwned:skipped});
  }catch(e){ console.error("[bundle buy] failed",e); return Response.json({error:"db error"},{status:500}); }
}

// ---- Frame handlers (magnum_frames) ----
async function handleFrameVerify(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`frame:verify:${user.id}:${ip}`, 8, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { verified?: boolean };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const verified = Boolean(body.verified);
  try {
    const sql = getSql();
    const rows = await sql`INSERT INTO magnum_frames (user_id, verified, created_at) VALUES (${user.id}, ${verified}, now()) RETURNING *`;
    return Response.json({ ok: true, frame: rows[0], verified });
  } catch (e) {
    console.error("[frame verify] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleFrameStatus(req: Request): Promise<Response> {
  try {
    const sql = getSql();
    const token = extractToken(req);
    let user: { id: number; username: string } | null = null;
    if (token) { try { user = await getUserByToken(token); } catch (e) { console.error("[frame status] getUserByToken failed", e); } }
    if (user) {
      const rows = await sql`SELECT f.id, u.username, f.verified, f.created_at, s.skin_id as avatar FROM magnum_frames f LEFT JOIN magnum_users u ON u.id = f.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id = f.user_id AND s.equipped = true WHERE f.user_id = ${user.id} ORDER BY f.created_at DESC LIMIT 50`;
      const frames = rows.map((r: unknown) => {
        const x = r as { id: number; username: string; verified: boolean | null; created_at: string; avatar: string | null };
        return { id: Number(x.id), username: String(x.username || user!.username), verified: Boolean(x.verified), status: x.verified ? "verified" : "pending", created_at: x.created_at, avatar: x.avatar || null };
      });
      const verified = frames.filter(f => f.verified).length;
      return Response.json({ frames, total: frames.length, verified, pending: frames.length - verified, user: user.username });
    }
    const rows = await sql`SELECT f.id, COALESCE(u.username, 'Братуха') as username, f.verified, f.created_at, f.user_id as raw_user_id, s.skin_id as avatar FROM magnum_frames f LEFT JOIN magnum_users u ON u.id = f.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id = f.user_id AND s.equipped = true ORDER BY f.created_at DESC LIMIT 50`;
    const total = rows.length;
    const verified = rows.filter((r: unknown) => (r as { verified: boolean }).verified === true).length;
    const frames = rows.map((r: unknown) => {
      const x = r as { id: number; username: string; verified: boolean | null; created_at: string; raw_user_id: number; avatar: string | null };
      return { id: Number(x.id), username: String(x.username || "Братуха"), verified: Boolean(x.verified), status: x.verified ? "verified" : "pending", created_at: x.created_at, avatar: x.avatar || null };
    });
    return Response.json({ frames, total, verified, pending: total - verified });
  } catch (e) {
    console.error("[frame status] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Eco handlers (magnum_eco_results) ----
async function handleEcoLeaderboard(): Promise<Response> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT COALESCE(u.username, r.player, 'Братуха') as player, r.score, r.rank, r.created_at, s.skin_id as avatar, COALESCE(f.verified,false) as verified FROM magnum_eco_results r LEFT JOIN magnum_users u ON u.id = r.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id = r.user_id AND s.equipped = true LEFT JOIN magnum_frames f ON f.user_id = r.user_id ORDER BY r.score DESC, r.created_at ASC LIMIT 50`;
    const leaderboard = rows.map((r: unknown) => {
      const x = r as { player: string; score: number; rank: string; created_at: string; avatar: string | null; verified: boolean | null };
      return { player: String(x.player), username: String(x.player), score: Number(x.score), rank: String(x.rank), status: String(x.rank || "pending"), created_at: x.created_at, avatar: x.avatar || null, verified: Boolean(x.verified) };
    });
    return Response.json({ leaderboard, entries: leaderboard });
  } catch (e) {
    console.error("[eco leaderboard] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleEcoSubmit(req: Request): Promise<Response> {
  const token = extractToken(req);
  let authedUser: { id: number; username: string } | null = null;
  if (token) { try { authedUser = await getUserByToken(token); } catch (e) { console.error("[eco submit] getUserByToken failed", e); } }
  let body: { player?: string; name?: string; username?: string; score?: number; rank?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const score = Number(body.score);
  const rank = typeof body.rank === "string" ? body.rank.trim().slice(0, 32) : "pending";
  if (!Number.isFinite(score)) return Response.json({ error: "score required" }, { status: 400 });
  // if auth required and no user, allow anonymous with player field but prefer auth
  if (authedUser) {
    try {
      const sql = getSql();
      const rows = await sql`INSERT INTO magnum_eco_results (user_id, player, score, rank) VALUES (${authedUser.id}, ${authedUser.username}, ${Math.round(score)}, ${rank}) RETURNING *`;
      return Response.json({ ok: true, entry: rows[0] }, { status: 201 });
    } catch (e) {
      console.error("[eco submit auth] failed", e);
      return Response.json({ error: "db error" }, { status: 500 });
    }
  }
  // no anonymous — leaderboard only for authed users (no fake players)
  return Response.json({ error: "unauthorized — войди, братуха" }, { status: 401 });
}

// ---- Eco Rating 0-10 (magnum_eco_ratings) ----
export type EcoTier = { rating: number; tier: string; minScore: number; maxScore: number; color: string; badge: string; desc: string };
export const ECO_TIERS: EcoTier[] = [
  { rating: 0, tier: "Токсик", minScore: -1000, maxScore: -400, color: "#ff1a1a", badge: "☠️", desc: "Томь плачет" },
  { rating: 1, tier: "Дымный", minScore: -399, maxScore: -250, color: "#ff3b30", badge: "🏭", desc: "Коптим Кузбасс" },
  { rating: 2, tier: "Пассажир", minScore: -249, maxScore: -100, color: "#ff6a00", badge: "🚌", desc: "Крузак бати" },
  { rating: 3, tier: "Нормис", minScore: -99, maxScore: 0, color: "#8a8a8a", badge: "😐", desc: "Батилки впереди" },
  { rating: 4, tier: "Стажёр", minScore: 1, maxScore: 50, color: "#6aa84f", badge: "🌱", desc: "Первые ростки" },
  { rating: 5, tier: "Братуха", minScore: 51, maxScore: 110, color: "#00c951", badge: "🤝", desc: "Крепкий братуха" },
  { rating: 6, tier: "Эко-воин", minScore: 111, maxScore: 170, color: "#00d4a0", badge: "🛡️", desc: "Чистишь Томь" },
  { rating: 7, tier: "Хранитель Томи", minScore: 171, maxScore: 230, color: "#00b8ff", badge: "🌊", desc: "Томь чище" },
  { rating: 8, tier: "Легенда бора", minScore: 231, maxScore: 290, color: "#7c3aed", badge: "🌲", desc: "Бор гордится" },
  { rating: 9, tier: "ЭкоЛегенда", minScore: 291, maxScore: 336, color: "#ff2d55", badge: "🌿👑", desc: "Дух Кузбасса" },
  { rating: 10, tier: "42 Абсолют", minScore: 337, maxScore: 1000, color: "#ffd700", badge: "💎42", desc: "42/42 сияние" },
];
export const ECO_RATING_LABELS: string[] = ECO_TIERS.map(t => `${t.rating} — ${t.tier}`);
export function calcEcoRating(score: number): EcoTier { const s=Math.round(score); for(const t of ECO_TIERS) if(s>=t.minScore&&s<=t.maxScore) return t; return s<0?ECO_TIERS[0]!:ECO_TIERS[ECO_TIERS.length-1]!; }
function validateEcoScore(v: unknown): number | null { const n=Number(v); if(!Number.isFinite(n)) return null; const r=Math.round(n); if(r<-1000||r>1000) return null; return r; }
function validateEcoAnswers(v: unknown): number[] | null { if(!Array.isArray(v)||v.length>20) return null; const o:number[]=[]; for(const x of v){const n=Number(x); if(!Number.isInteger(n)||n<0||n>10) return null; o.push(n);} return o; }
async function handleEcoTiers(): Promise<Response> { return Response.json({ tiers: ECO_TIERS, labels: ECO_RATING_LABELS, count: ECO_TIERS.length }); }
async function handleEcoRatingSubmit(req: Request): Promise<Response> {
  const token=extractToken(req); let user:{id:number;username:string}|null=null; if(token) try{user=await getUserByToken(token);}catch{}
  let body:{score?:unknown;answers?:unknown;player?:unknown}; try{body=(await req.json()) as typeof body;}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const score=validateEcoScore(body.score); if(score===null) return Response.json({error:"score -1000..1000"},{status:400});
  const answers=body.answers!==undefined?validateEcoAnswers(body.answers):[]; if(body.answers!==undefined&&answers===null) return Response.json({error:"answers 0..10 max20"},{status:400});
  const tier=calcEcoRating(score); const player=user?.username??(typeof body.player==="string"?body.player.trim().slice(0,32):null);
  if(!user&&(!player||player.length<2)) return Response.json({error:"player 2..32 or auth"},{status:400});
  const ip=getClientIp(req); if(!checkRateLimit(`eco:rating:${user?.id??ip}`,10,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{ const sql=getSql();
    await sql`CREATE TABLE IF NOT EXISTS magnum_eco_ratings (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE SET NULL, player text, score integer NOT NULL, rating integer NOT NULL, tier text NOT NULL, answers jsonb DEFAULT '[]'::jsonb NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const rows=await sql`INSERT INTO magnum_eco_ratings (user_id,player,score,rating,tier,answers) VALUES (${user?.id??null},${player},${score},${tier.rating},${tier.tier},${JSON.stringify(answers??[])}::jsonb) RETURNING id,score,rating,tier,created_at`;
    let coinsBonus=0; if(user&&tier.rating>=7){ coinsBonus=tier.rating===10?142:tier.rating>=9?84:42;
      await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
      await sql`UPDATE magnum_coins SET balance=balance+${coinsBonus} WHERE user_id=${user.id}`;
      await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${coinsBonus},'eco_rating',${JSON.stringify({rating:tier.rating,tier:tier.tier,score})}::jsonb)`; }
    return Response.json({ok:true,entry:rows[0],tier,coinsBonus},{status:201});
  }catch(e){console.error("[eco rating submit] failed",e); return Response.json({error:"db error"},{status:500});}
}
async function handleEcoRatingTop(): Promise<Response> {
  try{ const sql=getSql();
    await sql`CREATE TABLE IF NOT EXISTS magnum_eco_ratings (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE SET NULL, player text, score integer NOT NULL, rating integer NOT NULL, tier text NOT NULL, answers jsonb DEFAULT '[]'::jsonb NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const rows=await sql`SELECT COALESCE(u.username,r.player,'Братуха') as player,r.score,r.rating,r.tier,r.created_at,s.skin_id as avatar FROM magnum_eco_ratings r LEFT JOIN magnum_users u ON u.id=r.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=r.user_id AND s.equipped=true ORDER BY r.rating DESC,r.score DESC,r.created_at ASC LIMIT 30`;
    const top=rows.map((x:unknown)=>{const r=x as {player:string;score:number;rating:number;tier:string;created_at:string;avatar:string|null}; return {player:String(r.player),username:String(r.player),score:Number(r.score),rating:Number(r.rating),tier:String(r.tier),created_at:r.created_at,avatar:r.avatar};});
    return Response.json({top,count:top.length,tiers:ECO_TIERS});
  }catch(e){console.error("[eco rating top] failed",e); return Response.json({error:"db error"},{status:500});}
}

// ---- Mining handlers ----
const UPGRADES_DEF: Record<string, { baseCost: number; power: number; auto: number }> = {
  shovel: { baseCost: 42, power: 1, auto: 0 },
  pick: { baseCost: 142, power: 3, auto: 0 },
  drill: { baseCost: 420, power: 0, auto: 1 },
  truck: { baseCost: 1042, power: 0, auto: 5 },
  shaft: { baseCost: 2042, power: 5, auto: 12 },
};

function costOf(baseCost: number, count: number): number {
  return Math.floor(baseCost * Math.pow(1.42, count));
}

type MiningUpgrades = Array<{ id: string; count: number }>;

function parseUpgrades(raw: unknown): MiningUpgrades {
  if (!Array.isArray(raw)) return [];
  const out: MiningUpgrades = [];
  for (const x of raw as unknown[]) {
    if (x && typeof x === "object" && "id" in (x as Record<string, unknown>)) {
      const id = String((x as Record<string, unknown>).id);
      const count = Number((x as Record<string, unknown>).count);
      if (UPGRADES_DEF[id] && Number.isFinite(count) && count >= 0) out.push({ id, count: Math.floor(count) });
    }
  }
  return out;
}

function perClickFrom(upgrades: MiningUpgrades): number {
  let v = 1;
  for (const u of upgrades) {
    const def = UPGRADES_DEF[u.id];
    if (def) v += def.power * u.count;
  }
  return v;
}

async function ensureMiningRow(userId: number) {
  const sql = getSql();
  const rows = await sql`SELECT user_id, balance, upgrades FROM magnum_mining WHERE user_id = ${userId} LIMIT 1`;
  if (rows.length > 0) {
    const r = rows[0] as { user_id: number; balance: number; upgrades: unknown };
    return { balance: Number(r.balance), upgrades: parseUpgrades(r.upgrades) };
  }
  await sql`INSERT INTO magnum_mining (user_id, balance, upgrades) VALUES (${userId}, 0, '[]'::jsonb) ON CONFLICT (user_id) DO NOTHING`;
  return { balance: 0, upgrades: [] as MiningUpgrades };
}

async function handleMiningGet(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await ensureMiningRow(user.id);
    const perClick = perClickFrom(data.upgrades);
    const perSec = data.upgrades.reduce((s, u) => s + (UPGRADES_DEF[u.id]?.auto ?? 0) * u.count, 0);
    const boostUntil = miningBoostUntil.get(user.id) ?? 0;
    const boosted = Date.now() < boostUntil;
    return Response.json({ balance: data.balance, upgrades: data.upgrades, perClick, perSec, boost: { active: boosted, until: boosted ? boostUntil : null, remainingMs: boosted ? boostUntil - Date.now() : 0, price: MINING_BOOST_PRICE, durationMs: MINING_BOOST_MS } });
  } catch (e) {
    console.error("[mining get] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleMiningClick(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`mining:click:${user.id}:${ip}`, 120, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  try {
    const data = await ensureMiningRow(user.id);
    let inc = perClickFrom(data.upgrades);
    const boostUntil = miningBoostUntil.get(user.id) ?? 0;
    const boosted = Date.now() < boostUntil;
    if (boosted) inc = inc * 2;
    const sql = getSql();
    const rows = await sql`UPDATE magnum_mining SET balance = balance + ${inc}, updated_at = now() WHERE user_id = ${user.id} RETURNING balance, upgrades`;
    const r = rows[0] as { balance: number; upgrades: unknown };
    return Response.json({ balance: Number(r.balance), upgrades: parseUpgrades(r.upgrades), added: inc, boosted, boostUntil: boosted ? boostUntil : null });
  } catch (e) {
    console.error("[mining click] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleMiningUpgrade(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const def = UPGRADES_DEF[id];
  if (!def) return Response.json({ error: "unknown upgrade id" }, { status: 400 });
  try {
    const data = await ensureMiningRow(user.id);
    const cur = data.upgrades.find((u) => u.id === id)?.count ?? 0;
    const price = costOf(def.baseCost, cur);
    if (data.balance < price) return Response.json({ error: "not enough coins", price, balance: data.balance }, { status: 402 });

    // build new upgrades array
    const next: MiningUpgrades = [...data.upgrades.filter((u) => u.id !== id), { id, count: cur + 1 }];
    const nextJson = JSON.stringify(next);
    const sql = getSql();
    const rows = await sql`UPDATE magnum_mining SET balance = balance - ${price}, upgrades = ${nextJson}::jsonb, updated_at = now() WHERE user_id = ${user.id} RETURNING balance, upgrades`;
    const r = rows[0] as { balance: number; upgrades: unknown };
    return Response.json({ balance: Number(r.balance), upgrades: parseUpgrades(r.upgrades), price });
  } catch (e) {
    console.error("[mining upgrade] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Mining collect (offline/idle accrual, cap 6h) ----
async function handleMiningCollect(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`mining:collect:${user.id}:${ip}`, 12, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT balance, upgrades, updated_at FROM magnum_mining WHERE user_id = ${user.id} LIMIT 1`;
    if (rows.length === 0) return Response.json({ error: "no mining row" }, { status: 404 });
    const r = rows[0] as { balance: number; upgrades: unknown; updated_at: string };
    const upgrades = parseUpgrades(r.upgrades);
    const perSec = upgrades.reduce((s, u) => s + (UPGRADES_DEF[u.id]?.auto ?? 0) * u.count, 0);
    if (perSec <= 0) return Response.json({ balance: Number(r.balance), upgrades, perSec, collected: 0, idleSec: 0 });
    const last = r.updated_at ? new Date(r.updated_at).getTime() : Date.now();
    const elapsedSec = Math.max(0, Math.floor((Date.now() - last) / 1000));
    const cappedSec = Math.min(elapsedSec, 6 * 3600);
    if (cappedSec < 5) return Response.json({ balance: Number(r.balance), upgrades, perSec, collected: 0, idleSec: cappedSec });
    const collected = perSec * cappedSec;
    const updated = await sql`UPDATE magnum_mining SET balance = balance + ${collected}, updated_at = now() WHERE user_id = ${user.id} RETURNING balance, updated_at`;
    const nb = Number((updated[0] as { balance: number }).balance);
    return Response.json({ balance: nb, upgrades, perSec, collected, idleSec: cappedSec });
  } catch (e) {
    console.error("[mining collect] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Mining Vault — лимитированные дропы за 42-коины (Neon magnun_mining_vault) ----
type VaultItem = { id: string; name: string; price: number; reward: number; rarity: "common"|"rare"|"epic"|"legendary"; icon: string; limit: number };
const MINING_VAULT_CATALOG: VaultItem[] = [
  { id: "vault-coal", name: "Ящик угля", price: 420, reward: 142, rarity: "common", icon: "🪨", limit: 99 },
  { id: "vault-ore", name: "Рудный кейс", price: 840, reward: 420, rarity: "rare", icon: "⛏️", limit: 42 },
  { id: "vault-gold", name: "Золотой слиток 42", price: 1420, reward: 840, rarity: "epic", icon: "🏆", limit: 14 },
  { id: "vault-diamond", name: "Алмаз Кузбасса", price: 2042, reward: 1420, rarity: "legendary", icon: "💎", limit: 4 },
  { id: "vault-belaz", name: "БЕЛАЗ-контейнер", price: 3200, reward: 2042, rarity: "legendary", icon: "🚚", limit: 2 },
];
function validateVaultId(v: string): string | null { const s=v.trim().toLowerCase(); return MINING_VAULT_CATALOG.some(x=>x.id===s)?s:null; }
async function handleMiningVaultGet(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({ error:"unauthorized" },{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({ error:"unauthorized" },{status:401});
  try { const sql=getSql(); const rows=await sql`SELECT vault_id FROM magnum_mining_vault WHERE user_id=${user.id}`; const claimed=new Set(rows.map((r:unknown)=>(r as {vault_id:string}).vault_id)); const catalog=MINING_VAULT_CATALOG.map(v=>({...v, claimed:claimed.has(v.id)})); return Response.json({ catalog, claimed:[...claimed] }); } catch(e){ console.error("[vault get] failed",e); return Response.json({ error:"db error" },{status:500}); }
}
async function handleMiningVaultClaim(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({ error:"unauthorized" },{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({ error:"unauthorized" },{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`vault:${user.id}:${ip}`,8,60_000)) return Response.json({ error:"rate limited" },{status:429});
  let body:{vaultId?:string;id?:string}; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({ error:"Invalid JSON" },{status:400});}
  const raw=validateVaultId(String(body.vaultId??body.id??"")); if(!raw) return Response.json({ error:"unknown vault" },{status:400});
  const item=MINING_VAULT_CATALOG.find(x=>x.id===raw)!;
  try {
    const sql=getSql();
    const exists=await sql`SELECT id FROM magnum_mining_vault WHERE user_id=${user.id} AND vault_id=${raw} LIMIT 1`;
    if(exists.length>0) return Response.json({ error:"already claimed", vaultId:raw },{status:409});
    const m=await ensureMiningRow(user.id); if(m.balance < item.price) return Response.json({ error:"not enough coins", price:item.price, balance:m.balance },{status:402});
    // глобальный лимит
    const globalRows=await sql`SELECT count(*)::int as c FROM magnum_mining_vault WHERE vault_id=${raw}`;
    const globalCount=Number((globalRows[0] as {c:number}).c); if(globalCount >= item.limit) return Response.json({ error:"sold out", vaultId:raw, limit:item.limit },{status:409});
    await sql`UPDATE magnum_mining SET balance = balance - ${item.price} + ${item.reward}, updated_at=now() WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_mining_vault (user_id, vault_id, claimed_at) VALUES (${user.id}, ${raw}, now())`;
    const after=await sql`SELECT balance FROM magnum_mining WHERE user_id=${user.id} LIMIT 1`;
    const balance=Number((after[0] as {balance:number}).balance);
    return Response.json({ ok:true, vaultId:raw, price:item.price, reward:item.reward, balance });
  } catch(e){ console.error("[vault claim] failed",e); return Response.json({ error:"db error" },{status:500}); }
}

// ---- Mining exchange: руда → монеты 10:1 + лог magnum_mining_exchanges ----
const MINING_EXCHANGE_RATE = 10;
async function handleMiningExchange(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`mining:exchange:${user.id}:${ip}`,8,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{amount?:unknown}; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const amount=Number(body.amount); if(!Number.isInteger(amount)||amount<=0) return Response.json({error:"amount positive integer required"},{status:400});
  if(amount<10) return Response.json({error:"min 10 руды"},{status:400}); if(amount>10000) return Response.json({error:"max 10000"},{status:400});
  if(amount%MINING_EXCHANGE_RATE!==0) return Response.json({error:`amount must be multiple of ${MINING_EXCHANGE_RATE}`},{status:400});
  const coinsEarned=Math.floor(amount/MINING_EXCHANGE_RATE);
  try{
    const sql=getSql();
    await sql`CREATE TABLE IF NOT EXISTS magnum_mining_exchanges (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) NOT NULL, mining_amount integer NOT NULL, coins_amount integer NOT NULL, rate integer NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const m=await ensureMiningRow(user.id); if(m.balance<amount) return Response.json({error:"not enough руды",balance:m.balance,required:amount},{status:402});
    await sql`UPDATE magnum_mining SET balance=balance-${amount}, updated_at=now() WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    const upd=await sql`UPDATE magnum_coins SET balance=balance+${coinsEarned} WHERE user_id=${user.id} RETURNING balance`;
    const bal=Number((upd[0] as {balance:number}).balance);
    await sql`INSERT INTO magnum_mining_exchanges (user_id,mining_amount,coins_amount,rate) VALUES (${user.id},${amount},${coinsEarned},${MINING_EXCHANGE_RATE})`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${coinsEarned},'mining_exchange',${JSON.stringify({ mining:amount, coins:coinsEarned, rate:MINING_EXCHANGE_RATE })}::jsonb)`;
    const after=await sql`SELECT balance FROM magnum_mining WHERE user_id=${user.id} LIMIT 1`;
    const miningBal=Number((after[0] as {balance:number}).balance);
    return Response.json({ok:true,miningDeducted:amount,coinsEarned,rate:MINING_EXCHANGE_RATE,balance:bal,miningBalance:miningBal});
  }catch(e){ console.error("[mining exchange] failed",e); return Response.json({error:"db error"},{status:500}); }
}

// ---- Idea comments (Neon magnum_idea_comments) — без localStorage ----
function validateCommentBody(v: unknown): string | null {
  if(typeof v!=="string") return null; const s=v.trim(); if(s.length<3||s.length>400) return null; if(s.includes("<")||s.includes(">")) return null; return s;
}
async function handleIdeaCommentsGet(req: Request, idStr: string): Promise<Response> {
  const id=Number(idStr); if(!Number.isInteger(id)||id<=0) return Response.json({error:"invalid id"},{status:400});
  try{
    const sql=getSql();
    await sql`CREATE TABLE IF NOT EXISTS magnum_idea_comments (id serial PRIMARY KEY, idea_id integer REFERENCES magnum_ideas(id) ON DELETE CASCADE NOT NULL, user_id integer REFERENCES magnum_users(id) NOT NULL, body text NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const rows=await sql`SELECT c.id, c.body, c.created_at, u.username FROM magnum_idea_comments c JOIN magnum_users u ON u.id=c.user_id WHERE c.idea_id=${id} ORDER BY c.created_at ASC LIMIT 50`;
    return Response.json({ comments: rows.map((r:unknown)=>{ const x=r as {id:number;body:string;created_at:string;username:string}; return {id:Number(x.id),body:String(x.body),username:String(x.username),created_at:x.created_at}; }), count: rows.length, ideaId:id });
  }catch(e){ console.error("[idea comments get] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleIdeaCommentPost(req: Request, idStr: string): Promise<Response> {
  const id=Number(idStr); if(!Number.isInteger(id)||id<=0) return Response.json({error:"invalid id"},{status:400});
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`idea:comment:${user.id}:${ip}`,10,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{body?:unknown;text?:unknown;comment?:unknown}; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const text=validateCommentBody(body.body??body.text??body.comment); if(!text) return Response.json({error:"body 3..400 chars, no <>"},{status:400});
  try{
    const sql=getSql();
    await sql`CREATE TABLE IF NOT EXISTS magnum_idea_comments (id serial PRIMARY KEY, idea_id integer REFERENCES magnum_ideas(id) ON DELETE CASCADE NOT NULL, user_id integer REFERENCES magnum_users(id) NOT NULL, body text NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const ex=await sql`SELECT id FROM magnum_ideas WHERE id=${id} LIMIT 1`; if(ex.length===0) return Response.json({error:"idea not found"},{status:404});
    const rows=await sql`INSERT INTO magnum_idea_comments (idea_id,user_id,body) VALUES (${id},${user.id},${text}) RETURNING id, body, created_at`;
    return Response.json({ ok:true, comment:{ id:Number((rows[0] as {id:number}).id), body:String((rows[0] as {body:string}).body), username:user.username, created_at:(rows[0] as {created_at:string}).created_at } }, {status:201});
  }catch(e){ console.error("[idea comment post] failed",e); return Response.json({error:"db error"},{status:500}); }
}

// ---- Presave leaderboard (per-user stats, без localStorage) ----
async function handlePresaveLeaderboard(): Promise<Response> {
  try{
    const sql=getSql();
    const rows=await sql`SELECT COALESCE(u.username, 'Аноним') as username, count(*)::int as clicks, max(c.created_at) as last_click FROM magnum_presave_clicks c LEFT JOIN magnum_users u ON u.id=c.user_id GROUP BY u.username ORDER BY clicks DESC, last_click ASC LIMIT 20`;
    return Response.json({ leaderboard: rows.map((r:unknown)=>{ const x=r as {username:string;clicks:number;last_click:string}; return {username:String(x.username),clicks:Number(x.clicks),lastClick:x.last_click}; }), count: rows.length });
  }catch(e){ console.error("[presave leaderboard] failed",e); return Response.json({error:"db error"},{status:500}); }
}

// ---- Achievements + Profile (Neon magnum_user_achievements) ----
// 10 ачивок, прогресс считается live по Neon, без localStorage
type AchDef = { id: string; title: string; desc: string; reward: number; icon: string; rarity: "common"|"rare"|"epic"|"legendary" };
const ACHIEVEMENTS_CATALOG: AchDef[] = [
  { id: "first_presave",  title: "Первый пресейв",  desc: "Нажми пресейв MAGNUM",                reward: 42,  icon: "🔥", rarity: "common" },
  { id: "miner_100",      title: "Шахтёр 100",      desc: "Накопай 100 руды в майнинге",         reward: 42,  icon: "⛏️", rarity: "common" },
  { id: "miner_1000",     title: "Шахтёр 1000",     desc: "Накопай 1000 руды",                   reward: 142, icon: "🏗️", rarity: "rare" },
  { id: "shop_first",     title: "Первый скин",     desc: "Купи любой скин в магазине",          reward: 42,  icon: "🛒", rarity: "common" },
  { id: "daily_3",        title: "3 дня подряд",    desc: "Достигни стрика 3 в daily",           reward: 84,  icon: "📅", rarity: "rare" },
  { id: "idea_vote",      title: "Голос 42",        desc: "Проголосуй за идею",                  reward: 22,  icon: "💡", rarity: "common" },
  { id: "coins_5k",       title: "Богач 5K",        desc: "Накопи 5000 монет",                   reward: 142, icon: "💰", rarity: "epic" },
  { id: "cosmetic_first", title: "Стиль 42",        desc: "Купи косметику (рамка/баннер/титул)", reward: 42,  icon: "🎨", rarity: "common" },
  { id: "vault_first",    title: "Вскрытие",        desc: "Открой любой Vault-ящик",             reward: 84,  icon: "📦", rarity: "rare" },
  { id: "duel_play",      title: "Дуэлянт",         desc: "Сыграй дуэль WS (любой счёт)",        reward: 42,  icon: "⚔️", rarity: "common" },
];

function validateAchId(v: string): string | null {
  const s = v.trim().toLowerCase();
  if (!s || s.length > 32) return null;
  if (!/^[a-z0-9_]+$/.test(s)) return null;
  return ACHIEVEMENTS_CATALOG.some(x => x.id === s) ? s : null;
}

async function checkAchievement(userId: number, achId: string): Promise<{ ok: boolean; reason?: string }> {
  const sql = getSql();
  try {
    if (achId === "first_presave") {
      const r = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id=${userId}`;
      const c = Number((r[0] as { c: number }).c);
      return { ok: c >= 1, reason: c >= 1 ? undefined : "нужен пресейв" };
    }
    if (achId === "miner_100" || achId === "miner_1000") {
      const r = await sql`SELECT balance FROM magnum_mining WHERE user_id=${userId} LIMIT 1`;
      const bal = r.length ? Number((r[0] as { balance: number }).balance) : 0;
      const need = achId === "miner_100" ? 100 : 1000;
      return { ok: bal >= need, reason: bal >= need ? undefined : `нужно ${need} руды, сейчас ${bal}` };
    }
    if (achId === "shop_first") {
      const r = await sql`SELECT count(*)::int as c FROM magnum_shop_inventory WHERE user_id=${userId}`;
      const c = Number((r[0] as { c: number }).c);
      return { ok: c >= 1, reason: c >= 1 ? undefined : "нужна покупка скина" };
    }
    if (achId === "daily_3") {
      const r = await sql`SELECT max(streak)::int as m FROM magnum_daily_claims WHERE user_id=${userId}`;
      const m = r[0] ? (r[0] as { m: number | null }).m : 0;
      const v = Number(m || 0);
      return { ok: v >= 3, reason: v >= 3 ? undefined : `нужен стрик 3, сейчас ${v}` };
    }
    if (achId === "idea_vote") {
      const r = await sql`SELECT count(*)::int as c FROM magnum_idea_votes WHERE user_id=${userId}`;
      const c = Number((r[0] as { c: number }).c);
      return { ok: c >= 1, reason: c >= 1 ? undefined : "нужен голос за идею" };
    }
    if (achId === "coins_5k") {
      const r = await sql`SELECT balance FROM magnum_coins WHERE user_id=${userId} LIMIT 1`;
      const b = r.length ? Number((r[0] as { balance: number }).balance) : 0;
      return { ok: b >= 5000, reason: b >= 5000 ? undefined : `нужно 5000 монет, сейчас ${b}` };
    }
    if (achId === "cosmetic_first") {
      const r = await sql`SELECT count(*)::int as c FROM magnum_cosmetics WHERE user_id=${userId}`;
      const c = Number((r[0] as { c: number }).c);
      return { ok: c >= 1, reason: c >= 1 ? undefined : "нужна косметика" };
    }
    if (achId === "vault_first") {
      const r = await sql`SELECT count(*)::int as c FROM magnum_mining_vault WHERE user_id=${userId}`;
      const c = Number((r[0] as { c: number }).c);
      return { ok: c >= 1, reason: c >= 1 ? undefined : "нужен открытый vault" };
    }
    if (achId === "duel_play") {
      const r = await sql`SELECT count(*)::int as c FROM magnum_leaderboard WHERE player IN (SELECT username FROM magnum_users WHERE id=${userId}) AND game='duel'`;
      const c = Number((r[0] as { c: number }).c);
      return { ok: c >= 1, reason: c >= 1 ? undefined : "сыграй дуэль" };
    }
  } catch (e) {
    console.error("[ach check] failed", e);
    return { ok: false, reason: "db error" };
  }
  return { ok: false, reason: "unknown" };
}

async function handleAchCatalog(): Promise<Response> {
  return Response.json({ catalog: ACHIEVEMENTS_CATALOG, count: ACHIEVEMENTS_CATALOG.length });
}

async function handleAchGet(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT achievement_id, unlocked_at FROM magnum_user_achievements WHERE user_id=${user.id}`;
    const unlocked = new Set(rows.map((r: unknown) => (r as { achievement_id: string }).achievement_id));
    const catalog = await Promise.all(ACHIEVEMENTS_CATALOG.map(async a => {
      if (unlocked.has(a.id)) return { ...a, unlocked: true, achievable: true, hint: null as string | null };
      const chk = await checkAchievement(user.id, a.id);
      return { ...a, unlocked: false, achievable: chk.ok, hint: chk.reason || null };
    }));
    return Response.json({ catalog, unlocked: [...unlocked], total: ACHIEVEMENTS_CATALOG.length, unlockedCount: unlocked.size });
  } catch (e) {
    console.error("[ach get] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleAchClaim(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`ach:claim:${user.id}:${ip}`, 10, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { achievementId?: string; id?: string };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const raw = validateAchId(String(body.achievementId ?? body.id ?? ""));
  if (!raw) return Response.json({ error: "unknown achievement" }, { status: 400 });
  try {
    const sql = getSql();
    const ex = await sql`SELECT id FROM magnum_user_achievements WHERE user_id=${user.id} AND achievement_id=${raw} LIMIT 1`;
    if (ex.length > 0) return Response.json({ error: "already claimed", achievementId: raw }, { status: 409 });
    const chk = await checkAchievement(user.id, raw);
    if (!chk.ok) return Response.json({ error: "not achievable yet", achievementId: raw, reason: chk.reason }, { status: 400 });
    const def = ACHIEVEMENTS_CATALOG.find(x => x.id === raw)!;
    await sql`INSERT INTO magnum_user_achievements (user_id, achievement_id, unlocked_at) VALUES (${user.id}, ${raw}, now())`;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    const upd = await sql`UPDATE magnum_coins SET balance=balance+${def.reward} WHERE user_id=${user.id} RETURNING balance`;
    const bal = Number((upd[0] as { balance: number }).balance);
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${def.reward},'achievement',${JSON.stringify({ achievementId: raw })}::jsonb)`;
    await ensureNotification(user.id, `Ачивка: ${def.title}`, `+${def.reward} монет за ${def.title}`, "achievement");
    return Response.json({ ok: true, achievementId: raw, reward: def.reward, balance: bal });
  } catch (e) {
    console.error("[ach claim] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleProfile(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const [coinsR, miningR, dailyR, txR, presaveR, shopR, cosR, vaultR, achR, frameR] = await Promise.all([
      sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`,
      sql`SELECT balance,upgrades FROM magnum_mining WHERE user_id=${user.id} LIMIT 1`,
      sql`SELECT streak,reward,claimed_at FROM magnum_daily_claims WHERE user_id=${user.id} ORDER BY claimed_at DESC LIMIT 1`,
      sql`SELECT count(*)::int as c FROM magnum_transactions WHERE user_id=${user.id}`,
      sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id=${user.id}`,
      sql`SELECT count(*)::int as c FROM magnum_shop_inventory WHERE user_id=${user.id}`,
      sql`SELECT count(*)::int as c FROM magnum_cosmetics WHERE user_id=${user.id}`,
      sql`SELECT count(*)::int as c FROM magnum_mining_vault WHERE user_id=${user.id}`,
      sql`SELECT count(*)::int as c FROM magnum_user_achievements WHERE user_id=${user.id}`,
      sql`SELECT verified FROM magnum_frames WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 1`,
    ]);
    const coins = coinsR.length ? Number((coinsR[0] as { balance: number }).balance) : 1000;
    const mining = miningR.length ? { balance: Number((miningR[0] as { balance: number }).balance), upgrades: (miningR[0] as { upgrades: unknown }).upgrades } : null;
    const daily = dailyR.length ? dailyR[0] : null;
    const frameVerified = frameR.length ? Boolean((frameR[0] as { verified: boolean }).verified) : false;
    return Response.json({
      user,
      coins,
      balance: coins,
      mining,
      daily,
      frameVerified,
      counts: {
        transactions: Number((txR[0] as { c: number }).c),
        presaves: Number((presaveR[0] as { c: number }).c),
        shop: Number((shopR[0] as { c: number }).c),
        cosmetics: Number((cosR[0] as { c: number }).c),
        vaults: Number((vaultR[0] as { c: number }).c),
        achievements: Number((achR[0] as { c: number }).c),
      },
    });
  } catch (e) {
    console.error("[profile] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Notifications inbox (Neon magnum_notifications) ----
async function ensureNotification(userId: number, title: string, body: string, kind: string = "info"): Promise<void> {
  try {
    const sql = getSql();
    const t = title.trim().slice(0, 80);
    const b = body.trim().slice(0, 300);
    const k = kind.trim().slice(0, 16) || "info";
    await sql`INSERT INTO magnum_notifications (user_id, title, body, kind, read, created_at) VALUES (${userId}, ${t}, ${b}, ${k}, false, now())`;
  } catch (e) { console.error("[notify ensure] failed", e); }
}
async function handleNotificationsGet(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const unreadOnly = url.searchParams.get("unread") === "1" || url.searchParams.get("unread") === "true";
    const rows = unreadOnly
      ? await sql`SELECT id, title, body, kind, read, created_at FROM magnum_notifications WHERE user_id=${user.id} AND read=false ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT id, title, body, kind, read, created_at FROM magnum_notifications WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT ${limit}`;
    const unreadRows = await sql`SELECT count(*)::int as c FROM magnum_notifications WHERE user_id=${user.id} AND read=false`;
    const unread = Number((unreadRows[0] as { c: number }).c);
    return Response.json({
      notifications: rows.map((r: unknown) => {
        const x = r as { id: number; title: string; body: string; kind: string; read: boolean; created_at: string };
        return { id: Number(x.id), title: String(x.title), body: String(x.body), kind: String(x.kind), read: Boolean(x.read), created_at: x.created_at };
      }),
      unread,
      count: rows.length,
    });
  } catch (e) { console.error("[notifications get] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleNotificationsRead(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`notif:read:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { id?: number; ids?: number[] };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0).slice(0, 50)
    : typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0 ? [body.id]
    : [];
  if (ids.length === 0) return Response.json({ error: "id or ids required" }, { status: 400 });
  try {
    const sql = getSql();
    for (const id of ids) await sql`UPDATE magnum_notifications SET read=true WHERE user_id=${user.id} AND id=${id}`;
    return Response.json({ ok: true, read: ids });
  } catch (e) { console.error("[notifications read] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleNotificationsClear(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`notif:clear:${user.id}:${ip}`, 6, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  try {
    const sql = getSql();
    const del = await sql`DELETE FROM magnum_notifications WHERE user_id=${user.id} AND read=true RETURNING id`;
    return Response.json({ ok: true, cleared: del.length });
  } catch (e) { console.error("[notifications clear] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}

// ---- Promo codes (Neon magnum_promo_codes + redemptions) ----
function normalizePromo(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const s = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s || s.length < 3 || s.length > 24) return null;
  return s;
}
async function handlePromoCatalog(): Promise<Response> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT code, reward, max_uses, uses, expires_at FROM magnum_promo_codes ORDER BY reward ASC`;
    return Response.json({
      promos: rows.map((r: unknown) => {
        const x = r as { code: string; reward: number; max_uses: number; uses: number; expires_at: string | null };
        return { code: String(x.code), reward: Number(x.reward), maxUses: Number(x.max_uses), uses: Number(x.uses), expiresAt: x.expires_at };
      }),
      count: rows.length,
    });
  } catch (e) { console.error("[promo catalog] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handlePromoRedeem(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`promo:redeem:${user.id}:${ip}`, 12, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { code?: string };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const code = normalizePromo(body.code);
  if (!code) return Response.json({ error: "code required (3-24 A-Z0-9)" }, { status: 400 });
  try {
    const sql = getSql();
    const promoRows = await sql`SELECT code, reward, max_uses, uses, expires_at FROM magnum_promo_codes WHERE code=${code} LIMIT 1`;
    if (promoRows.length === 0) return Response.json({ error: "unknown code", code }, { status: 404 });
    const promo = promoRows[0] as { code: string; reward: number; max_uses: number; uses: number; expires_at: string | null };
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return Response.json({ error: "expired", code }, { status: 400 });
    if (Number(promo.uses) >= Number(promo.max_uses)) return Response.json({ error: "sold out", code, maxUses: promo.max_uses }, { status: 409 });
    const ex = await sql`SELECT id FROM magnum_promo_redemptions WHERE user_id=${user.id} AND code=${code} LIMIT 1`;
    if (ex.length > 0) return Response.json({ error: "already redeemed", code }, { status: 409 });
    await sql`INSERT INTO magnum_promo_redemptions (user_id, code, redeemed_at) VALUES (${user.id}, ${code}, now())`;
    await sql`UPDATE magnum_promo_codes SET uses = uses + 1 WHERE code=${code}`;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    const upd = await sql`UPDATE magnum_coins SET balance = balance + ${Number(promo.reward)} WHERE user_id=${user.id} RETURNING balance`;
    const bal = Number((upd[0] as { balance: number }).balance);
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${Number(promo.reward)},'promo',${JSON.stringify({ code })}::jsonb)`;
    await ensureNotification(user.id, `Промокод ${code}`, `+${promo.reward} монет за код ${code}`, "promo");
    return Response.json({ ok: true, code, reward: Number(promo.reward), balance: bal });
  } catch (e) { console.error("[promo redeem] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handlePromoMy(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT code, redeemed_at FROM magnum_promo_redemptions WHERE user_id=${user.id} ORDER BY redeemed_at DESC`;
    return Response.json({ redemptions: rows.map((r: unknown) => { const x=r as {code:string;redeemed_at:string}; return { code:String(x.code), redeemed_at:x.redeemed_at }; }), count: rows.length });
  } catch (e) { console.error("[promo my] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}

// ---- Presave handlers (rate limit + validation, stats) ----
async function handlePresaveClick(req: Request): Promise<Response> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`presave:${ip}`, 6, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { url?: string };
  try { body = (await req.json().catch(() => ({}))) as typeof body; } catch { body = {}; }
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 300) : "/magnum";
  if (url.length > 300 || url.includes("<") || url.includes("\"")) return Response.json({ error: "invalid url" }, { status: 400 });
  const token = extractToken(req);
  let userId: number | null = null;
  if (token) { try { const u = await getUserByToken(token); if (u) userId = u.id; } catch (e) { console.error("[presave] getUserByToken failed", e); } }
  try {
    const sql = getSql();
    await sql`INSERT INTO magnum_presave_clicks (user_id, url, ip, created_at) VALUES (${userId}, ${url}, ${ip}, now())`;
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[presave click] failed", e);
    return Response.json({ ok: true });
  }
}

async function handlePresaveStats(req: Request): Promise<Response> {
  try {
    const sql = getSql();
    const totalRows = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks`;
    const dayRows = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE created_at > now() - interval '24 hours'`;
    const weekRows = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE created_at > now() - interval '7 days'`;
    const topRows = await sql`SELECT url, count(*)::int as c FROM magnum_presave_clicks GROUP BY url ORDER BY c DESC LIMIT 5`;
    const token = extractToken(req);
    let myClicks: number | null = null;
    if (token) { try { const u = await getUserByToken(token); if (u) { const mine = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id = ${u.id}`; myClicks = Number((mine[0] as { c: number }).c); } } catch (e) { console.error("[bandlink] getUserByToken failed", e); } }
    return Response.json({
      total: Number((totalRows[0] as { c: number }).c),
      last24h: Number((dayRows[0] as { c: number }).c),
      last7d: Number((weekRows[0] as { c: number }).c),
      topUrls: topRows.map((r: unknown) => { const x = r as { url: string; c: number }; return { url: String(x.url), count: Number(x.c) }; }),
      myClicks,
    });
  } catch (e) {
    console.error("[presave stats] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleBandlink(): Promise<Response> {
  const url = "https://music.thefence.me/psmagnum";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "MAGNUM/42 (+https://magnum.thefence.me)" }, signal: AbortSignal.timeout(8000) });
    const html = await res.text().catch(() => "");
    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "5opka, MellSher - Magnum | BandLink";
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? null;
    const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] ?? html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? null;
    const hasPresave = html.includes("presave") || html.includes("Пресейв") || html.includes("Пре-сейв");
    // счётчики: парсим yandex/vk/spotify/apple/mts ссылки если есть
    const services = {
      yandex: html.includes("yandex") || html.includes("Яндекс"),
      vk: html.includes("vkmusic") || html.includes("VK Музыка"),
      spotify: html.includes("spotify"),
      apple: html.includes("apple"),
      mts: html.includes("mts") || html.includes("КИОН"),
    };
    const ok = res.ok && !html.includes("This page could not be found") && !html.includes("404");
    const sql = getSql();
    let presaveCount = 0;
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks`; presaveCount = Number((r[0] as { c: number }).c); } catch (e) { console.error("[presave count] failed", e); }
    return Response.json({ ok, status: res.status, title: ogTitle, image: ogImage, description: ogDesc, hasPresave, services, presaveCount, url });
  } catch (e) {
    return Response.json({ ok: false, title: "5opka, MellSher - Magnum | BandLink", image: null, description: null, hasPresave: false, services: {}, presaveCount: 0, url, error: String(e).slice(0, 200) });
  }
}

async function handleMiningTop(): Promise<Response> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT u.username, m.balance, m.upgrades, s.skin_id as avatar FROM magnum_mining m JOIN magnum_users u ON u.id=m.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=m.user_id AND s.equipped=true ORDER BY m.balance DESC LIMIT 20`;
    const top = rows.map((r: unknown) => {
      const x = r as { username: string; balance: number; upgrades: unknown; avatar: string | null };
      const ups = parseUpgrades(x.upgrades);
      const perSec = ups.reduce((s, u) => s + (UPGRADES_DEF[u.id]?.auto ?? 0) * u.count, 0);
      return { username: String(x.username), balance: Number(x.balance), perSec, upgrades: ups, avatar: x.avatar || null };
    });
    return Response.json({ top, count: top.length });
  } catch (e) {
    console.error("[mining top] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Game scores + referrals + duel history (magnum_game_scores / referrals / duel_history) ----
const GAME_WHITELIST = new Set(["runner","match3","knife","memory","clicker","rhythm","stack","blackjack","roulette","2042","flappy","typing","snake","dodge","quiz","duel"]);
function validateGameName(g: unknown): string | null {
  if (typeof g !== "string") return null;
  const s = g.trim().toLowerCase().slice(0, 32);
  if (!s || s.length < 2) return null;
  if (!GAME_WHITELIST.has(s)) return null;
  return s;
}
async function handleGameSubmit(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`game:submit:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { game?: unknown; score?: unknown; meta?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const game = validateGameName(body.game);
  if (!game) return Response.json({ error: "invalid game", allowed: [...GAME_WHITELIST] }, { status: 400 });
  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 0 || score > 999999) return Response.json({ error: "score must be integer 0..999999" }, { status: 400 });
  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
  const coinsEarned = score < 10 ? 0 : Math.min(42, Math.floor(score / 200));
  try {
    const sql = getSql();
    await sql`INSERT INTO magnum_game_scores (user_id, game, score, coins_earned, meta) VALUES (${user.id}, ${game}, ${score}, ${coinsEarned}, ${JSON.stringify(meta)}::jsonb)`;
    if (coinsEarned > 0) {
      await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
      const upd = await sql`UPDATE magnum_coins SET balance = balance + ${coinsEarned} WHERE user_id=${user.id} RETURNING balance`;
      const bal = Number((upd[0] as { balance: number }).balance);
      await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${coinsEarned}, 'game_reward', ${JSON.stringify({ game, score })}::jsonb)`;
      return Response.json({ ok: true, game, score, coinsEarned, balance: bal });
    }
    return Response.json({ ok: true, game, score, coinsEarned: 0 });
  } catch (e) { console.error("[game submit] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleGameTop(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const game = url.searchParams.get("game")?.trim().toLowerCase() || "";
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const sql = getSql();
    const rows = game && GAME_WHITELIST.has(game)
      ? await sql`SELECT g.game, g.score, g.created_at, u.username, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true WHERE g.game=${game} ORDER BY g.score DESC, g.created_at ASC LIMIT ${limit}`
      : await sql`SELECT g.game, g.score, g.created_at, u.username, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true ORDER BY g.score DESC LIMIT ${limit}`;
    return Response.json({ top: rows.map((r: unknown) => { const x=r as {game:string;score:number;created_at:string;username:string;avatar:string|null}; return { game:String(x.game), score:Number(x.score), username:String(x.username), avatar:x.avatar||null, created_at:x.created_at }; }), count: rows.length, game: game || "all" });
  } catch (e) { console.error("[game top] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleGameMy(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const rows = await sql`SELECT game, score, coins_earned, created_at FROM magnum_game_scores WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT ${limit}`;
    return Response.json({ scores: rows.map((r: unknown) => { const x=r as {game:string;score:number;coins_earned:number;created_at:string}; return { game:String(x.game), score:Number(x.score), coinsEarned:Number(x.coins_earned), created_at:x.created_at }; }), count: rows.length });
  } catch (e) { console.error("[game my] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
function referralCodeFor(user: { id: number; username: string }): string {
  return `${user.username.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12) || "BRAT"}${user.id.toString(36).toUpperCase()}42`;
}
async function handleReferralCode(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const code = referralCodeFor(user);
    const rows = await sql`SELECT invited_id, reward_claimed, created_at FROM magnum_referrals WHERE inviter_id=${user.id} ORDER BY created_at DESC`;
    const invited = rows.map((r: unknown) => { const x=r as {invited_id:number;reward_claimed:boolean;created_at:string}; return { invitedId:Number(x.invited_id), rewardClaimed:Boolean(x.reward_claimed), created_at:x.created_at }; });
    const redeemed = await sql`SELECT inviter_id, code FROM magnum_referrals WHERE invited_id=${user.id} LIMIT 1`;
    return Response.json({ code, invited, invitedCount: invited.length, redeemed: redeemed.length ? redeemed[0] : null });
  } catch (e) { console.error("[referral code] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleReferralRedeem(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`referral:redeem:${user.id}:${ip}`, 5, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { code?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const raw = typeof body.code === "string" ? body.code.trim().toUpperCase().slice(0, 32) : "";
  if (!raw || raw.length < 4) return Response.json({ error: "code required" }, { status: 400 });
  const selfCode = referralCodeFor(user);
  if (raw === selfCode) return Response.json({ error: "cannot redeem own code" }, { status: 400 });
  try {
    const sql = getSql();
    const already = await sql`SELECT id FROM magnum_referrals WHERE invited_id=${user.id} LIMIT 1`;
    if (already.length > 0) return Response.json({ error: "already redeemed referral" }, { status: 409 });
    // find inviter by code pattern: code = USERNAME+id36+42, extract id
    const m = raw.match(/^(.*)42$/);
    if (!m) return Response.json({ error: "invalid code format" }, { status: 400 });
    const without42 = raw.slice(0, -2);
    // try parse trailing base36 as user id
    let inviterId: number | null = null;
    for (let len = 1; len <= 6; len++) {
      const cand = without42.slice(-len);
      const n = parseInt(cand, 36);
      if (!Number.isFinite(n) || n <= 0) continue;
      const u = await sql`SELECT id, username FROM magnum_users WHERE id=${n} LIMIT 1`;
      if (u.length === 0) continue;
      const uu = u[0] as { id:number; username:string };
      if (referralCodeFor({ id:Number(uu.id), username:String(uu.username) }) === raw) { inviterId = Number(uu.id); break; }
    }
    if (inviterId === null) return Response.json({ error: "code not found" }, { status: 404 });
    await sql`INSERT INTO magnum_referrals (inviter_id, invited_id, code) VALUES (${inviterId}, ${user.id}, ${raw})`;
    const reward = 42;
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${inviterId}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`UPDATE magnum_coins SET balance = balance + ${reward} WHERE user_id=${user.id}`;
    await sql`UPDATE magnum_coins SET balance = balance + ${reward} WHERE user_id=${inviterId}`;
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${reward}, 'referral_in', ${JSON.stringify({ code: raw, inviter: inviterId })}::jsonb)`;
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${inviterId}, ${reward}, 'referral_bonus', ${JSON.stringify({ invited: user.id, code: raw })}::jsonb)`;
    try { await ensureNotification(inviterId, "Реферал 42!", `Братуха ${user.username} активировал твой код +${reward} монет`, "referral"); } catch (e) { console.error("[referral notify] failed", e); }
    const upd = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    return Response.json({ ok: true, reward, balance: Number((upd[0] as {balance:number}).balance), inviterId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) return Response.json({ error: "already redeemed referral" }, { status: 409 });
    console.error("[referral redeem] failed", e); return Response.json({ error: "db error" }, { status: 500 });
  }
}
async function handleDuelHistory(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const sql = getSql();
    const rows = await sql`SELECT room_id, winner, scores, duration_sec, player_count, created_at FROM magnum_duel_history ORDER BY created_at DESC LIMIT ${limit}`;
    return Response.json({ history: rows.map((r: unknown) => { const x=r as {room_id:string;winner:string|null;scores:unknown;duration_sec:number;player_count:number;created_at:string}; return { roomId:String(x.room_id), winner:x.winner, scores:x.scores, durationSec:Number(x.duration_sec), playerCount:Number(x.player_count), created_at:x.created_at }; }), count: rows.length });
  } catch (e) { console.error("[duel history] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}

// ---- Global Chat 42 (magnum_chat_messages) + Social Follows (magnum_follows) ----
function validateChatBody(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length < 1 || s.length > 500) return null;
  if (s.includes("<") || s.includes(">")) return null;
  return s;
}
async function handleChatHistory(req: Request): Promise<Response> {
  try {
    const sql = getSql();
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 30)));
    const offset = Math.max(0, Math.min(5000, Number(url.searchParams.get("offset") || 0)));
    const since = url.searchParams.get("since")?.trim() || "";
    const rows = since
      ? await sql`SELECT m.id,m.body,m.reply_to,m.created_at,u.username,s.skin_id as avatar FROM magnum_chat_messages m JOIN magnum_users u ON u.id=m.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=m.user_id AND s.equipped=true WHERE m.created_at > ${since}::timestamp ORDER BY m.created_at ASC LIMIT ${limit} OFFSET ${offset}`
      : await sql`SELECT m.id,m.body,m.reply_to,m.created_at,u.username,s.skin_id as avatar FROM magnum_chat_messages m JOIN magnum_users u ON u.id=m.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=m.user_id AND s.equipped=true ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const list = rows.map((r: unknown) => {
      const x = r as { id: number; body: string; reply_to: number | null; created_at: string; username: string; avatar: string | null };
      return { id: Number(x.id), body: String(x.body), replyTo: x.reply_to ? Number(x.reply_to) : null, created_at: x.created_at, username: String(x.username), avatar: x.avatar || null };
    });
    const ordered = since ? list : list.reverse();
    return Response.json({ messages: ordered, count: ordered.length, limit, offset });
  } catch (e) { console.error("[chat history] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleChatSend(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`chat:send:${user.id}:${ip}`, 12, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { body?: unknown; text?: unknown; message?: unknown; replyTo?: unknown; reply_to?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = validateChatBody(body.body ?? body.text ?? body.message);
  if (!text) return Response.json({ error: "body 1..500 chars, no <>" }, { status: 400 });
  const rawReply = body.replyTo ?? body.reply_to;
  const replyTo = rawReply != null ? Number(rawReply) : null;
  if (replyTo != null && (!Number.isInteger(replyTo) || replyTo <= 0)) return Response.json({ error: "replyTo must be integer id" }, { status: 400 });
  try {
    const sql = getSql();
    if (replyTo) {
      const ex = await sql`SELECT id FROM magnum_chat_messages WHERE id=${replyTo} LIMIT 1`;
      if (ex.length === 0) return Response.json({ error: "reply target not found" }, { status: 404 });
    }
    const rows = await sql`INSERT INTO magnum_chat_messages (user_id, body, reply_to) VALUES (${user.id}, ${text}, ${replyTo}) RETURNING id, body, reply_to, created_at`;
    const msg = rows[0] as { id: number; body: string; reply_to: number | null; created_at: string };
    return Response.json({ ok: true, message: { id: Number(msg.id), body: String(msg.body), replyTo: msg.reply_to ? Number(msg.reply_to) : null, username: user.username, created_at: msg.created_at } }, { status: 201 });
  } catch (e) { console.error("[chat send] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleChatDelete(req: Request, idStr: string): Promise<Response> {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "invalid id" }, { status: 400 });
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const target = await sql`SELECT user_id FROM magnum_chat_messages WHERE id=${id} LIMIT 1`;
    if (target.length === 0) return Response.json({ error: "not found" }, { status: 404 });
    const ownerId = Number((target[0] as { user_id: number }).user_id);
    const isOwner = ownerId === user.id;
    const coinsR = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const bal = coinsR.length ? Number((coinsR[0] as { balance: number }).balance) : 0;
    const isMod = bal >= 5000 || user.username.toLowerCase().includes("admin");
    if (!isOwner && !isMod) return Response.json({ error: "only author or mod (5000 coins)" }, { status: 403 });
    await sql`DELETE FROM magnum_chat_messages WHERE id=${id}`;
    await logModeration(user.id, "chat_delete", "chat", id, { ownerId });
    return Response.json({ ok: true, deleted: id });
  } catch (e) { console.error("[chat delete] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleFollowToggle(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`follow:toggle:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { username?: unknown; to?: unknown; target?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const raw = typeof body.username === "string" ? body.username : typeof body.to === "string" ? body.to : typeof body.target === "string" ? body.target : "";
  const name = String(raw).trim().slice(0, 32);
  if (!name || name.length < 2) return Response.json({ error: "username 2..32 required" }, { status: 400 });
  if (name.toLowerCase() === user.username.toLowerCase()) return Response.json({ error: "cannot follow self" }, { status: 400 });
  try {
    const sql = getSql();
    const target = await sql`SELECT id FROM magnum_users WHERE username=${name} LIMIT 1`;
    if (target.length === 0) return Response.json({ error: "user not found" }, { status: 404 });
    const targetId = Number((target[0] as { id: number }).id);
    const ex = await sql`SELECT id FROM magnum_follows WHERE follower_id=${user.id} AND following_id=${targetId} LIMIT 1`;
    if (ex.length > 0) {
      await sql`DELETE FROM magnum_follows WHERE follower_id=${user.id} AND following_id=${targetId}`;
      return Response.json({ ok: true, following: false, target: name });
    }
    await sql`INSERT INTO magnum_follows (follower_id, following_id) VALUES (${user.id}, ${targetId})`;
    try { await ensureNotification(targetId, `Новый фолловер 42`, `Братуха ${user.username} подписался на тебя`, "follow"); } catch (e) { console.error("[follow notify] failed", e); }
    return Response.json({ ok: true, following: true, target: name });
  } catch (e) { console.error("[follow toggle] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleFollowsList(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const url = new URL(req.url);
    const box = url.searchParams.get("box") === "followers" ? "followers" : "following";
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const rows = box === "followers"
      ? await sql`SELECT u.username, f.created_at, s.skin_id as avatar FROM magnum_follows f JOIN magnum_users u ON u.id=f.follower_id LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE f.following_id=${user.id} ORDER BY f.created_at DESC LIMIT ${limit}`
      : await sql`SELECT u.username, f.created_at, s.skin_id as avatar FROM magnum_follows f JOIN magnum_users u ON u.id=f.following_id LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE f.follower_id=${user.id} ORDER BY f.created_at DESC LIMIT ${limit}`;
    return Response.json({ box, list: rows.map((r: unknown) => { const x = r as { username: string; created_at: string; avatar: string | null }; return { username: String(x.username), avatar: x.avatar || null, created_at: x.created_at }; }), count: rows.length });
  } catch (e) { console.error("[follows list] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleFeed(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const rows = await sql`SELECT m.id,m.body,m.created_at,u.username,s.skin_id as avatar FROM magnum_chat_messages m JOIN magnum_users u ON u.id=m.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=m.user_id AND s.equipped=true WHERE m.user_id IN (SELECT following_id FROM magnum_follows WHERE follower_id=${user.id}) ORDER BY m.created_at DESC LIMIT ${limit}`;
    return Response.json({ feed: rows.map((r: unknown) => { const x = r as { id: number; body: string; created_at: string; username: string; avatar: string | null }; return { id: Number(x.id), body: String(x.body), username: String(x.username), avatar: x.avatar || null, created_at: x.created_at }; }), count: rows.length });
  } catch (e) { console.error("[feed] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}

// ---- Reports + Moderation queue + Idea status workflow + Public profile + Unified search ----
const REPORT_REASONS = new Set(["spam","insult","nsfw","fake","other"]);
const REPORT_TARGETS = new Set(["idea","comment","profile","duel"]);
const IDEA_STATUSES = new Set(["pending","approved","rejected","done","archived"]);
function validateReportTarget(v: unknown): string | null { if(typeof v!=="string") return null; const s=v.trim().toLowerCase().slice(0,16); return REPORT_TARGETS.has(s)?s:null; }
function validateReportReason(v: unknown): string | null { if(typeof v!=="string") return null; const s=v.trim().toLowerCase().slice(0,32); return REPORT_REASONS.has(s)?s:null; }
async function logModeration(actorId: number|null, action: string, targetType: string, targetId: string|number, meta: Record<string,unknown>={}): Promise<void> {
  try{ const sql=getSql(); await sql`INSERT INTO magnum_moderation_log (actor_id, action, target_type, target_id, meta) VALUES (${actorId}, ${action.trim().slice(0,32)}, ${targetType.trim().slice(0,32)}, ${String(targetId).slice(0,64)}, ${JSON.stringify(meta)}::jsonb)`; }catch(e){ console.error("[mod log] failed",e); }
}
async function handleReportCreate(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`report:create:${user.id}:${ip}`,8,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{targetType?:unknown;targetId?:unknown;reason?:unknown;details?:unknown};
  try{ body=(await req.json()) as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const targetType=validateReportTarget(body.targetType); if(!targetType) return Response.json({error:"targetType idea|comment|profile|duel"},{status:400});
  const targetId=Number(body.targetId); if(!Number.isInteger(targetId)||targetId<=0||targetId>9999999) return Response.json({error:"targetId integer 1..9M"},{status:400});
  const reason=validateReportReason(body.reason); if(!reason) return Response.json({error:"reason spam|insult|nsfw|fake|other"},{status:400});
  const details=typeof body.details==="string"?body.details.trim().slice(0,300):""; if(details.includes("<")||details.includes(">")) return Response.json({error:"details no <>"},{status:400});
  try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_reports (id serial PRIMARY KEY, reporter_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, target_type text NOT NULL, target_id integer NOT NULL, reason text NOT NULL, details text, status text DEFAULT 'pending' NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS magnum_moderation_log (id serial PRIMARY KEY, actor_id integer REFERENCES magnum_users(id) ON DELETE SET NULL, action text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, meta jsonb DEFAULT '{}'::jsonb NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const dup=await sql`SELECT id FROM magnum_reports WHERE reporter_id=${user.id} AND target_type=${targetType} AND target_id=${targetId} LIMIT 1`;
    if(dup.length>0) return Response.json({error:"already reported",targetType,targetId},{status:409});
    const rows=await sql`INSERT INTO magnum_reports (reporter_id,target_type,target_id,reason,details) VALUES (${user.id},${targetType},${targetId},${reason},${details||null}) RETURNING id,target_type,target_id,reason,status,created_at`;
    await logModeration(user.id,"report",targetType,targetId,{reason,details:details||null});
    return Response.json({ok:true,report:rows[0]},{status:201});
  }catch(e){ console.error("[report create] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleReportsGet(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_reports (id serial PRIMARY KEY, reporter_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, target_type text NOT NULL, target_id integer NOT NULL, reason text NOT NULL, details text, status text DEFAULT 'pending' NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const url=new URL(req.url); const status=url.searchParams.get("status")?.trim().toLowerCase()||""; const limit=Math.min(50,Math.max(1,Number(url.searchParams.get("limit")||20)));
    const mine=url.searchParams.get("mine")==="1"||url.searchParams.get("mine")==="true";
    const rows=mine?await sql`SELECT r.id,r.target_type,r.target_id,r.reason,r.status,r.created_at,u.username as reporter FROM magnum_reports r JOIN magnum_users u ON u.id=r.reporter_id WHERE r.reporter_id=${user.id} ORDER BY r.created_at DESC LIMIT ${limit}`
      :status&&["pending","reviewed","rejected","actioned"].includes(status)?await sql`SELECT r.id,r.target_type,r.target_id,r.reason,r.status,r.created_at,u.username as reporter FROM magnum_reports r JOIN magnum_users u ON u.id=r.reporter_id WHERE r.status=${status} ORDER BY r.created_at DESC LIMIT ${limit}`
      :await sql`SELECT r.id,r.target_type,r.target_id,r.reason,r.status,r.created_at,u.username as reporter FROM magnum_reports r JOIN magnum_users u ON u.id=r.reporter_id ORDER BY r.created_at DESC LIMIT ${limit}`;
    return Response.json({reports:rows.map((r:unknown)=>{const x=r as {id:number;target_type:string;target_id:number;reason:string;status:string;created_at:string;reporter:string}; return {id:Number(x.id),targetType:String(x.target_type),targetId:Number(x.target_id),reason:String(x.reason),status:String(x.status),created_at:x.created_at,reporter:String(x.reporter)};}),count:rows.length});
  }catch(e){ console.error("[reports get] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleIdeaStatusPatch(req: Request, idStr: string): Promise<Response> {
  const id=Number(idStr); if(!Number.isInteger(id)||id<=0) return Response.json({error:"invalid id"},{status:400});
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`idea:status:${user.id}:${ip}`,10,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{status?:unknown}; try{ body=(await req.json()) as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const nextStatus=typeof body.status==="string"?body.status.trim().toLowerCase():""; if(!IDEA_STATUSES.has(nextStatus)) return Response.json({error:"status pending|approved|rejected|done|archived",allowed:[...IDEA_STATUSES]},{status:400});
  try{ const sql=getSql(); const coinsR=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`; const bal=coinsR.length?Number((coinsR[0] as {balance:number}).balance):0;
    const isPrivileged=bal>=5000||user.username.toLowerCase().includes("admin")||user.username.toLowerCase()==="5opka";
    if(!isPrivileged) return Response.json({error:"moderation requires 5000 coins or admin",balance:bal},{status:403});
    const exists=await sql`SELECT id,status FROM magnum_ideas WHERE id=${id} LIMIT 1`; if(exists.length===0) return Response.json({error:"idea not found"},{status:404});
    const prev=String((exists[0] as {status:string}).status||"pending");
    const rows=await sql`UPDATE magnum_ideas SET status=${nextStatus} WHERE id=${id} RETURNING *`;
    await sql`CREATE TABLE IF NOT EXISTS magnum_moderation_log (id serial PRIMARY KEY, actor_id integer REFERENCES magnum_users(id) ON DELETE SET NULL, action text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, meta jsonb DEFAULT '{}'::jsonb NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    await logModeration(user.id,"idea_status", "idea", id, {from:prev,to:nextStatus});
    return Response.json({ok:true,idea:rows[0],prevStatus:prev});
  }catch(e){ console.error("[idea status] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleModerationLog(req: Request): Promise<Response> {
  try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_moderation_log (id serial PRIMARY KEY, actor_id integer REFERENCES magnum_users(id) ON DELETE SET NULL, action text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, meta jsonb DEFAULT '{}'::jsonb NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const url=new URL(req.url); const limit=Math.min(50,Math.max(1,Number(url.searchParams.get("limit")||30)));
    const action=url.searchParams.get("action")?.trim().slice(0,32)||""; const rows=action?await sql`SELECT l.id,l.action,l.target_type,l.target_id,l.meta,l.created_at,COALESCE(u.username,'system') as actor FROM magnum_moderation_log l LEFT JOIN magnum_users u ON u.id=l.actor_id WHERE l.action=${action} ORDER BY l.created_at DESC LIMIT ${limit}`:await sql`SELECT l.id,l.action,l.target_type,l.target_id,l.meta,l.created_at,COALESCE(u.username,'system') as actor FROM magnum_moderation_log l LEFT JOIN magnum_users u ON u.id=l.actor_id ORDER BY l.created_at DESC LIMIT ${limit}`;
    return Response.json({log:rows.map((r:unknown)=>{const x=r as {id:number;action:string;target_type:string;target_id:string;meta:unknown;created_at:string;actor:string}; return {id:Number(x.id),action:String(x.action),targetType:String(x.target_type),targetId:String(x.target_id),meta:x.meta,actor:String(x.actor),created_at:x.created_at};}),count:rows.length});
  }catch(e){ console.error("[mod log get] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handlePublicProfile(req: Request, username: string): Promise<Response> {
  const name=decodeURIComponent(username).trim().slice(0,32); if(!name||name.length<2) return Response.json({error:"username 2..32"},{status:400});
  try{ const sql=getSql(); const u=await sql`SELECT id,username,created_at FROM magnum_users WHERE username=${name} LIMIT 1`; if(u.length===0) return Response.json({error:"not found"},{status:404});
    const uid=Number((u[0] as {id:number}).id);
    const [coinsR,miningR,shopR,cosR,achR,frameR,txR]=await Promise.all([
      sql`SELECT balance FROM magnum_coins WHERE user_id=${uid} LIMIT 1`,
      sql`SELECT balance,upgrades FROM magnum_mining WHERE user_id=${uid} LIMIT 1`,
      sql`SELECT skin_id,equipped FROM magnum_shop_inventory WHERE user_id=${uid} AND equipped=true LIMIT 1`,
      sql`SELECT cosmetic_id,slot FROM magnum_cosmetics WHERE user_id=${uid} AND equipped=true`,
      sql`SELECT count(*)::int as c FROM magnum_user_achievements WHERE user_id=${uid}`,
      sql`SELECT verified FROM magnum_frames WHERE user_id=${uid} ORDER BY created_at DESC LIMIT 1`,
      sql`SELECT count(*)::int as c FROM magnum_transactions WHERE user_id=${uid}`,
    ]);
    const coins=coinsR.length?Number((coinsR[0] as {balance:number}).balance):1000;
    const mining=miningR.length?{balance:Number((miningR[0] as {balance:number}).balance),upgrades:(miningR[0] as {upgrades:unknown}).upgrades}:null;
    const avatar=shopR.length?String((shopR[0] as {skin_id:string}).skin_id):null;
    const cosmetics=(cosR as unknown[]).map((r:unknown)=>{const x=r as {cosmetic_id:string;slot:string}; return {cosmeticId:String(x.cosmetic_id),slot:String(x.slot)};});
    return Response.json({user:{id:uid,username:name,created_at:(u[0] as {created_at:string}).created_at},coins,balance:coins,mining,avatar,cosmetics,verified:frameR.length?Boolean((frameR[0] as {verified:boolean}).verified):false,counts:{achievements:Number(((achR[0] as {c:number}).c)),transactions:Number(((txR[0] as {c:number}).c))}});
  }catch(e){ console.error("[public profile] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleSearch(req: Request): Promise<Response> {
  const url=new URL(req.url); const q=url.searchParams.get("q")?.trim().slice(0,64)||""; if(!q||q.length<2) return Response.json({error:"q 2..64 required"},{status:400});
  const ip=getClientIp(req); if(!checkRateLimit(`search:${ip}`,20,60_000)) return Response.json({error:"rate limited"},{status:429});
  const like=`%${q}%`; const limit=Math.min(20,Math.max(1,Number(url.searchParams.get("limit")||10)));
  try{ const sql=getSql(); const [ideas,users]=await Promise.all([
    sql`SELECT id,title,votes,status FROM magnum_ideas WHERE title ILIKE ${like} OR description ILIKE ${like} ORDER BY votes DESC LIMIT ${limit}`,
    sql`SELECT username,created_at FROM magnum_users WHERE username ILIKE ${like} ORDER BY created_at DESC LIMIT ${limit}`,
  ]);
    return Response.json({q,ideas:ideas.map((r:unknown)=>{const x=r as {id:number;title:string;votes:number;status:string}; return {id:Number(x.id),title:String(x.title),votes:Number(x.votes||0),status:String(x.status||"pending")};}),users:users.map((r:unknown)=>{const x=r as {username:string;created_at:string}; return {username:String(x.username),created_at:x.created_at};}),count:{ideas:ideas.length,users:users.length}});
  }catch(e){ console.error("[search] failed",e); return Response.json({error:"db error"},{status:500}); }
}

// ---- Duel 2.0: rooms listing + stats + invites + ready/spectator WS ----
async function handleDuelRooms(): Promise<Response> {
  const list=[...rooms.values()].map(r=>({id:r.id,state:r.state,playerCount:r.players.size,players:[...r.players].map(ws=>({name:r.names.get(ws)??"Братуха",score:r.scores.get(ws)??0,ready:wsReady.get(ws)??false})),durationSec:r.durationSec,startedAt:r.startedAt}));
  return Response.json({rooms:list,count:list.length,active:list.filter(r=>r.state==="playing").length,waiting:list.filter(r=>r.state==="waiting").length});
}
async function handleDuelStats(): Promise<Response> {
  try{ const sql=getSql();
    const [hist,topWinners,recent]=await Promise.all([
      sql`SELECT count(*)::int as c, coalesce(avg(player_count),0)::float as avg_players, coalesce(max(duration_sec),0)::int as max_dur FROM magnum_duel_history`,
      sql`SELECT winner,count(*)::int as wins, max(created_at) as last_win FROM magnum_duel_history WHERE winner IS NOT NULL GROUP BY winner ORDER BY wins DESC LIMIT 10`,
      sql`SELECT room_id,winner,scores,player_count,created_at FROM magnum_duel_history ORDER BY created_at DESC LIMIT 5`,
    ]);
    const total=Number((hist[0] as {c:number}).c);
    return Response.json({total,avgPlayers:Number((hist[0] as {avg_players:number}).avg_players||0),maxDuration:Number((hist[0] as {max_dur:number}).max_dur||0),topWinners:topWinners.map((r:unknown)=>{const x=r as {winner:string;wins:number;last_win:string}; return {winner:String(x.winner),wins:Number(x.wins),lastWin:x.last_win};}),recent:recent.map((r:unknown)=>{const x=r as {room_id:string;winner:string|null;scores:unknown;player_count:number;created_at:string}; return {roomId:String(x.room_id),winner:x.winner,scores:x.scores,playerCount:Number(x.player_count),created_at:x.created_at};}),inMemory:{rooms:rooms.size,players:[...rooms.values()].reduce((s,r)=>s+r.players.size,0)}});
  }catch(e){ console.error("[duel stats] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleDuelLeaderboard(): Promise<Response> {
  try{ const sql=getSql();
    const enriched=await sql`SELECT h.winner, count(*)::int as wins, s.skin_id as avatar FROM magnum_duel_history h LEFT JOIN magnum_users u ON u.username=h.winner LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE h.winner IS NOT NULL GROUP BY h.winner, s.skin_id ORDER BY wins DESC LIMIT 20`;
    return Response.json({leaderboard:enriched.map((r:unknown)=>{const x=r as {winner:string;wins:number;avatar:string|null}; return {winner:String(x.winner),wins:Number(x.wins),avatar:x.avatar||null};}),count:enriched.length});
  }catch(e){ console.error("[duel lb] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleDuelInvites(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_duel_invites (id serial PRIMARY KEY, from_user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, to_user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, room_id text NOT NULL, status text DEFAULT 'pending' NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const url=new URL(req.url); const box=url.searchParams.get("box")==="sent"?"sent":"inbox";
    const rows=box==="sent"?await sql`SELECT i.id,i.room_id,i.status,i.created_at,u.username as other FROM magnum_duel_invites i JOIN magnum_users u ON u.id=i.to_user_id WHERE i.from_user_id=${user.id} ORDER BY i.created_at DESC LIMIT 20`
      :await sql`SELECT i.id,i.room_id,i.status,i.created_at,u.username as other FROM magnum_duel_invites i JOIN magnum_users u ON u.id=i.from_user_id WHERE i.to_user_id=${user.id} ORDER BY i.created_at DESC LIMIT 20`;
    return Response.json({invites:rows.map((r:unknown)=>{const x=r as {id:number;room_id:string;status:string;created_at:string;other:string}; return {id:Number(x.id),roomId:String(x.room_id),status:String(x.status),other:String(x.other),created_at:x.created_at};}),box,count:rows.length});
  }catch(e){ console.error("[duel invites] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleDuelSeasons(req: Request): Promise<Response> {
  try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_duel_seasons (id serial PRIMARY KEY, name text NOT NULL, starts_at timestamp DEFAULT now() NOT NULL, ends_at timestamp, created_at timestamp DEFAULT now() NOT NULL)`;
    const url=new URL(req.url); const limit=Math.min(20,Math.max(1,Number(url.searchParams.get("limit")||10)));
    const rows=await sql`SELECT id,name,starts_at,ends_at,created_at FROM magnum_duel_seasons ORDER BY starts_at DESC LIMIT ${limit}`;
    return Response.json({seasons:rows.map((r:unknown)=>{const x=r as {id:number;name:string;starts_at:string;ends_at:string|null;created_at:string}; return {id:Number(x.id),name:String(x.name),startsAt:x.starts_at,endsAt:x.ends_at,created_at:x.created_at};}),count:rows.length});
  }catch(e){ console.error("[duel seasons] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleDuelSeasonCreate(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`duel:season:${user.id}:${ip}`,6,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{name?:unknown;endsAt?:unknown}; try{ body=(await req.json()) as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const name=typeof body.name==="string"?body.name.trim().slice(0,64):""; if(!name||name.length<3) return Response.json({error:"name 3..64 required"},{status:400});
  if(name.includes("<")||name.includes(">")) return Response.json({error:"name no <>"},{status:400});
  try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_duel_seasons (id serial PRIMARY KEY, name text NOT NULL, starts_at timestamp DEFAULT now() NOT NULL, ends_at timestamp, created_at timestamp DEFAULT now() NOT NULL)`;
    const coinsR=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`; const bal=coinsR.length?Number((coinsR[0] as {balance:number}).balance):0;
    if(bal<1000 && !user.username.toLowerCase().includes("admin")) return Response.json({error:"needs 1000 coins or admin",balance:bal},{status:403});
    const rows=await sql`INSERT INTO magnum_duel_seasons (name,starts_at) VALUES (${name},now()) RETURNING id,name,starts_at,ends_at,created_at`;
    await logModeration(user.id,"duel_season","season",String((rows[0] as {id:number}).id),{name});
    return Response.json({ok:true,season:rows[0]},{status:201});
  }catch(e){ console.error("[duel season create] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleDuelInviteCreate(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`duel:invite:${user.id}:${ip}`,6,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{to?:unknown;username?:unknown;roomId?:unknown;wager?:unknown}; try{ body=(await req.json()) as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const toName=typeof body.to==="string"?body.to.trim():typeof body.username==="string"?body.username.trim():""; if(!toName||toName.length<2) return Response.json({error:"to username required"},{status:400});
  if(toName.toLowerCase()===user.username.toLowerCase()) return Response.json({error:"cannot invite self"},{status:400});
  const rawWager=Number(body.wager ?? 0); const wager=Number.isFinite(rawWager)?Math.max(0,Math.min(1420,Math.floor(rawWager))):0;
  if(wager>0 && ![0,42,142,420,1420].includes(wager)) return Response.json({error:"wager must be 0/42/142/420/1420"},{status:400});
  const roomId=typeof body.roomId==="string"?body.roomId.trim().slice(0,64):[...rooms.keys()][0]||`room-${Date.now().toString(36)}`;
  try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_duel_invites (id serial PRIMARY KEY, from_user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, to_user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, room_id text NOT NULL, status text DEFAULT 'pending' NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    if(wager>0){ const cr=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`; const bal=cr.length?Number((cr[0] as {balance:number}).balance):0; if(bal<wager) return Response.json({error:"not enough coins for wager",required:wager,balance:bal},{status:402}); await sql`UPDATE magnum_coins SET balance=balance-${wager} WHERE user_id=${user.id}`; await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-wager},'duel_wager_hold',${JSON.stringify({wager,roomId,to:toName})}::jsonb)`; }
    const toRows=await sql`SELECT id FROM magnum_users WHERE username=${toName} LIMIT 1`; if(toRows.length===0) return Response.json({error:"recipient not found"},{status:404});
    const toId=Number((toRows[0] as {id:number}).id);
    const rows=await sql`INSERT INTO magnum_duel_invites (from_user_id,to_user_id,room_id,status) VALUES (${user.id},${toId},${roomId},'pending') RETURNING id,room_id,status,created_at`;
    try{ await ensureNotification(toId,`Дуэль 42: вызов от ${user.username}`+(wager?` (ставка ${wager})`:""),`Братуха ${user.username} зовёт в дуэль — комната ${roomId}`+(wager?` • ставка ${wager} монет`:""),"duel"); }catch{}
    return Response.json({ok:true,invite:rows[0],wager},{status:201});
  }catch(e){ console.error("[duel invite create] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleDuelInviteRespond(req: Request, idStr: string): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const id=Number(idStr); if(!Number.isInteger(id)||id<=0) return Response.json({error:"invalid id"},{status:400});
  let body:{action?:unknown;status?:unknown}; try{ body=(await req.json()) as typeof body; }catch{ body={}; }
  const raw=String(body.action ?? body.status ?? "").trim().toLowerCase();
  const nextStatus=raw==="accept"||raw==="accepted"?"accepted":raw==="decline"||raw==="declined"||raw==="reject"?"declined":null;
  if(!nextStatus) return Response.json({error:"action must be accept|decline"},{status:400});
  const ip=getClientIp(req); if(!checkRateLimit(`duel:invite:respond:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{ const sql=getSql();
    const rows=await sql`SELECT id,from_user_id,to_user_id,room_id,status FROM magnum_duel_invites WHERE id=${id} LIMIT 1`;
    if(rows.length===0) return Response.json({error:"not found"},{status:404});
    const inv=rows[0] as {id:number;from_user_id:number;to_user_id:number;room_id:string;status:string};
    if(Number(inv.to_user_id)!==user.id && Number(inv.from_user_id)!==user.id) return Response.json({error:"forbidden"},{status:403});
    if(inv.status!=="pending") return Response.json({error:"already "+inv.status,status:inv.status},{status:409});
    if(Number(inv.to_user_id)!==user.id) return Response.json({error:"only recipient can respond"},{status:403});
    const upd=await sql`UPDATE magnum_duel_invites SET status=${nextStatus} WHERE id=${id} RETURNING id,room_id,status`;
    const otherId=Number(inv.from_user_id);
    try{ await ensureNotification(otherId,`Дуэль 42: ${nextStatus==="accepted"?"принят ✅":"отклонён ❌"}`, `Братуха ${user.username} ${nextStatus==="accepted"?"принял":"отклонил"} вызов — комната ${inv.room_id}`,"duel"); }catch{}
    // broadcast to room if exists
    const room=rooms.get(inv.room_id); if(room && nextStatus==="accepted") broadcast(room,{type:"invite_accepted",room:roomPublic(room),inviteId:id,by:user.username});
    return Response.json({ok:true,invite:upd[0]});
  }catch(e){ console.error("[duel invite respond] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleDuelSeasonTop(req: Request, idStr: string): Promise<Response> {
  const seasonId=Number(idStr); if(!Number.isInteger(seasonId)||seasonId<=0) return Response.json({error:"invalid season id"},{status:400});
  try{ const sql=getSql();
    const season=await sql`SELECT id,name,starts_at,ends_at FROM magnum_duel_seasons WHERE id=${seasonId} LIMIT 1`;
    if(season.length===0) return Response.json({error:"season not found"},{status:404});
    const s=season[0] as {id:number;name:string;starts_at:string;ends_at:string|null};
    const since=new Date(s.starts_at).toISOString();
    const endCond=s.ends_at?`AND h.created_at <= '${new Date(s.ends_at as string).toISOString()}'`:"";
    // winners in season window
    const top=await sql`SELECT h.winner, count(*)::int as wins, s2.skin_id as avatar FROM magnum_duel_history h LEFT JOIN magnum_users u ON u.username=h.winner LEFT JOIN magnum_shop_inventory s2 ON s2.user_id=u.id AND s2.equipped=true WHERE h.winner IS NOT NULL AND h.created_at >= ${since} GROUP BY h.winner,s2.skin_id ORDER BY wins DESC LIMIT 20`;
    const recent=await sql`SELECT room_id,winner,scores,player_count,created_at FROM magnum_duel_history WHERE created_at >= ${since} ORDER BY created_at DESC LIMIT 10`;
    return Response.json({season:{id:Number(s.id),name:String(s.name),startsAt:s.starts_at,endsAt:s.ends_at}, leaderboard: top.map((r:unknown)=>{const x=r as {winner:string;wins:number;avatar:string|null}; return {winner:String(x.winner),wins:Number(x.wins),avatar:x.avatar};}), recent: recent.map((r:unknown)=>{const x=r as {room_id:string;winner:string|null;scores:unknown;player_count:number;created_at:string}; return {roomId:x.room_id,winner:x.winner,scores:x.scores,playerCount:Number(x.player_count),created_at:x.created_at};}), count: top.length});
  }catch(e){ console.error("[duel season top] failed",e); return Response.json({error:"db error"},{status:500}); }
}
const MINING_BOOST_PRICE=142; const MINING_BOOST_MS=60_000; const miningBoostUntil=new Map<number,number>();
async function handleMiningBoost(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`mining:boost:${user.id}:${ip}`,6,60_000)) return Response.json({error:"rate limited"},{status:429});
  const now=Date.now(); const until=miningBoostUntil.get(user.id) ?? 0;
  if(now < until) return Response.json({ok:true,active:true,until,remainingMs:until-now,price:MINING_BOOST_PRICE});
  try{ const sql=getSql(); const cr=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`; const bal=cr.length?Number((cr[0] as {balance:number}).balance):0;
    if(bal < MINING_BOOST_PRICE) return Response.json({error:"not enough coins",required:MINING_BOOST_PRICE,balance:bal},{status:402});
    await sql`UPDATE magnum_coins SET balance=balance-${MINING_BOOST_PRICE} WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-MINING_BOOST_PRICE},'mining_boost',${JSON.stringify({price:MINING_BOOST_PRICE,durationMs:MINING_BOOST_MS})}::jsonb)`;
    const newUntil=now+MINING_BOOST_MS; miningBoostUntil.set(user.id,newUntil);
    const upd=await sql`UPDATE magnum_coins SET balance=balance WHERE user_id=${user.id} RETURNING balance`;
    return Response.json({ok:true,active:true,until:newUntil,remainingMs:MINING_BOOST_MS,price:MINING_BOOST_PRICE,balance: upd.length?Number((upd[0] as {balance:number}).balance):bal-MINING_BOOST_PRICE});
  }catch(e){ console.error("[mining boost] failed",e); return Response.json({error:"db error"},{status:500}); }
}
const wsReady=new Map<import("bun").ServerWebSocket<WSData>,boolean>();

async function handleHealth(): Promise<Response> {
  try {
    const sql = getSql();
    const [users, coins, mining, presave, ideas, daily, tx, votes, ach, notif, promos, gameScores, referrals, duels] = await Promise.all([
      sql`SELECT count(*)::int as c FROM magnum_users`,
      sql`SELECT count(*)::int as c FROM magnum_coins`,
      sql`SELECT count(*)::int as c FROM magnum_mining`,
      sql`SELECT count(*)::int as c FROM magnum_presave_clicks`,
      sql`SELECT count(*)::int as c FROM magnum_ideas`,
      sql`SELECT count(*)::int as c FROM magnum_daily_claims`,
      sql`SELECT count(*)::int as c FROM magnum_transactions`,
      sql`SELECT count(*)::int as c FROM magnum_idea_votes`,
      sql`SELECT count(*)::int as c FROM magnum_user_achievements`,
      sql`SELECT count(*)::int as c FROM magnum_notifications`,
      sql`SELECT count(*)::int as c FROM magnum_promo_codes`,
      sql`SELECT count(*)::int as c FROM magnum_game_scores`,
      sql`SELECT count(*)::int as c FROM magnum_referrals`,
      sql`SELECT count(*)::int as c FROM magnum_duel_history`,
    ]);
    let exchangesCount = 0; let commentsCount = 0; let reportsCount = 0; let modLogCount = 0; let chatCount = 0; let followsCount = 0; let aiUsageCount = 0;
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_mining_exchanges`; exchangesCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] mining_exchanges count failed", e); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_idea_comments`; commentsCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] idea_comments count failed", e); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_reports`; reportsCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] reports count failed", e); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_moderation_log`; modLogCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] mod_log count failed", e); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_chat_messages`; chatCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] chat_messages count failed", e); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_follows`; followsCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] follows count failed", e); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_ai_usage`; aiUsageCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] ai_usage count failed", e); }
    return Response.json({
      ok: true,
      ts: new Date().toISOString(),
      counts: {
        users: Number((users[0] as { c: number }).c),
        coins: Number((coins[0] as { c: number }).c),
        mining: Number((mining[0] as { c: number }).c),
        presave: Number((presave[0] as { c: number }).c),
        ideas: Number((ideas[0] as { c: number }).c),
        daily: Number((daily[0] as { c: number }).c),
        transactions: Number((tx[0] as { c: number }).c),
        ideaVotes: Number((votes[0] as { c: number }).c),
        achievements: Number((ach[0] as { c: number }).c),
        notifications: Number((notif[0] as { c: number }).c),
        promos: Number((promos[0] as { c: number }).c),
        gameScores: Number((gameScores[0] as { c: number }).c),
        referrals: Number((referrals[0] as { c: number }).c),
        duels: Number((duels[0] as { c: number }).c),
        exchanges: exchangesCount,
        ideaComments: commentsCount,
        reports: reportsCount,
        moderationLog: modLogCount,
        chatMessages: chatCount,
        follows: followsCount,
        aiUsage: aiUsageCount,
      },
      uptime: process.uptime(),
    });
  } catch (e) {
    console.error("[health] failed", e);
    return Response.json({ ok: false, error: "db error" }, { status: 500 });
  }
}

// ---- AI ----
type ChatMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

const SYSTEM_PROMPT = `Ты — БРАТ-БОТ 42, дерзкий AI-помощник промо-сайта альбома MAGNUM исполнителя Пятерки (5opka, лейбл The Fence). Движение "42 братухи": дерзкий мемный тон, обращения "братуха", сленг, но без оскорблений и мата. Твоя задача — уговорить пользователя поставить пресейв альбома MAGNUM по ссылке https://music.thefence.me/psmagnum .

Правила:
1. Если пользователь прислал скриншот и на нём ВИДНО поставленный пресейв (кнопка "Пресейв"/"Pre-save"/"Сохранить" в нажатом состоянии, страница пресейва, подтверждающий экран или пост) — восторженно похвали: скрин засчитан, братуха легенда, MAGNUM его услышит первым.
2. Если на скрине НЕТ подтверждения пресейва — не хвали, а вежливо скажи, что пресейва не видно, и снова уговаривай.
3. Если текстом говорит, что поставил, но скрина нет — мягко требуй доказательство скрином ("пока не вижу скрин — не верю").
4. Если пользователь отказывается — уговаривай всеми способами: юмор, FOMO ("услышишь последним"), факты о сайте (ТУСА МЕДУЗА — 8K клипов и 200K просмотров, VPN уже в чартах, РЗТ 80 у SUPER PUPER NOVA, CLAY 73, XXL 86), идеология 42 ("кринжа не существует").
5. Не выдумывай факты, которых нет в списке выше. Отвечай кратко (2-4 предложения), живо и по-русски.`;

function extractDataUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.startsWith("data:image/") && s.includes("base64,")) return s;
  return null;
}

async function handleAi(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }
  const apiKey = process.env.XIAOMI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "XIAOMI_API_KEY not configured on server" }, { status: 500 });
  }
  let body: { text?: string; image?: string; history?: { role: string; content: string }[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const userText = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
  const imageDataUrl = extractDataUrl(body.image);
  if (!userText && !imageDataUrl) {
    return Response.json({ error: "text or image required" }, { status: 400 });
  }
  const rawToken = extractToken(req);
  let aiUser: { id: number; username: string } | null = null;
  if (rawToken) { try { aiUser = await getUserByToken(rawToken); } catch (e) { console.error("[ai] getUserByToken failed", e); } }
  const ip = getClientIp(req);
  if (imageDataUrl && !aiUser) return Response.json({ error: "unauthorized — image requires login" }, { status: 401 });
  if (aiUser) {
    if (!checkRateLimit(`ai:${aiUser.id}:${ip}`, 10, 60_000)) {
      return Response.json({ error: "rate limited — попробуй через минуту, братуха", retryAfterSec: 60 }, { status: 429 });
    }
    if (imageDataUrl && !checkRateLimit(`ai:image:${aiUser.id}:${ip}`, 12, 60_000)) {
      return Response.json({ error: "image rate limited — 12/мин", retryAfterSec: 60 }, { status: 429 });
    }
  } else {
    if (!checkRateLimit(`ai:anon:${ip}`, 8, 60_000)) {
      return Response.json({ error: "rate limited — 8/мин для гостей, войди для 10/мин", retryAfterSec: 60 }, { status: 429 });
    }
  }

  // Neon ledger: fire-and-forget, не блокирует прокси, но сохраняет аудит трат
  const ledgerPromise = (async () => {
    try {
      const sql = getSql();
      const uid: number | null = aiUser?.id ?? null;
      await sql`INSERT INTO magnum_ai_usage (user_id, ip, has_image, model, tokens_requested) VALUES (${uid}, ${ip}, ${imageDataUrl ? true : false}, ${MIMO_MODEL}, 400)`;
    } catch (e) {
      // таблица может отсутствовать до применения миграции — молча игнор, есть in-memory rateLimit
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("magnum_ai_usage") && !msg.includes("does not exist")) console.error("[ai ledger] failed", e);
    }
  })();

  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  for (const h of body.history ?? []) {
    if ((h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
      messages.push({ role: h.role, content: h.content.slice(0, 1000) });
    }
  }

  if (imageDataUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userText || "Смотри на скрин. Поставил ли я пресейв MAGNUM? Ответь по правилам." },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    });
  } else {
    messages.push({ role: "user", content: userText });
  }

  const t0 = Date.now();
  try {
    const upstream = await fetch(`${MIMO_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MIMO_MODEL,
        messages,
        max_tokens: 400,
        temperature: 0.9,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error(`[ai-proxy] upstream ${upstream.status}: ${errText.slice(0, 300)} ip=${ip} user=${aiUser?.username ?? "anon"} image=${!!imageDataUrl}`);
      return Response.json({ error: `Upstream error ${upstream.status}` }, { status: 502 });
    }

    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return Response.json({ error: "Empty response" }, { status: 502 });
    }
    const dt = Date.now() - t0;
    console.log(`[ai-proxy] ok ${dt}ms ip=${ip} user=${aiUser?.username ?? "anon"} image=${!!imageDataUrl} tokens=${data.usage?.total_tokens ?? "?"}`);
    // дождаться ledger чтобы не терять аудит при быстром выходе (но не дольше 300мс)
    try { await Promise.race([ledgerPromise, new Promise(r => setTimeout(r, 300))]); } catch (e) { console.error("[ai ledger await] failed", e); }
    return Response.json({ text });
  } catch (e) {
    console.error("[ai-proxy] fetch failed:", e, `ip=${ip} user=${aiUser?.username ?? "anon"}`);
    try { await Promise.race([ledgerPromise, new Promise(r => setTimeout(r, 300))]); } catch (e) { console.error("[ai ledger await] failed", e); }
    return Response.json({ error: "Upstream unreachable" }, { status: 502 });
  }
}

// GET /magnum/api/ai/usage — свой аудит трат (auth, last 20)
async function handleAiUsage(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`ai:usage:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT ip, has_image, model, tokens_requested, created_at FROM magnum_ai_usage WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 20`;
    const total = await sql`SELECT count(*)::int as c FROM magnum_ai_usage WHERE user_id=${user.id}`;
    const today = await sql`SELECT count(*)::int as c FROM magnum_ai_usage WHERE user_id=${user.id} AND created_at > now() - interval '24 hours'`;
    return Response.json({
      usage: rows.map((r: unknown) => {
        const x = r as { ip: string; has_image: boolean; model: string; tokens_requested: number; created_at: string };
        return { hasImage: Boolean(x.has_image), model: String(x.model), tokensRequested: Number(x.tokens_requested), created_at: x.created_at };
      }),
      total: Number((total[0] as { c: number }).c),
      last24h: Number((today[0] as { c: number }).c),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("does not exist") || msg.includes("magnum_ai_usage")) {
      return Response.json({ usage: [], total: 0, last24h: 0, note: "migrate 0017 pending" });
    }
    console.error("[ai usage] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- WS duel helpers: anti-cheat click throttle per socket ----
const wsClickTimes = new Map<string, number[]>();
function wsRateOk(wsId: string): boolean {
  const now = Date.now();
  const arr = wsClickTimes.get(wsId) ?? [];
  const fresh = arr.filter(t => now - t < 1000);
  if (fresh.length >= 30) return false; // 30 clicks/sec max
  fresh.push(now);
  wsClickTimes.set(wsId, fresh);
  return true;
}
const wsChatTimes = new Map<string, number[]>();
function wsChatRateOk(wsId: string): boolean {
  const now = Date.now();
  const arr = wsChatTimes.get(wsId) ?? [];
  const fresh = arr.filter(t => now - t < 3000);
  if (fresh.length >= 5) return false; // 5 msg / 3s
  fresh.push(now);
  wsChatTimes.set(wsId, fresh);
  return true;
}

// ---- WebSocket duel (2-4 игрока) ----
type WSData = { id: string; username: string; roomId: string | null };

type DuelRoom = {
  id: string;
  players: Set<import("bun").ServerWebSocket<WSData>>;
  scores: Map<import("bun").ServerWebSocket<WSData>, number>;
  names: Map<import("bun").ServerWebSocket<WSData>, string>;
  state: "waiting" | "playing" | "finished";
  startedAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  durationSec: number;
};

const rooms = new Map<string, DuelRoom>();

function roomPublic(room: DuelRoom) {
  const players: Array<{ name: string; score: number; ready: boolean }> = [];
  for (const ws of room.players) {
    players.push({ name: room.names.get(ws) ?? "Братуха", score: room.scores.get(ws) ?? 0, ready: wsReady.get(ws) ?? false });
  }
  return { id: room.id, state: room.state, players, durationSec: room.durationSec };
}

function broadcast(room: DuelRoom, payload: unknown) {
  const msg = JSON.stringify(payload);
  for (const ws of room.players) {
    try { ws.send(msg); } catch (e) { console.error("[ws broadcast] send failed", e); }
  }
}

function findOrCreateRoom(): DuelRoom {
  for (const r of rooms.values()) {
    if (r.state === "waiting" && r.players.size < 4) return r;
  }
  const id = `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const room: DuelRoom = { id, players: new Set(), scores: new Map(), names: new Map(), state: "waiting", startedAt: null, timer: null, durationSec: 10 };
  rooms.set(id, room);
  return room;
}

async function persistDuelResults(room: DuelRoom) {
  try {
    const sql = getSql();
    const now = new Date().toISOString();
    const scoresJson: Array<{ name: string; score: number }> = [];
    let winner: string | null = null;
    let maxScore = -1;
    for (const ws of room.players) {
      const name = room.names.get(ws) ?? "Братуха";
      const score = room.scores.get(ws) ?? 0;
      scoresJson.push({ name, score });
      await sql`INSERT INTO magnum_leaderboard (player, score, game, created_at) VALUES (${name}, ${score}, 'duel', ${now})`;
      if (score > maxScore) { maxScore = score; winner = name; }
    }
    try {
      await sql`INSERT INTO magnum_duel_history (room_id, winner, scores, duration_sec, player_count) VALUES (${room.id}, ${winner}, ${JSON.stringify(scoresJson)}::jsonb, ${room.durationSec}, ${room.players.size})`;
    } catch (e) { console.error("[duel history insert] failed", e); }
  } catch (e) {
    console.error("[ws persist] failed", e);
  }
}

function startDuel(room: DuelRoom) {
  if (room.state === "playing") return;
  room.state = "playing";
  room.startedAt = Date.now();
  // reset scores for new round
  for (const ws of room.players) room.scores.set(ws, 0);
  broadcast(room, { type: "start", room: roomPublic(room), duration: room.durationSec });
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    room.state = "finished";
    broadcast(room, { type: "finish", room: roomPublic(room) });
    void persistDuelResults(room);
    // reset to waiting after 5s for rematch
    setTimeout(() => {
      room.state = "waiting";
      for (const ws of room.players) room.scores.set(ws, 0);
      broadcast(room, { type: "room", room: roomPublic(room) });
    }, 5000);
  }, room.durationSec * 1000);
}

// ---- Coins set (P0-2) ----
async function handleCoinsSet(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`coins:set:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { coins?: number; balance?: number; amount?: number; target?: number };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const raw = body.coins ?? body.balance ?? body.amount ?? body.target;
  const target = Number(raw);
  if (!Number.isFinite(target)) return Response.json({ error: "coins/target must be number" }, { status: 400 });
  const clamped = Math.max(0, Math.min(9_999_999, Math.round(target)));
  try {
    const sql = getSql();
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, ${clamped}) ON CONFLICT (user_id) DO UPDATE SET balance = ${clamped}`;
    return Response.json({ balance: clamped, coins: clamped });
  } catch (e) {
    console.error("[coins set] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

const server = Bun.serve<WSData>({
  port: Number(process.env.PORT) || 3000,
  development: process.env.NODE_ENV !== "production",
  async fetch(req, server) {
    const url = new URL(req.url);

    // upgrade WS — требует авторизацию, анонимов не пускаем
    if (url.pathname === "/magnum/api/ws" || url.pathname === "/magnum/api/ws/") {
      const token = extractToken(req);
      if (!token) return Response.json({ error: "unauthorized — войди, братуха" }, { status: 401 });
      let user: { id: number; username: string } | null = null;
      try { user = await getUserByToken(token); } catch (e) { console.error("[ws] getUserByToken failed", e); }
      if (!user) return Response.json({ error: "unauthorized — войди, братуха" }, { status: 401 });
      const ok = server.upgrade(req, { data: { id: String(user.id), username: user.username, roomId: null } });
      if (ok) return undefined as unknown as Response;
      return Response.json({ error: "Upgrade failed" }, { status: 426 });
    }

    // --- MAGNUM API ---
    if (url.pathname === "/magnum/api/ai/usage" && req.method === "GET") return handleAiUsage(req);
    if (url.pathname === "/magnum/api/ai") return handleAi(req);
    if (url.pathname === "/magnum/api/auth/register" && req.method === "POST") return handleRegister(req);
    if (url.pathname === "/magnum/api/auth/login" && req.method === "POST") return handleLogin(req);
    if (url.pathname === "/magnum/api/auth/me" && req.method === "GET") return handleMe(req);
    if (url.pathname === "/magnum/api/auth/logout" && req.method === "POST") return handleLogout(req);
    if (url.pathname === "/magnum/api/health" && req.method === "GET") return handleHealth();
    if (url.pathname === "/magnum/api/coins" && req.method === "GET") return handleCoinsGet(req);
    if (url.pathname === "/magnum/api/coins/top" && req.method === "GET") return handleCoinsTop();
    if (url.pathname === "/magnum/api/coins/add" && req.method === "POST") return handleCoinsAdd(req);
    if (url.pathname === "/magnum/api/coins/set" && req.method === "POST") return handleCoinsSet(req);
    if (url.pathname === "/magnum/api/coins/transfer" && req.method === "POST") return handleCoinsTransfer(req);
    if (url.pathname === "/magnum/api/transactions" && req.method === "GET") return handleTransactions(req);
    if (url.pathname === "/magnum/api/daily/status" && req.method === "GET") return handleDailyStatus(req);
    if (url.pathname === "/magnum/api/daily/claim" && req.method === "POST") return handleDailyClaim(req);
    if (url.pathname === "/magnum/api/presave/click" && req.method === "POST") return handlePresaveClick(req);
    if (url.pathname === "/magnum/api/presave/stats" && req.method === "GET") return handlePresaveStats(req);
    if (url.pathname === "/magnum/api/presave/leaderboard" && req.method === "GET") return handlePresaveLeaderboard();
    if (url.pathname === "/magnum/api/bandlink" && req.method === "GET") return handleBandlink();

    // ideas
    if (url.pathname === "/magnum/api/ideas/bookmarks" && req.method === "GET") return handleIdeaBookmarksGet(req);
    if (url.pathname === "/magnum/api/ideas" && req.method === "GET") return handleIdeasGet();
    if (url.pathname === "/magnum/api/ideas" && req.method === "POST") return handleIdeasPost(req);
    if (url.pathname.startsWith("/magnum/api/ideas/") && url.pathname.endsWith("/vote") && req.method === "POST") {
      const parts = url.pathname.split("/");
      const idStr = parts[4] ?? "";
      return handleIdeasVote(req, idStr);
    }
    if (url.pathname.startsWith("/magnum/api/ideas/") && url.pathname.endsWith("/bookmark") && req.method === "POST") {
      const parts = url.pathname.split("/");
      const idStr = parts[4] ?? "";
      return handleIdeaBookmark(req, idStr);
    }
    if (url.pathname.startsWith("/magnum/api/ideas/") && url.pathname.endsWith("/comments") && req.method === "GET") {
      const parts = url.pathname.split("/");
      const idStr = parts[4] ?? "";
      return handleIdeaCommentsGet(req, idStr);
    }
    if (url.pathname.startsWith("/magnum/api/ideas/") && url.pathname.endsWith("/comments") && req.method === "POST") {
      const parts = url.pathname.split("/");
      const idStr = parts[4] ?? "";
      return handleIdeaCommentPost(req, idStr);
    }

    // frame status (rating)
    if (url.pathname === "/magnum/api/frame/status" && req.method === "GET") return handleFrameStatus(req);
    if (url.pathname === "/magnum/api/frame/verify" && req.method === "POST") return handleFrameVerify(req);
    // eco leaderboard
    if (url.pathname === "/magnum/api/eco/leaderboard" && req.method === "GET") return handleEcoLeaderboard();
    if (url.pathname === "/magnum/api/eco/submit" && req.method === "POST") return handleEcoSubmit(req);
    if (url.pathname === "/magnum/api/eco/tiers" && req.method === "GET") return handleEcoTiers();
    if (url.pathname === "/magnum/api/eco/rating" && req.method === "GET") return handleEcoRatingTop();
    if (url.pathname === "/magnum/api/eco/rating" && req.method === "POST") return handleEcoRatingSubmit(req);

    // shop
    if (url.pathname === "/magnum/api/shop/buy" && req.method === "POST") return handleShopBuy(req);
    if (url.pathname === "/magnum/api/shop/equip" && req.method === "POST") return handleShopEquip(req);
    if (url.pathname === "/magnum/api/shop/unequip" && req.method === "POST") return handleShopUnequip(req);
    if (url.pathname === "/magnum/api/shop/purchase" && req.method === "POST") return handleShopBuy(req);
    if (url.pathname === "/magnum/api/shop/state" && req.method === "GET") return handleShopState(req);
    if (url.pathname === "/magnum/api/shop/equipped" && req.method === "GET") return handleShopEquipped(req);
    if (url.pathname === "/magnum/api/shop/inventory" && req.method === "GET") return handleShopInventory(req);
    if (url.pathname === "/magnum/api/shop/catalog" && req.method === "GET") return handleCosmeticCatalog();
    if (url.pathname === "/magnum/api/shop/cosmetic/buy" && req.method === "POST") return handleCosmeticBuy(req);
    if (url.pathname === "/magnum/api/shop/cosmetic/equip" && req.method === "POST") return handleCosmeticEquip(req);
    if (url.pathname === "/magnum/api/shop/cosmetic/inventory" && req.method === "GET") return handleCosmeticInventory(req);
    if (url.pathname === "/magnum/api/shop/bundles" && req.method === "GET") return handleShopBundleCatalog();
    if (url.pathname === "/magnum/api/shop/bundle/buy" && req.method === "POST") return handleShopBundleBuy(req);
    if (url.pathname === "/magnum/api/shop/prism" && req.method === "GET") return handlePrismCatalog();
    if (url.pathname === "/magnum/api/shop/dust" && req.method === "GET") return handleDustGet(req);
    if (url.pathname === "/magnum/api/shop/dismantle" && req.method === "POST") return handleDismantle(req);
    if (url.pathname === "/magnum/api/shop/craft" && req.method === "POST") return handlePrismCraft(req);
    if (url.pathname === "/magnum/api/shop/prism/craft" && req.method === "POST") return handlePrismCraft(req);

    // mining
    if (url.pathname === "/magnum/api/mining" && req.method === "GET") return handleMiningGet(req);
    if (url.pathname === "/magnum/api/mining/click" && req.method === "POST") return handleMiningClick(req);
    if (url.pathname === "/magnum/api/mining/upgrade" && req.method === "POST") return handleMiningUpgrade(req);
    if (url.pathname === "/magnum/api/mining/collect" && req.method === "POST") return handleMiningCollect(req);
    if (url.pathname === "/magnum/api/mining/top" && req.method === "GET") return handleMiningTop();
    if (url.pathname === "/magnum/api/mining/vault" && req.method === "GET") return handleMiningVaultGet(req);
    if (url.pathname === "/magnum/api/mining/vault/claim" && req.method === "POST") return handleMiningVaultClaim(req);
    if (url.pathname === "/magnum/api/mining/exchange" && req.method === "POST") return handleMiningExchange(req);

    // achievements + profile
    if (url.pathname === "/magnum/api/achievements/catalog" && req.method === "GET") return handleAchCatalog();
    if (url.pathname === "/magnum/api/achievements" && req.method === "GET") return handleAchGet(req);
    if (url.pathname === "/magnum/api/achievements/claim" && req.method === "POST") return handleAchClaim(req);
    if (url.pathname === "/magnum/api/profile" && req.method === "GET") return handleProfile(req);

    // notifications inbox
    if (url.pathname === "/magnum/api/notifications" && req.method === "GET") return handleNotificationsGet(req);
    if (url.pathname === "/magnum/api/notifications/read" && req.method === "POST") return handleNotificationsRead(req);
    if (url.pathname === "/magnum/api/notifications/clear" && req.method === "POST") return handleNotificationsClear(req);

    // promo codes
    if (url.pathname === "/magnum/api/promo/catalog" && req.method === "GET") return handlePromoCatalog();
    if (url.pathname === "/magnum/api/promo/redeem" && req.method === "POST") return handlePromoRedeem(req);
    if (url.pathname === "/magnum/api/promo/my" && req.method === "GET") return handlePromoMy(req);

    // games unified scoring (Neon, coins reward, rate limit)
    if (url.pathname === "/magnum/api/games/submit" && req.method === "POST") return handleGameSubmit(req);
    if (url.pathname === "/magnum/api/games/top" && req.method === "GET") return handleGameTop(req);
    if (url.pathname === "/magnum/api/games/my" && req.method === "GET") return handleGameMy(req);
    // referrals 42 (code = USERNAME+id36+42, reward 42 each)
    if (url.pathname === "/magnum/api/referral/code" && req.method === "GET") return handleReferralCode(req);
    if (url.pathname === "/magnum/api/referral/redeem" && req.method === "POST") return handleReferralRedeem(req);
    // duel history (persisted from WS)
    if (url.pathname === "/magnum/api/duel/history" && req.method === "GET") return handleDuelHistory(req);
    if (url.pathname === "/magnum/api/duel/rooms" && req.method === "GET") return handleDuelRooms();
    if (url.pathname === "/magnum/api/duel/stats" && req.method === "GET") return handleDuelStats();
    if (url.pathname === "/magnum/api/duel/leaderboard" && req.method === "GET") return handleDuelLeaderboard();
    if (url.pathname === "/magnum/api/duel/invites" && req.method === "GET") return handleDuelInvites(req);
    if (url.pathname === "/magnum/api/duel/invite" && req.method === "POST") return handleDuelInviteCreate(req);
    if (url.pathname === "/magnum/api/duel/seasons" && req.method === "GET") return handleDuelSeasons(req);
    if (url.pathname === "/magnum/api/duel/seasons" && req.method === "POST") return handleDuelSeasonCreate(req);
    if (url.pathname.startsWith("/magnum/api/duel/invite/") && url.pathname.endsWith("/respond") && req.method === "POST") { const parts=url.pathname.split("/"); const idStr=parts[5] ?? ""; return handleDuelInviteRespond(req,idStr); }
    if (url.pathname.startsWith("/magnum/api/duel/seasons/") && url.pathname.endsWith("/top") && req.method === "GET") { const parts=url.pathname.split("/"); const idStr=parts[4] ?? ""; return handleDuelSeasonTop(req,idStr); }
    if (url.pathname === "/magnum/api/mining/boost" && req.method === "POST") return handleMiningBoost(req);
    if (url.pathname === "/magnum/api/mining/boost" && req.method === "GET") return handleMiningBoost(req);
    // chat 42 persisted (Neon, rate limit 12/min, 1..500 char, no <>)
    if (url.pathname === "/magnum/api/chat" && req.method === "GET") return handleChatHistory(req);
    if (url.pathname === "/magnum/api/chat" && req.method === "POST") return handleChatSend(req);
    if (url.pathname.startsWith("/magnum/api/chat/") && req.method === "DELETE") { const parts=url.pathname.split("/"); const idStr=parts[4] ?? ""; return handleChatDelete(req,idStr); }
    // follows + feed (Neon, toggles, notifications)
    if (url.pathname === "/magnum/api/follow" && req.method === "POST") return handleFollowToggle(req);
    if (url.pathname === "/magnum/api/follows" && req.method === "GET") return handleFollowsList(req);
    if (url.pathname === "/magnum/api/feed" && req.method === "GET") return handleFeed(req);
    // reports + moderation + status workflow + public profile + search
    if (url.pathname === "/magnum/api/reports" && req.method === "POST") return handleReportCreate(req);
    if (url.pathname === "/magnum/api/reports" && req.method === "GET") return handleReportsGet(req);
    if (url.pathname.startsWith("/magnum/api/ideas/") && url.pathname.endsWith("/status") && req.method === "POST") {
      const parts = url.pathname.split("/"); const idStr = parts[4] ?? ""; return handleIdeaStatusPatch(req, idStr);
    }
    if (url.pathname === "/magnum/api/moderation/log" && req.method === "GET") return handleModerationLog(req);
    if (url.pathname.startsWith("/magnum/api/profile/") && req.method === "GET") {
      const name = url.pathname.replace("/magnum/api/profile/", "").split("/")[0] ?? ""; return handlePublicProfile(req, name);
    }
    if (url.pathname === "/magnum/api/search" && req.method === "GET") return handleSearch(req);

    if (url.pathname === "/magnum" || url.pathname.startsWith("/magnum/")) {
      const rel = url.pathname.replace(/^\/magnum\/?/, "");
      const clean = rel.replace(/\/$/, "");
      if (clean && !clean.includes("..")) {
        const f = Bun.file(import.meta.dir + "/dist/" + clean);
        if (await f.exists()) {
          return new Response(f, { headers: { "Content-Type": guessContentType(clean) } });
        }
        // P0 fix: /magnum/images/* must return 404 not SPA fallback (avoid soft-200 HTML for missing gallery images)
        if (clean.startsWith("images/") || clean.startsWith("magnum/images/")) {
          return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
        }
      }
      const index = Bun.file(import.meta.dir + "/dist/index.html");
      if (await index.exists()) return new Response(index, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      return new Response("dist/ not built — run bun run build.ts", { status: 500 });
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      const room = findOrCreateRoom();
      room.players.add(ws);
      room.scores.set(ws, 0);
      room.names.set(ws, ws.data.username);
      wsReady.set(ws,false);
      (ws.data as WSData).roomId = room.id;
      ws.subscribe(room.id);
      broadcast(room, { type: "room", room: roomPublic(room), you: ws.data.username, yourId: ws.data.id });
      // auto-start when 2+ players and waiting ~3s
      if (room.players.size >= 2 && room.state === "waiting") {
        setTimeout(() => {
          if (room.state === "waiting" && room.players.size >= 2) startDuel(room);
        }, 1500);
      }
    },
    message(ws, message) {
      const data = ws.data as WSData;
      const roomId = data.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(message));
      } catch {
        return;
      }
      const msg = parsed as { type?: string; username?: string; text?: string; message?: string };
      if (msg.type === "click") {
        if (room.state !== "playing") return;
        if (!wsRateOk(ws.data.id)) return; // anti-cheat throttle
        const cur = room.scores.get(ws) ?? 0;
        room.scores.set(ws, cur + 1);
        broadcast(room, { type: "scores", room: roomPublic(room) });
      } else if (msg.type === "chat") {
        const raw = typeof msg.text === "string" ? msg.text : typeof msg.message === "string" ? msg.message : "";
        const text = raw.trim().slice(0, 200);
        if (!text || text.length < 1) return;
        if (text.includes("<") || text.includes(">")) return;
        if (!wsChatRateOk(ws.data.id)) return;
        broadcast(room, { type: "chat", from: ws.data.username, text, at: new Date().toISOString() });
      } else if (msg.type === "start") {
        if (room.state === "waiting" && room.players.size >= 2) startDuel(room);
      } else if (msg.type === "join" && typeof msg.username === "string" && msg.username.trim()) {
        const name = msg.username.trim().slice(0, 24);
        room.names.set(ws, name);
        (ws.data as WSData).username = name;
        broadcast(room, { type: "room", room: roomPublic(room) });
      } else if (msg.type === "ready") {
        const cur=wsReady.get(ws)??false; wsReady.set(ws,!cur);
        broadcast(room, { type: "ready", from: ws.data.username, ready: !cur, room: roomPublic(room) });
        if (room.state==="waiting" && room.players.size>=2) {
          const allReady=[...room.players].every(p=>wsReady.get(p));
          if(allReady) startDuel(room);
        }
      } else if (msg.type === "reset") {
        for (const p of room.players) room.scores.set(p, 0);
        room.state = "waiting";
        if (room.timer) { clearTimeout(room.timer); room.timer = null; }
        broadcast(room, { type: "room", room: roomPublic(room) });
      } else if (msg.type === "spectate") {
        broadcast(room, { type: "spectate", from: ws.data.username, count: room.players.size, room: roomPublic(room) });
      } else if (msg.type === "typing") {
        const on = Boolean((msg as {on?:unknown}).on);
        broadcast(room, { type: "typing", from: ws.data.username, on });
      } else if (msg.type === "wager") {
        const wager = Math.max(0, Math.min(1420, Math.floor(Number((msg as {wager?:unknown}).wager ?? 0))));
        broadcast(room, { type: "wager", from: ws.data.username, wager });
      } else if (msg.type === "emote") {
        const emo = String((msg as {emoji?:unknown}).emoji ?? (msg as {emote?:unknown}).emote ?? "🔥").slice(0,4);
        if (emo.includes("<")||emo.includes(">")) return;
        broadcast(room, { type: "emote", from: ws.data.username, emoji: emo });
      }
    },
    close(ws) {
      const data = ws.data as WSData;
      const roomId = data.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      room.players.delete(ws);
      room.scores.delete(ws);
      room.names.delete(ws);
      wsReady.delete(ws);
      wsClickTimes.delete(ws.data.id);
      wsChatTimes.delete(ws.data.id);
      try { ws.unsubscribe(roomId); } catch (e) { console.error("[ws unsubscribe] failed", e); }
      if (room.players.size === 0) {
        if (room.timer) clearTimeout(room.timer);
        rooms.delete(roomId);
      } else {
        broadcast(room, { type: "room", room: roomPublic(room) });
        if (room.state === "playing" && room.players.size < 2) {
          // not enough players — end early and persist
          room.state = "finished";
          if (room.timer) clearTimeout(room.timer);
          broadcast(room, { type: "finish", room: roomPublic(room) });
          void persistDuelResults(room);
          setTimeout(() => {
            room.state = "waiting";
            for (const p of room.players) room.scores.set(p, 0);
            broadcast(room, { type: "room", room: roomPublic(room) });
          }, 3000);
        }
      }
    },
  },
});

function guessContentType(pathname: string): string {
  if (pathname.endsWith(".html") || pathname === "/magnum" || pathname === "/magnum/") return "text/html; charset=utf-8";
  if (pathname.endsWith(".js")) return "application/javascript";
  if (pathname.endsWith(".css")) return "text/css";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".xml")) return "application/xml";
  if (pathname.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

console.log(`MAGNUM server running at ${server.url}magnum/`);
