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
  } catch {}

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
  if (token) { try { authed = await getUserByToken(token); } catch {} }
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
    // anon: allow vote but rate limited by IP, no dedup persistence
    const rows = await sql`UPDATE magnum_ideas SET votes = COALESCE(votes,0) + 1 WHERE id = ${id} RETURNING *`;
    if (rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ idea: rows[0], anon: true });
  } catch (e) {
    console.error("[ideas vote] failed", e);
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
  // fallback pattern: infer by substring
  if (skinId.includes("1420") || skinId.includes("legendary")) return 1420;
  if (skinId.includes("420") || skinId.includes("epic")) return 420;
  if (skinId.includes("142") || skinId.includes("rare")) return 142;
  if (skinId.includes("42") || skinId.includes("common") || skinId.includes("basic")) return 42;
  // generic fallback 42 for any custom skin
  return 42;
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
];
function getCosmeticPrice(id: string): number | null { return COSMETICS_CATALOG.find(c=>c.id===id)?.price ?? null; }
function getCosmeticSlot(id: string): CosmeticSlot | null { return COSMETICS_CATALOG.find(c=>c.id===id)?.slot ?? null; }
function validateCosmeticId(id: unknown): string | null { if(typeof id!=="string") return null; const sv=id.trim(); if(!sv||sv.length>64||!/^[a-z0-9-]+$/.test(sv)) return null; return sv; }
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
    if (token) { try { user = await getUserByToken(token); } catch {} }
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
  if (token) { try { authedUser = await getUserByToken(token); } catch {} }
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
  // anonymous fallback (keep backwards compat) — but require player
  const player = typeof body.player === "string" ? body.player.trim().slice(0, 32) : typeof body.name === "string" ? body.name.trim().slice(0, 32) : typeof body.username === "string" ? body.username.trim().slice(0, 32) : "";
  if (!player || player.length < 2) return Response.json({ error: "player required" }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`INSERT INTO magnum_eco_results (player, score, rank) VALUES (${player}, ${Math.round(score)}, ${rank}) RETURNING *`;
    return Response.json({ ok: true, entry: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("[eco submit] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
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
    return Response.json({ balance: data.balance, upgrades: data.upgrades, perClick, perSec });
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
    const inc = perClickFrom(data.upgrades);
    const sql = getSql();
    const rows = await sql`UPDATE magnum_mining SET balance = balance + ${inc}, updated_at = now() WHERE user_id = ${user.id} RETURNING balance, upgrades`;
    const r = rows[0] as { balance: number; upgrades: unknown };
    return Response.json({ balance: Number(r.balance), upgrades: parseUpgrades(r.upgrades), added: inc });
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
  if (token) { try { const u = await getUserByToken(token); if (u) userId = u.id; } catch {} }
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
    if (token) { try { const u = await getUserByToken(token); if (u) { const mine = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id = ${u.id}`; myClicks = Number((mine[0] as { c: number }).c); } } catch {} }
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

async function handleHealth(): Promise<Response> {
  try {
    const sql = getSql();
    const [users, coins, mining, presave, ideas, daily, tx, votes, ach] = await Promise.all([
      sql`SELECT count(*)::int as c FROM magnum_users`,
      sql`SELECT count(*)::int as c FROM magnum_coins`,
      sql`SELECT count(*)::int as c FROM magnum_mining`,
      sql`SELECT count(*)::int as c FROM magnum_presave_clicks`,
      sql`SELECT count(*)::int as c FROM magnum_ideas`,
      sql`SELECT count(*)::int as c FROM magnum_daily_claims`,
      sql`SELECT count(*)::int as c FROM magnum_transactions`,
      sql`SELECT count(*)::int as c FROM magnum_idea_votes`,
      sql`SELECT count(*)::int as c FROM magnum_user_achievements`,
    ]);
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
      console.error(`[ai-proxy] upstream ${upstream.status}: ${errText.slice(0, 300)}`);
      return Response.json({ error: `Upstream error ${upstream.status}` }, { status: 502 });
    }

    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return Response.json({ error: "Empty response" }, { status: 502 });
    }
    return Response.json({ text });
  } catch (e) {
    console.error("[ai-proxy] fetch failed:", e);
    return Response.json({ error: "Upstream unreachable" }, { status: 502 });
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
  const players: Array<{ name: string; score: number }> = [];
  for (const ws of room.players) {
    players.push({ name: room.names.get(ws) ?? "Братуха", score: room.scores.get(ws) ?? 0 });
  }
  return { id: room.id, state: room.state, players, durationSec: room.durationSec };
}

function broadcast(room: DuelRoom, payload: unknown) {
  const msg = JSON.stringify(payload);
  for (const ws of room.players) {
    try { ws.send(msg); } catch {}
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
    for (const ws of room.players) {
      const name = room.names.get(ws) ?? "Братуха";
      const score = room.scores.get(ws) ?? 0;
      await sql`INSERT INTO magnum_leaderboard (player, score, game, created_at) VALUES (${name}, ${score}, 'duel', ${now})`;
    }
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

    // upgrade WS
    if (url.pathname === "/magnum/api/ws" || url.pathname === "/magnum/api/ws/") {
      const username = (url.searchParams.get("username") || url.searchParams.get("name") || "").trim().slice(0, 24) || `Братуха_${Math.floor(Math.random()*900+100)}`;
      // try token for auth name
      let authName: string | null = null;
      const token = extractToken(req);
      if (token) {
        try { const u = await getUserByToken(token); if (u) authName = u.username; } catch {}
      }
      const finalName = authName ?? username;
      const ok = server.upgrade(req, { data: { id: crypto.randomUUID(), username: finalName, roomId: null } });
      if (ok) return undefined as unknown as Response;
      return Response.json({ error: "Upgrade failed" }, { status: 426 });
    }

    // --- MAGNUM API ---
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

    // ideas
    if (url.pathname === "/magnum/api/ideas" && req.method === "GET") return handleIdeasGet();
    if (url.pathname === "/magnum/api/ideas" && req.method === "POST") return handleIdeasPost(req);
    if (url.pathname.startsWith("/magnum/api/ideas/") && url.pathname.endsWith("/vote") && req.method === "POST") {
      const parts = url.pathname.split("/");
      const idStr = parts[4] ?? "";
      return handleIdeasVote(req, idStr);
    }

    // frame status (rating)
    if (url.pathname === "/magnum/api/frame/status" && req.method === "GET") return handleFrameStatus(req);
    if (url.pathname === "/magnum/api/frame/verify" && req.method === "POST") return handleFrameVerify(req);
    // eco leaderboard
    if (url.pathname === "/magnum/api/eco/leaderboard" && req.method === "GET") return handleEcoLeaderboard();
    if (url.pathname === "/magnum/api/eco/submit" && req.method === "POST") return handleEcoSubmit(req);

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

    // mining
    if (url.pathname === "/magnum/api/mining" && req.method === "GET") return handleMiningGet(req);
    if (url.pathname === "/magnum/api/mining/click" && req.method === "POST") return handleMiningClick(req);
    if (url.pathname === "/magnum/api/mining/upgrade" && req.method === "POST") return handleMiningUpgrade(req);
    if (url.pathname === "/magnum/api/mining/collect" && req.method === "POST") return handleMiningCollect(req);
    if (url.pathname === "/magnum/api/mining/top" && req.method === "GET") return handleMiningTop();
    if (url.pathname === "/magnum/api/mining/vault" && req.method === "GET") return handleMiningVaultGet(req);
    if (url.pathname === "/magnum/api/mining/vault/claim" && req.method === "POST") return handleMiningVaultClaim(req);

    // achievements + profile
    if (url.pathname === "/magnum/api/achievements/catalog" && req.method === "GET") return handleAchCatalog();
    if (url.pathname === "/magnum/api/achievements" && req.method === "GET") return handleAchGet(req);
    if (url.pathname === "/magnum/api/achievements/claim" && req.method === "POST") return handleAchClaim(req);
    if (url.pathname === "/magnum/api/profile" && req.method === "GET") return handleProfile(req);

    if (url.pathname === "/magnum" || url.pathname.startsWith("/magnum/")) {
      const rel = url.pathname.replace(/^\/magnum\/?/, "");
      const clean = rel.replace(/\/$/, "");
      if (clean && !clean.includes("..")) {
        const f = Bun.file(import.meta.dir + "/dist/" + clean);
        if (await f.exists()) {
          return new Response(f, { headers: { "Content-Type": guessContentType(clean) } });
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
      const msg = parsed as { type?: string; username?: string };
      if (msg.type === "click") {
        if (room.state !== "playing") return;
        if (!wsRateOk(ws.data.id)) return; // anti-cheat throttle
        const cur = room.scores.get(ws) ?? 0;
        room.scores.set(ws, cur + 1);
        broadcast(room, { type: "scores", room: roomPublic(room) });
      } else if (msg.type === "start") {
        if (room.state === "waiting" && room.players.size >= 2) startDuel(room);
      } else if (msg.type === "join" && typeof msg.username === "string" && msg.username.trim()) {
        const name = msg.username.trim().slice(0, 24);
        room.names.set(ws, name);
        (ws.data as WSData).username = name;
        broadcast(room, { type: "room", room: roomPublic(room) });
      } else if (msg.type === "reset") {
        for (const p of room.players) room.scores.set(p, 0);
        room.state = "waiting";
        if (room.timer) { clearTimeout(room.timer); room.timer = null; }
        broadcast(room, { type: "room", room: roomPublic(room) });
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
      wsClickTimes.delete(ws.data.id);
      try { ws.unsubscribe(roomId); } catch {}
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
