/**
 * Прокси /magnum/api/ai → Xiaomi MiMo v2.5 (vision).
 * Ключ XIAOMI_API_KEY живёт ТОЛЬКО на сервере, в клиентский бандл не попадает.
 * + Кастом-авторизация MAGNUM (magnum_users/sessions/coins) без Neon Auth.
 * + Ideas / Mining / WebSocket duel (2-4 игрока) — всё в Neon, без localStorage.
 */

import { neon, Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { STUDIO_TRACKS, STUDIO_PRESETS, STUDIO_SCENE_DEFAULTS, STUDIO_BG_OPTIONS, STUDIO_FILTER_OPTIONS, isStudioTrackSlug, isStudioPresetId, getBpmForTrack, validateScenes } from "./src/lib/studio42.ts";
import { RARITY_TABLE, DUST_REWARD, GACHA_POOL, EVENT_LEGENDARY_POOL, STANDARD_LEGENDARY_POOL, softPityCurve, getLegendaryChance, rollWithPity, gachaPrice } from "./src/lib/gacha.ts";
try { (neonConfig as unknown as { webSocketConstructor?: unknown }).webSocketConstructor = ws; } catch {}

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
  let body: { username?: string; password?: string; referralCode?: string; referral_code?: string; code?: string; bratCode?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const referralRaw = typeof body.referralCode === "string" ? body.referralCode.trim() : typeof body.referral_code === "string" ? body.referral_code.trim() : typeof body.code === "string" ? body.code.trim() : typeof body.bratCode === "string" ? body.bratCode.trim() : "";
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
  // P1 funnel: auto daily streak 1 + 42 coins so health daily + transactions +1 on every new user
  try {
    await sql`INSERT INTO magnum_daily_claims (user_id, streak, reward) VALUES (${userId}, 1, 42)`;
    await sql`UPDATE magnum_coins SET balance = balance + 42 WHERE user_id = ${userId}`;
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${userId}, 42, 'daily', '{"streak":1,"auto":true}'::jsonb)`;
  } catch (e) { console.error("[register] daily seed failed", e); }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO magnum_sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresAt.toISOString()})`;

  // bratCode at register: both +42, idempotent
  if (referralRaw) {
    try {
      const raw = referralRaw.trim().toUpperCase().slice(0, 32);
      let inviterId: number | null = bratCodeToUserId(raw);
      if (inviterId === null && isOldReferralCode(raw)) {
        const without42 = raw.slice(0, -2);
        for (let len = 1; len <= 6; len++) {
          const cand = without42.slice(-len);
          const n = parseInt(cand, 36);
          if (!Number.isFinite(n) || n <= 0) continue;
          const u = await sql`SELECT id, username FROM magnum_users WHERE id=${n} LIMIT 1`;
          if (u.length === 0) continue;
          const uu = u[0] as { id:number; username:string };
          if (oldReferralCodeFor({ id:Number(uu.id), username:String(uu.username) }) === raw) { inviterId = Number(uu.id); break; }
        }
      }
      if (inviterId !== null && inviterId !== userId) {
        const exists = await sql`SELECT 1 FROM magnum_users WHERE id=${inviterId} LIMIT 1`;
        if (exists.length > 0) {
          try {
            await sql`INSERT INTO magnum_referrals (inviter_id, invited_id, code) VALUES (${inviterId}, ${userId}, ${raw})`;
            await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${userId}, 1000) ON CONFLICT (user_id) DO NOTHING`;
            await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${inviterId}, 1000) ON CONFLICT (user_id) DO NOTHING`;
            await sql`UPDATE magnum_coins SET balance = balance + 42 WHERE user_id=${userId}`;
            await sql`UPDATE magnum_coins SET balance = balance + 42 WHERE user_id=${inviterId}`;
            await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${userId}, 42, 'referral_in', ${JSON.stringify({ code: raw, inviter: inviterId })}::jsonb)`;
            await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${inviterId}, 42, 'referral_bonus', ${JSON.stringify({ invited: userId, code: raw })}::jsonb)`;
            try { await ensureNotification(inviterId, "БРАТУХА-КОД 42!", `Братуха ${username} ввёл твой код 42-${raw.slice(-4)} +42 обоим`, "referral"); } catch {}
          } catch (e) {
            const msg = String(e);
            if (!msg.includes("duplicate") && !msg.includes("23505")) console.error("[register referral] failed", e);
          }
        }
      }
    } catch (e) { console.error("[register referral] outer failed", e); }
  }

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
      // P1 funnel: +5 монет за голос (фикс zero funnel ideaVotes=0)
      try {
        await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${authed.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
        const upd = await sql`UPDATE magnum_coins SET balance = balance + 5 WHERE user_id=${authed.id} RETURNING balance`;
        const bal = upd.length ? Number((upd[0] as { balance: number }).balance) : 0;
        await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${authed.id}, 5, 'idea_vote', ${JSON.stringify({ ideaId: id })}::jsonb)`;
        return Response.json({ idea: rows[0], voted: true, coins: 5, balance: bal, reward: 5 });
      } catch (e) { console.warn("[ideas vote coins] failed", e); }
      return Response.json({ idea: rows[0], voted: true, coins: 5, reward: 5 });
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

// ---- Cosmetics shop — единый источник src/lib/cosmetics.ts (92 предмета, VOLCANO 12 + OBSIDIAN 12 molten) ----
import { GLACIER_CATALOG, GLACIER_IDS, isGlacierCosmetic, PRISM_CATALOG, PRISM_IDS, isPrismCosmetic, CRYSTAL_CATALOG, CRYSTAL_IDS, isCrystalCosmetic, VOLCANO_CATALOG, VOLCANO_IDS, isVolcanoCosmetic, OBSIDIAN_CATALOG, OBSIDIAN_IDS, isObsidianCosmetic } from "./src/lib/cosmetics.ts";
import { POINTS_CANON, MAP_POINT_IDS, isCorrectAnswer, isAllPointsDone } from "./src/lib/map42.ts";
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
  { id: "frame-void", slot: "frame", name: "Войд", price: 1420, rarity: "legendary", style: "4px solid #7a1ecb" },
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
  { id: "banner-nebula", slot: "banner", name: "Туманность", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#1b0a3a,#ff2d55)" },
  { id: "banner-grid", slot: "banner", name: "Сетка", price: 62, rarity: "common", style: "linear-gradient(90deg,#2e3238,#b8bcc4)" },
  { id: "banner-tiger", slot: "banner", name: "Тигр", price: 520, rarity: "epic", style: "linear-gradient(90deg,#8a3c00,#ffd76a)" },
  { id: "title-bra", slot: "title", name: "Братуха", price: 42, rarity: "common", style: "#9aa4b2" },
  { id: "title-42", slot: "title", name: "42 навсегда", price: 142, rarity: "rare", style: "#5865f2" },
  { id: "title-magnum", slot: "title", name: "MAGNUM", price: 420, rarity: "epic", style: "#ff44cc" },
  { id: "title-legend", slot: "title", name: "Легенда", price: 2042, rarity: "legendary", style: "#ffcc00" },
  { id: "title-neon", slot: "title", name: "Неоновый", price: 84, rarity: "common", style: "#00ffcc" },
  { id: "title-hype", slot: "title", name: "Хайп", price: 184, rarity: "rare", style: "#9147ff" },
  { id: "title-toxic", slot: "title", name: "Токсичный", price: 390, rarity: "epic", style: "#7cff00" },
  { id: "title-vip", slot: "title", name: "VIP 42", price: 1420, rarity: "legendary", style: "#ff2d55" },
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
  { id: "banner-prism-abyss", slot: "banner", name: "Призм Бездна", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#0a0a0a,#7a1ecb 30%,#ffcc00 70%,#ff44cc)" },
  { id: "title-prism-novice", slot: "title", name: "Призм Новичок", price: 22, rarity: "common", style: "#7dd8ff" },
  { id: "title-prism-hype", slot: "title", name: "Призм Хайп", price: 142, rarity: "rare", style: "#ff44cc" },
  { id: "title-prism-aurora", slot: "title", name: "Аврора", price: 420, rarity: "epic", style: "#9147ff" },
  { id: "title-prism-legend", slot: "title", name: "Призм Легенда", price: 2042, rarity: "legendary", style: "conic-gradient(from 0deg,#ffcc00,#ff44cc,#00ffcc,#ffcc00)" },
  // ── GLACIER VAULT 42 ── 12 glacier-скинов (common 42 / uncommon 142 / rare 420 / epic 1420) + frost ──
  { id: "frame-glacier-matte", slot: "frame", name: "Гляйшер Матт", price: 42, rarity: "common", style: "2px solid #e0faff" },
  { id: "banner-snow-dust", slot: "banner", name: "Снежная Пыль", price: 42, rarity: "common", style: "linear-gradient(90deg,#ffffff,#e0faff)" },
  { id: "title-ice-fence", slot: "title", name: "Ледяной Забор", price: 42, rarity: "common", style: "#b8e6fe" },
  { id: "frame-siberia-frost", slot: "frame", name: "Сибирь Фрост", price: 142, rarity: "rare", style: "3px solid #a5f3fc" },
  { id: "banner-tom-glacier", slot: "banner", name: "Том Гляйшер", price: 142, rarity: "rare", style: "linear-gradient(90deg,#06b6d4,#0891b2)" },
  { id: "title-kuzbass-ice", slot: "title", name: "Кузбасс Лёд", price: 142, rarity: "rare", style: "#0e7490" },
  { id: "frame-meduza-glacier", slot: "frame", name: "Медуза Гляйшер", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#a5f3fc,#06b6d4,#e0faff,#a5f3fc)" },
  { id: "banner-vpn-frost", slot: "banner", name: "ВПН Фрост", price: 420, rarity: "epic", style: "linear-gradient(90deg,#e0faff,#06b6d4)" },
  { id: "title-nova-tundra", slot: "title", name: "Нова Тундра", price: 420, rarity: "epic", style: "#7c3aed" },
  { id: "frame-gold-glacier-spin", slot: "frame", name: "Голд Гляйшер Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#e0faff,#06b6d4,#ffd700,#e0faff)" },
  { id: "banner-diamond-frost", slot: "banner", name: "Даймонд Фрост", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#e0faff,#ffffff)" },
  { id: "title-rgb-glacier", slot: "title", name: "РГБ Гляйшер", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#e0faff,#ff44cc,#00ffcc,#e0faff)" },
  // ── CRYSTAL VAULT 42 ── 12 crystal-скинов (common 42 / uncommon 142 / rare 420 / epic 1420) + quartz ──
  { id: "frame-crystal-matte", slot: "frame", name: "Кристалл Матт", price: 42, rarity: "common", style: "2px solid #e8f8ff" },
  { id: "banner-snow-quartz", slot: "banner", name: "Снежный Кварц", price: 42, rarity: "common", style: "linear-gradient(90deg,#ffffff,#e8f0ff)" },
  { id: "title-crystal-fence", slot: "title", name: "Кристалл Забор", price: 42, rarity: "common", style: "#b8e0ff" },
  { id: "frame-siberia-crystal", slot: "frame", name: "Сибирь Кристалл", price: 142, rarity: "rare", style: "3px solid #a8e8ff" },
  { id: "banner-tom-quartz", slot: "banner", name: "Том Кварц", price: 142, rarity: "rare", style: "linear-gradient(90deg,#38bdf8,#0ea5e9)" },
  { id: "title-taiga-crystal", slot: "title", name: "Тайга Кристалл", price: 142, rarity: "rare", style: "#0e7490" },
  { id: "frame-meduza-crystal", slot: "frame", name: "Медуза Кристалл", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#a8e8ff,#38bdf8,#e8f8ff,#a8e8ff)" },
  { id: "banner-vpn-quartz", slot: "banner", name: "ВПН Кварц", price: 420, rarity: "epic", style: "linear-gradient(90deg,#e8f8ff,#38bdf8)" },
  { id: "title-nova-crystal", slot: "title", name: "Нова Кристалл", price: 420, rarity: "epic", style: "#7c3aed" },
  { id: "frame-gold-crystal-spin", slot: "frame", name: "Голд Кристалл Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#e8f8ff,#38bdf8,#ffd700,#e8f8ff)" },
  { id: "banner-diamond-quartz", slot: "banner", name: "Даймонд Кварц", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#e8f8ff,#ffffff)" },
  { id: "title-rgb-crystal", slot: "title", name: "РГБ Кристалл", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#a8e8ff,#ff44cc,#00ffcc,#a8e8ff)" },
  // ── VOLCANO GOLD 42 — 12 volcano-скинов + eruption glow conic-volcano spin 3s #ff5722 ──
  { id: "frame-volcano-ash", slot: "frame", name: "Вулкан Пепел", price: 42, rarity: "common", style: "2px solid #ff5722" },
  { id: "banner-volcano-ash", slot: "banner", name: "Пепел Вулкана", price: 42, rarity: "common", style: "linear-gradient(90deg,#ff5722,#ff8a65)" },
  { id: "title-volcano-ash", slot: "title", name: "Пепельный", price: 42, rarity: "common", style: "#ff5722" },
  { id: "frame-volcano-lava", slot: "frame", name: "Вулкан Лава", price: 142, rarity: "rare", style: "3px solid #d32f2f" },
  { id: "banner-volcano-lava", slot: "banner", name: "Лава Вулкана", price: 142, rarity: "rare", style: "linear-gradient(90deg,#d32f2f,#ff5722)" },
  { id: "title-volcano-lava", slot: "title", name: "Лавовый", price: 142, rarity: "rare", style: "#d32f2f" },
  { id: "frame-volcano-eruption", slot: "frame", name: "Вулкан Извержение", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#ff5722,#ff8a65,#ff5722,#d32f2f,#ff5722)" },
  { id: "banner-volcano-eruption", slot: "banner", name: "Извержение", price: 420, rarity: "epic", style: "linear-gradient(90deg,#ff5722,#d32f2f)" },
  { id: "title-volcano-eruption", slot: "title", name: "Извергающий", price: 420, rarity: "epic", style: "#ff5722" },
  { id: "frame-volcano-gold-spin", slot: "frame", name: "Вулкан Голд Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff5722,#ffcc00,#ffd700,#ff5722)" },
  { id: "banner-volcano-gold", slot: "banner", name: "Голд Вулкан", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#ff5722,#ffd700)" },
  { id: "title-volcano-gold", slot: "title", name: "Вулкан Голд", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff5722,#ffcc00,#ffd700,#ff5722)" },
  // ── OBSIDIAN FORGE 42 — 12 obsidian: coal-dust 42 mine-shaft 142 meduza-obsidian 420 gold-obsidian-spin epic 1420 spin 3s molten ──
  { id: "frame-obsidian-coal", slot: "frame", name: "Обсидиан Уголь", price: 42, rarity: "common", style: "2px solid #1a1a1a" },
  { id: "banner-obsidian-dust", slot: "banner", name: "Угольная Пыль", price: 42, rarity: "common", style: "linear-gradient(90deg,#0a0a0a,#2b1a0a)" },
  { id: "title-obsidian-coal", slot: "title", name: "Угольный", price: 42, rarity: "common", style: "#1a1a1a" },
  { id: "frame-obsidian-shaft", slot: "frame", name: "Шахта Обсидиан", price: 142, rarity: "rare", style: "3px solid #4a2510" },
  { id: "banner-obsidian-shaft", slot: "banner", name: "Шахта", price: 142, rarity: "rare", style: "linear-gradient(90deg,#1a0a00,#ff4500)" },
  { id: "title-obsidian-shaft", slot: "title", name: "Шахтёр 42", price: 142, rarity: "rare", style: "#8b3a00" },
  { id: "frame-meduza-obsidian", slot: "frame", name: "Медуза Обсидиан", price: 420, rarity: "epic", style: "conic-gradient(from 0deg,#1a1a1a,#ff4500,#ff8c00,#1a1a1a)" },
  { id: "banner-meduza-obsidian", slot: "banner", name: "Медуза Расплав", price: 420, rarity: "epic", style: "linear-gradient(90deg,#1a1a1a,#ff5722)" },
  { id: "title-meduza-obsidian", slot: "title", name: "Расплавленный", price: 420, rarity: "epic", style: "#ff5722" },
  { id: "frame-gold-obsidian-spin", slot: "frame", name: "Голд Обсидиан Спин", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#1a1a1a,#ff4500,#ffcc00,#ffd700,#1a1a1a)" },
  { id: "banner-obsidian-gold", slot: "banner", name: "Золото Обсидиана", price: 1420, rarity: "legendary", style: "linear-gradient(90deg,#1a1a1a,#ffcc00)" },
  { id: "title-obsidian-gold", slot: "title", name: "Обсидиан Голд", price: 1420, rarity: "legendary", style: "conic-gradient(from 0deg,#ff4500,#ffcc00,#ffd700,#ff4500)" },
];
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
  // fast pre-check outside tx for UX (duplicate)
  try {
    const sql=getSql();
    const ex=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
    if(ex.length>0) return Response.json({error:"already owned",cosmeticId:raw},{status:409});
  } catch (e) { console.error("[cosmetic buy] precheck failed", e); return Response.json({error:"db error"},{status:500}); }
  // transactional path — protects verified -42 7d window + balance from parallel POST race
  const unpooled = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
  const doTransaction = async (): Promise<Response|null> => {
    if (!unpooled) return null;
    let pool: InstanceType<typeof Pool> | null = null;
    let client: { query: (q:string, p?:unknown[])=>Promise<{rows:unknown[]}>; release: ()=>void } | null = null;
    try {
      pool = new Pool({ connectionString: unpooled });
      client = await (pool as unknown as { connect: ()=>Promise<typeof client> }).connect() as typeof client;
      if (!client) return null;
      await client.query("BEGIN");
      // lock coins row for this user
      const balRes = await client.query("SELECT balance FROM magnum_coins WHERE user_id=$1 FOR UPDATE", [user.id]);
      let bal = 0;
      if (balRes.rows.length===0) {
        await client.query("INSERT INTO magnum_coins (user_id,balance) VALUES ($1,1000) ON CONFLICT (user_id) DO NOTHING", [user.id]);
        bal = 1000;
      } else bal = Number((balRes.rows[0] as {balance:number}).balance);
      // re-check ownership inside tx (TOCTOU guard)
      const ownedRes = await client.query("SELECT id FROM magnum_cosmetics WHERE user_id=$1 AND cosmetic_id=$2 LIMIT 1", [user.id, raw]);
      if (ownedRes.rows.length>0) {
        await client.query("ROLLBACK"); client.release(); await (pool as unknown as { end: ()=>Promise<void> }).end();
        return Response.json({error:"already owned",cosmeticId:raw},{status:409});
      }
      // verified -42/week discount — must be inside tx to prevent double-spend of 7d window
      let finalPrice = price;
      let discountApplied = 0;
      try {
        const vRes = await client.query("SELECT verified FROM magnum_frames WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1", [user.id]);
        const isVerified = vRes.rows.length>0 && Boolean((vRes.rows[0] as {verified:boolean}).verified);
        if (isVerified) {
          const lastDiscRes = await client.query("SELECT created_at FROM magnum_transactions WHERE user_id=$1 AND reason='cosmetic_discount' ORDER BY created_at DESC LIMIT 1", [user.id]);
          const canDiscount = lastDiscRes.rows.length===0 || (Date.now() - new Date((lastDiscRes.rows[0] as {created_at:string}).created_at).getTime() > 7*24*60*60*1000);
          if (canDiscount && finalPrice >= 42) { finalPrice = price - 42; discountApplied = 42; }
        }
      } catch (e) {
        console.error("[discount]", e);
      }
      if (bal < finalPrice) {
        await client.query("ROLLBACK"); client.release(); await (pool as unknown as { end: ()=>Promise<void> }).end();
        return Response.json({error:"not enough coins",price:finalPrice,originalPrice:price,discount:discountApplied,balance:bal,required:finalPrice},{status:402});
      }
      await client.query("UPDATE magnum_coins SET balance=balance-$1 WHERE user_id=$2", [finalPrice, user.id]);
      const updRes = await client.query("SELECT balance FROM magnum_coins WHERE user_id=$1 LIMIT 1", [user.id]);
      const newBal = Number((updRes.rows[0] as {balance:number}).balance);
      await client.query("INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES ($1,$2,$3,false,now())", [user.id, raw, slot]);
      if (discountApplied>0) {
        await client.query("INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES ($1,$2,'cosmetic_discount',$3::jsonb)", [user.id, -discountApplied, JSON.stringify({cosmeticId:raw, discount:discountApplied, originalPrice:price})]);
      }
      await client.query("COMMIT");
      client.release(); await (pool as unknown as { end: ()=>Promise<void> }).end();
      return Response.json({ok:true,cosmeticId:raw,slot,price:finalPrice,originalPrice:price,discount:discountApplied,balance:newBal});
    } catch (e) {
      try { if (client) await (client as unknown as { query:(q:string)=>Promise<void> }).query("ROLLBACK"); } catch {}
      try { if (client) (client as unknown as { release:()=>void }).release(); } catch {}
      try { if (pool) await (pool as unknown as { end:()=>Promise<void> }).end(); } catch {}
      // 42P01 and other DB errors fall through to fallback / logged
      console.error("[cosmetic buy] tx failed", e);
      return null;
    }
  };
  const txRes = await doTransaction();
  if (txRes) return txRes;
  // fallback — non-transactional path (e.g. in tests without DB / WS) with proper catch logging
  try{ const sql=getSql();
    const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    let bal=0; if(coins.length===0){ await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`; bal=1000; } else bal=Number((coins[0] as {balance:number}).balance);
    let finalPrice = price;
    let discountApplied = 0;
    try {
      const vrows = await sql`SELECT verified FROM magnum_frames WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 1`;
      const isVerified = vrows.length>0 && Boolean((vrows[0] as {verified:boolean}).verified);
      if (isVerified) {
        const lastDisc = await sql`SELECT created_at FROM magnum_transactions WHERE user_id=${user.id} AND reason='cosmetic_discount' ORDER BY created_at DESC LIMIT 1`;
        const canDiscount = lastDisc.length===0 || (Date.now() - new Date((lastDisc[0] as {created_at:string}).created_at).getTime() > 7*24*60*60*1000);
        if (canDiscount && finalPrice >= 42) { finalPrice = price - 42; discountApplied = 42; }
      }
    } catch (e) {
      console.error("[discount]", e);
    }
    if(bal<finalPrice) return Response.json({error:"not enough coins",price:finalPrice,originalPrice:price,discount:discountApplied,balance:bal,required:finalPrice},{status:402});
    await sql`UPDATE magnum_coins SET balance=balance-${finalPrice} WHERE user_id=${user.id}`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const newBal=Number((upd[0] as {balance:number}).balance);
    await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${raw},${slot},false,now())`;
    if (discountApplied>0) {
      await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-discountApplied},'cosmetic_discount',${JSON.stringify({cosmeticId:raw, discount:discountApplied, originalPrice:price})}::jsonb)`;
    }
    return Response.json({ok:true,cosmeticId:raw,slot,price:finalPrice,originalPrice:price,discount:discountApplied,balance:newBal});
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


async function handleShopSubscriptions(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    await ensureSubscriptionTable();
    const rows = await sql`SELECT tier FROM magnum_subscriptions WHERE user_id=${user.id} AND (ends_at IS NULL OR ends_at > now()) ORDER BY started_at DESC LIMIT 1`;
    const tier: string | null = rows.length ? String((rows[0] as { tier: string }).tier) : null;
    return Response.json({ tier, active: tier, subscription: tier });
  } catch (e) {
    console.error("[subscriptions] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleLog(req: Request): Promise<Response> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`log:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: unknown = null;
  try {
    const text = await req.text();
    const sliced = text.slice(0, 4000);
    try { body = JSON.parse(sliced); } catch { body = sliced; }
  } catch { body = null; }
  console.error("[client log]", body);
  return Response.json({ ok: true });
}

// ---- PRISM 42 — dust / dismantle / craft + /shop/prism & /shop/dust ----
async function ensureDustTable():Promise<void>{
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_dust (user_id integer primary key references magnum_users(id) on delete cascade, balance integer not null default 0, updated_at timestamp default now())`;
}
async function ensurePityTable(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_pity (user_id integer NOT NULL REFERENCES magnum_users(id) ON DELETE CASCADE, banner_type text NOT NULL, pity_counter integer DEFAULT 0 NOT NULL, pity_5star integer DEFAULT 0 NOT NULL, lost_50_50 boolean DEFAULT false NOT NULL, pulls integer DEFAULT 0 NOT NULL, updated_at timestamp DEFAULT now() NOT NULL, PRIMARY KEY (user_id, banner_type))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_magnum_pity_user ON magnum_pity (user_id)`;
}
// backfill job: one-shot scan of cosmetics → subscriptions for legacy VIP without row
export async function backfillSubscriptionsFromCosmetics(): Promise<{ scanned: number; backfilled: number }> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return { scanned: 0, backfilled: 0 };
  const sql=getSql();
  await ensureSubscriptionTable();
  // find users with cosmetics that imply tier but no active subscription
  const allCos = await sql`SELECT user_id, cosmetic_id FROM magnum_cosmetics WHERE cosmetic_id IN ('title-god','title-vip') OR cosmetic_id LIKE '%prism%'`;
  const byUser = new Map<number, string[]>();
  for (const r of allCos as { user_id:number; cosmetic_id:string }[]) {
    const arr = byUser.get(Number(r.user_id)) ?? [];
    arr.push(String(r.cosmetic_id));
    byUser.set(Number(r.user_id), arr);
  }
  let backfilled = 0;
  for (const [uid, ids] of byUser) {
    let derived: string|null=null;
    if (ids.includes("title-god")) derived="pro";
    else if (ids.some(id=>isPrismCosmetic(id))) derived="vip+";
    else if (ids.includes("title-vip")) derived="vip";
    if (!derived) continue;
    const active = await sql`SELECT 1 FROM magnum_subscriptions WHERE user_id=${uid} AND (ends_at IS NULL OR ends_at > now()) LIMIT 1`;
    if (active.length===0) {
      try { await sql`INSERT INTO magnum_subscriptions (user_id, tier, started_at) VALUES (${uid}, ${derived}, now())`; backfilled++; } catch (e) { console.error("[backfill] insert failed", e); }
    }
  }
  return { scanned: byUser.size, backfilled };
}
// startup ensure + backfill (non-blocking, logged)
void ensureDustTable().then(()=> console.log("[startup] magnum_dust ensured")).catch(e=> console.error("[startup] ensureDustTable failed", e));
void ensurePityTable().then(()=> console.log("[startup] magnum_pity ensured")).catch(e=> console.error("[startup] ensurePityTable failed", e));
void ensureSubscriptionTable().then(()=> console.log("[startup] magnum_subscriptions ensured")).catch(e=> console.error("[startup] ensureSubscriptionTable failed", e));
void backfillSubscriptionsFromCosmetics().then(r=> { if(r.backfilled) console.log(`[startup] subscriptions backfill ${r.backfilled}/${r.scanned}`); }).catch(e=> console.error("[startup] backfill failed", e));
// FRAME VOLCANO GOLD — ensure magnum_frames for mimo-v2.5 vision verify
void (async()=>{ try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_frames (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, verified boolean NOT NULL DEFAULT false, created_at timestamp DEFAULT now() NOT NULL)`; console.log("[startup] magnum_frames ensured"); }catch(e){ console.error("[startup] magnum_frames failed", e); } })();
function prismDismantleReward(rarity:CosmeticItem["rarity"]):number{
  if(rarity==="legendary") return 420;
  if(rarity==="epic") return 142;
  if(rarity==="rare") return 42;
  return 14;
}
function crystalDismantleReward(item: CosmeticItem): number {
  if (isCrystalCosmetic(item.id)) {
    if (item.rarity==="legendary") return 420;
    if (item.rarity==="epic") return 100;
    if (item.rarity==="rare") return 42;
    return 14;
  }
  if (isGlacierCosmetic(item.id)) {
    if (item.rarity==="legendary") return 420;
    if (item.rarity==="epic") return 100;
    if (item.rarity==="rare") return 42;
    return 14;
  }
  return prismDismantleReward(item.rarity);
}
function glacierDismantleReward(item: CosmeticItem): number {
  if (isGlacierCosmetic(item.id)) {
    if (item.rarity==="legendary") return 420;
    if (item.rarity==="epic") return 100;
    if (item.rarity==="rare") return 42;
    return 14;
  }
  return prismDismantleReward(item.rarity);
}
function volcanoDismantleReward(item: CosmeticItem): number {
  if (isVolcanoCosmetic(item.id)) {
    if (item.rarity==="legendary") return 420;
    if (item.rarity==="epic") return 100;
    if (item.rarity==="rare") return 42;
    return 14;
  }
  return crystalDismantleReward(item);
}
function obsidianDismantleReward(item: CosmeticItem): number {
  if (isObsidianCosmetic(item.id)) {
    if (item.rarity==="legendary") return 420;
    if (item.rarity==="epic") return 100;
    if (item.rarity==="rare") return 42;
    return 14;
  }
  return volcanoDismantleReward(item);
}
async function ensureSubscriptionTable(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_subscriptions (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES magnum_users(id) ON DELETE CASCADE, tier text NOT NULL, started_at timestamp NOT NULL DEFAULT now(), ends_at timestamp, created_at timestamp NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS idx_magnum_subscriptions_user ON magnum_subscriptions(user_id)`;
  // P0 42703: existing DB had old 4-col schema (user_id PK, tier, expires_at, created_at) — backfill missing cols + id PK drift
  await sql`ALTER TABLE magnum_subscriptions ADD COLUMN IF NOT EXISTS started_at timestamp DEFAULT now()`;
  await sql`ALTER TABLE magnum_subscriptions ADD COLUMN IF NOT EXISTS ends_at timestamp`;
  await sql`ALTER TABLE magnum_subscriptions ADD COLUMN IF NOT EXISTS id integer`;
  await sql`CREATE SEQUENCE IF NOT EXISTS magnum_subscriptions_id_seq`;
  await sql`ALTER TABLE magnum_subscriptions ALTER COLUMN id SET DEFAULT nextval('magnum_subscriptions_id_seq')`;
  await sql`UPDATE magnum_subscriptions SET id = nextval('magnum_subscriptions_id_seq') WHERE id IS NULL`;
  await sql`ALTER TABLE magnum_subscriptions ALTER COLUMN id SET NOT NULL`;
  // sync ends_at from legacy expires_at if exists
  await sql`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='magnum_subscriptions' AND column_name='expires_at') THEN EXECUTE 'UPDATE magnum_subscriptions SET ends_at = expires_at WHERE ends_at IS NULL AND expires_at IS NOT NULL'; END IF; END $$`;
  // ensure PK is on id (old table had user_id PK)
  await sql`DO $$ DECLARE pk_col text; BEGIN SELECT string_agg(a.attname, ',' ORDER BY a.attnum) INTO pk_col FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.conrelid='magnum_subscriptions'::regclass AND c.contype='p'; IF pk_col IS NULL OR pk_col <> 'id' THEN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='magnum_subscriptions'::regclass AND contype='p') THEN EXECUTE (SELECT 'ALTER TABLE "magnum_subscriptions" DROP CONSTRAINT "' || conname || '"' FROM pg_constraint WHERE conrelid='magnum_subscriptions'::regclass AND contype='p' LIMIT 1); END IF; CREATE UNIQUE INDEX IF NOT EXISTS "magnum_subscriptions_id_unique" ON magnum_subscriptions (id); EXECUTE 'ALTER TABLE magnum_subscriptions ADD PRIMARY KEY (id)'; END IF; END $$`;
}
function isGlacierEpicLegendary(id:string):boolean {
  const it = COSMETICS_CATALOG.find(c=>c.id===id);
  return !!it && isGlacierCosmetic(id) && (it.rarity==="legendary" || it.rarity==="epic");
}
function isCrystalEpicLegendary(id:string):boolean {
  const it = COSMETICS_CATALOG.find(c=>c.id===id);
  return !!it && isCrystalCosmetic(id) && (it.rarity==="legendary" || it.rarity==="epic");
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
  const reward=obsidianDismantleReward(item);
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

async function handleGlacierCatalog(): Promise<Response> {
  return Response.json({ catalog: GLACIER_CATALOG, count: GLACIER_CATALOG.length, dustCosts: { common:42, rare:142, epic:420, legendary:1420 } });
}

async function handleGlacierCraft(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`shop:glacier-craft:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{ targetId?:string; cosmeticId?:string; id?:string }; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=validateCosmeticId(body.targetId??body.cosmeticId??body.id??""); if(!raw) return Response.json({error:"targetId required"},{status:400});
  const target=COSMETICS_CATALOG.find(c=>c.id===raw); if(!target) return Response.json({error:"unknown cosmetic",cosmeticId:raw},{status:400});
  if(!isGlacierCosmetic(raw)) return Response.json({error:"only glacier craft allowed",cosmeticId:raw},{status:400});
  // only uncommon (rare) targets craftable via 3x common
  if(target.rarity!=="rare") return Response.json({error:"only uncommon (142) craftable via 3x common",cosmeticId:raw},{status:400});
  await ensureDustTable();
  const sql=getSql();
  const ex=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
  if(ex.length>0) return Response.json({error:"already owned",cosmeticId:raw},{status:409});
  const allRows = await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id}`;
  const ownedIds = new Set((allRows as {cosmetic_id:string}[]).map(r=>r.cosmetic_id));
  const commonGlacierIds = GLACIER_CATALOG.filter(c=>c.rarity==="common").map(c=>c.id);
  const ownedCommons = commonGlacierIds.filter(id=>ownedIds.has(id));
  if(ownedCommons.length < 3) return Response.json({error:"need 3 common glacier skins",owned:ownedCommons.length,required:3},{status:402});
  // fee 42 coins
  const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  let bal=coins.length? Number((coins[0] as {balance:number}).balance):0;
  if(bal < 42) return Response.json({error:"not enough coins",required:42,balance:bal},{status:402});
  await sql`UPDATE magnum_coins SET balance=balance-42 WHERE user_id=${user.id}`;
  // consume 3 common glacier skins (delete them)
  for(let i=0;i<3;i++){ const cid=ownedCommons[i]!; await sql`DELETE FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${cid}`; }
  await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${raw},${target.slot},false,now())`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-42},'glacier_craft',${JSON.stringify({target:raw, consumed:ownedCommons.slice(0,3)})}::jsonb)`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const newBal=Number((upd[0] as {balance:number}).balance);
  const inv=await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id} ORDER BY purchased_at ASC`;
  return Response.json({ ok:true, crafted:raw, slot:target.slot, cost:42, balance:newBal, consumed:ownedCommons.slice(0,3), inventory:(inv as {cosmetic_id:string}[]).map(r=>r.cosmetic_id) });
}
async function handleCrystalCatalog(): Promise<Response> {
  return Response.json({ catalog: CRYSTAL_CATALOG, count: CRYSTAL_CATALOG.length, dustCosts: { common:42, rare:142, epic:420, legendary:1420 } });
}
async function handleCrystalCraft(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`shop:crystal-craft:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{ targetId?:string; cosmeticId?:string; id?:string }; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=validateCosmeticId(body.targetId??body.cosmeticId??body.id??""); if(!raw) return Response.json({error:"targetId required"},{status:400});
  const target=COSMETICS_CATALOG.find(c=>c.id===raw); if(!target) return Response.json({error:"unknown cosmetic",cosmeticId:raw},{status:400});
  if(!isCrystalCosmetic(raw)) return Response.json({error:"only crystal craft allowed",cosmeticId:raw},{status:400});
  await ensureDustTable();
  const sql=getSql();
  const ex=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
  if(ex.length>0) return Response.json({error:"already owned",cosmeticId:raw},{status:409});
  const allRows = await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id}`;
  const ownedIds = new Set((allRows as {cosmetic_id:string}[]).map(r=>r.cosmetic_id));
  if(target.rarity==="rare"){
    const commonCrystalIds = CRYSTAL_CATALOG.filter(c=>c.rarity==="common").map(c=>c.id);
    const ownedCommons = commonCrystalIds.filter(id=>ownedIds.has(id));
    if(ownedCommons.length < 3) return Response.json({error:"need 3 common crystal skins",owned:ownedCommons.length,required:3},{status:402});
    const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    let bal=coins.length? Number((coins[0] as {balance:number}).balance):0;
    if(bal < 42) return Response.json({error:"not enough coins",required:42,balance:bal},{status:402});
    await sql`UPDATE magnum_coins SET balance=balance-42 WHERE user_id=${user.id}`;
    for(let i=0;i<3;i++){ const cid=ownedCommons[i]!; await sql`DELETE FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${cid}`; }
    await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${raw},${target.slot},false,now())`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-42},'crystal_craft',${JSON.stringify({target:raw, consumed:ownedCommons.slice(0,3)})}::jsonb)`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const newBal=Number((upd[0] as {balance:number}).balance);
    const inv=await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id} ORDER BY purchased_at ASC`;
    return Response.json({ ok:true, crafted:raw, slot:target.slot, cost:42, balance:newBal, consumed:ownedCommons.slice(0,3), inventory:(inv as {cosmetic_id:string}[]).map(r=>r.cosmetic_id) });
  }
  if(target.rarity==="epic"){
    const uncommonCrystalIds = CRYSTAL_CATALOG.filter(c=>c.rarity==="rare").map(c=>c.id);
    const ownedUncommons = uncommonCrystalIds.filter(id=>ownedIds.has(id));
    if(ownedUncommons.length < 3) return Response.json({error:"need 3 uncommon crystal skins",owned:ownedUncommons.length,required:3},{status:402});
    const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    let bal=coins.length? Number((coins[0] as {balance:number}).balance):0;
    if(bal < 142) return Response.json({error:"not enough coins",required:142,balance:bal},{status:402});
    await sql`UPDATE magnum_coins SET balance=balance-142 WHERE user_id=${user.id}`;
    for(let i=0;i<3;i++){ const cid=ownedUncommons[i]!; await sql`DELETE FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${cid}`; }
    await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${raw},${target.slot},false,now())`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-142},'crystal_craft',${JSON.stringify({target:raw, consumed:ownedUncommons.slice(0,3)})}::jsonb)`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const newBal=Number((upd[0] as {balance:number}).balance);
    const inv=await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id} ORDER BY purchased_at ASC`;
    return Response.json({ ok:true, crafted:raw, slot:target.slot, cost:142, balance:newBal, consumed:ownedUncommons.slice(0,3), inventory:(inv as {cosmetic_id:string}[]).map(r=>r.cosmetic_id) });
  }
  return Response.json({error:"only uncommon(142) and rare(420) craftable",cosmeticId:raw},{status:400});
}

async function handleVolcanoCatalog(): Promise<Response> {
  return Response.json({ catalog: VOLCANO_CATALOG, count: VOLCANO_CATALOG.length, dustCosts: { common:42, rare:142, epic:420, legendary:1420 } });
}
async function handleVolcanoCraft(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`shop:volcano-craft:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{ targetId?:string; cosmeticId?:string; id?:string }; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=validateCosmeticId(body.targetId??body.cosmeticId??body.id??""); if(!raw) return Response.json({error:"targetId required"},{status:400});
  const target=COSMETICS_CATALOG.find(c=>c.id===raw); if(!target) return Response.json({error:"unknown cosmetic",cosmeticId:raw},{status:400});
  if(!isVolcanoCosmetic(raw)) return Response.json({error:"only volcano craft allowed",cosmeticId:raw},{status:400});
  if(target.rarity!=="rare") return Response.json({error:"only uncommon (142) craftable via 3x common",cosmeticId:raw},{status:400});
  await ensureDustTable();
  const sql=getSql();
  const ex=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
  if(ex.length>0) return Response.json({error:"already owned",cosmeticId:raw},{status:409});
  const allRows = await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id}`;
  const ownedIds = new Set((allRows as {cosmetic_id:string}[]).map(r=>r.cosmetic_id));
  const commonVolcanoIds = VOLCANO_CATALOG.filter(c=>c.rarity==="common").map(c=>c.id);
  const ownedCommons = commonVolcanoIds.filter(id=>ownedIds.has(id));
  if(ownedCommons.length < 3) return Response.json({error:"need 3 common volcano skins",owned:ownedCommons.length,required:3},{status:402});
  const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  let bal=coins.length? Number((coins[0] as {balance:number}).balance):0;
  if(bal < 42) return Response.json({error:"not enough coins",required:42,balance:bal},{status:402});
  await sql`UPDATE magnum_coins SET balance=balance-42 WHERE user_id=${user.id}`;
  for(let i=0;i<3;i++){ const cid=ownedCommons[i]!; await sql`DELETE FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${cid}`; }
  await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${raw},${target.slot},false,now())`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-42},'volcano_craft',${JSON.stringify({target:raw, consumed:ownedCommons.slice(0,3)})}::jsonb)`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const newBal=Number((upd[0] as {balance:number}).balance);
  const inv=await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id} ORDER BY purchased_at ASC`;
  return Response.json({ ok:true, crafted:raw, slot:target.slot, cost:42, balance:newBal, consumed:ownedCommons.slice(0,3), inventory:(inv as {cosmetic_id:string}[]).map(r=>r.cosmetic_id) });
}

async function handleObsidianCatalog(): Promise<Response> {
  return Response.json({ catalog: OBSIDIAN_CATALOG, count: OBSIDIAN_CATALOG.length, dustCosts: { common:42, rare:142, epic:420, legendary:1420 } });
}
async function handleObsidianCraft(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`shop:obsidian-craft:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{ targetId?:string; cosmeticId?:string; id?:string }; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=validateCosmeticId(body.targetId??body.cosmeticId??body.id??""); if(!raw) return Response.json({error:"targetId required"},{status:400});
  const target=COSMETICS_CATALOG.find(c=>c.id===raw); if(!target) return Response.json({error:"unknown cosmetic",cosmeticId:raw},{status:400});
  if(!isObsidianCosmetic(raw)) return Response.json({error:"only obsidian craft allowed",cosmeticId:raw},{status:400});
  if(target.rarity!=="rare") return Response.json({error:"only uncommon (142) craftable via 3x common",cosmeticId:raw},{status:400});
  await ensureDustTable();
  const sql=getSql();
  const ex=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${raw} LIMIT 1`;
  if(ex.length>0) return Response.json({error:"already owned",cosmeticId:raw},{status:409});
  const allRows = await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id}`;
  const ownedIds = new Set((allRows as {cosmetic_id:string}[]).map(r=>r.cosmetic_id));
  const commonObsidianIds = OBSIDIAN_CATALOG.filter(c=>c.rarity==="common").map(c=>c.id);
  const ownedCommons = commonObsidianIds.filter(id=>ownedIds.has(id));
  if(ownedCommons.length < 3) return Response.json({error:"need 3 common obsidian skins",owned:ownedCommons.length,required:3},{status:402});
  const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  let bal=coins.length? Number((coins[0] as {balance:number}).balance):0;
  if(bal < 42) return Response.json({error:"not enough coins",required:42,balance:bal},{status:402});
  await sql`UPDATE magnum_coins SET balance=balance-42 WHERE user_id=${user.id}`;
  for(let i=0;i<3;i++){ const cid=ownedCommons[i]!; await sql`DELETE FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${cid}`; }
  await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${raw},${target.slot},false,now())`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-42},'obsidian_craft',${JSON.stringify({target:raw, consumed:ownedCommons.slice(0,3)})}::jsonb)`;
  const upd2=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const newBal2=Number((upd2[0] as {balance:number}).balance);
  const inv=await sql`SELECT cosmetic_id FROM magnum_cosmetics WHERE user_id=${user.id} ORDER BY purchased_at ASC`;
  return Response.json({ ok:true, crafted:raw, slot:target.slot, cost:42, balance:newBal2, consumed:ownedCommons.slice(0,3), inventory:(inv as {cosmetic_id:string}[]).map(r=>r.cosmetic_id) });
}

// ---- GACHA CORE 42 — pity 90/180 + 50/50 + soft-pity 65 + magnum_pity ----
async function handleGachaRoll(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`gacha:roll:${user.id}:${ip}`, 10, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { banner?: string; banner_type?: string; count?: number };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const rawBanner = String(body.banner ?? body.banner_type ?? "standard").trim().toLowerCase();
  const banner: BannerType = rawBanner === "event" ? "event" : "standard";
  const countRaw = Number(body.count ?? 1);
  const count: 1 | 10 = countRaw === 10 ? 10 : countRaw === 1 ? 1 : 0 as never;
  if (count !== 1 && count !== 10) return Response.json({ error: "count must be 1 or 10" }, { status: 400 });
  const price = gachaPrice(count);
  await ensurePityTable();
  await ensureDustTable();
  const sql = getSql();
  // check coins
  const coinsRows = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  let bal = coinsRows.length ? Number((coinsRows[0] as { balance: number }).balance) : 0;
  if (coinsRows.length === 0) {
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    const r = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    bal = r.length ? Number((r[0] as { balance: number }).balance) : 1000;
  }
  if (bal < price) return Response.json({ error: "not enough coins", price, balance: bal, required: price }, { status: 402 });
  // fetch pity row
  const pityRows = await sql`SELECT pity_counter, pity_5star, lost_50_50, pulls FROM magnum_pity WHERE user_id=${user.id} AND banner_type=${banner} LIMIT 1`;
  let pityCounter = 0, pity5star = 0, lost5050 = false, pulls = 0;
  if (pityRows.length > 0) {
    const r = pityRows[0] as { pity_counter: number; pity_5star: number; lost_50_50: boolean; pulls: number };
    pityCounter = Number(r.pity_counter); pity5star = Number(r.pity_5star); lost5050 = Boolean(r.lost_50_50); pulls = Number(r.pulls);
  }
  // deduct coins
  await sql`UPDATE magnum_coins SET balance = balance - ${price} WHERE user_id=${user.id}`;
  const results: { id: string; rarity: Rarity; isNew: boolean; dust: number; isEvent?: boolean }[] = [];
  let curPityCounter = pityCounter;
  let curPity5 = pity5star;
  let curLost = lost5050;
  let curPulls = pulls;
  for (let i = 0; i < count; i++) {
    const roll = rollWithPity(curPity5, banner, { pity4: curPityCounter, lost5050: curLost });
    const rarity = roll.rarity as Rarity;
    const id = roll.id;
    // duplicate check: owned in magnum_cosmetics or magnum_shop_inventory?
    let isNew = true;
    let dust = 0;
    // check cosmetics
    const ownedCos = await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${id} LIMIT 1`;
    const ownedInv = await sql`SELECT id FROM magnum_shop_inventory WHERE user_id=${user.id} AND skin_id=${id} LIMIT 1`;
    if (ownedCos.length > 0 || ownedInv.length > 0) {
      isNew = false;
      dust = DUST_REWARD[rarity] ?? 0;
      if (dust > 0) {
        await sql`INSERT INTO magnum_dust (user_id, balance) VALUES (${user.id}, ${dust}) ON CONFLICT (user_id) DO UPDATE SET balance = magnum_dust.balance + ${dust}, updated_at = now()`;
      }
    } else {
      // insert into appropriate inventory: cosmetics pool → magnum_cosmetics, otherwise magnum_shop_inventory
      const isCosmetic = (GACHA_POOL[rarity] as string[]).includes(id) || (Object.values(GACHA_POOL) as string[][]).some(a=>a.includes(id));
      // try cosmetics first: lookup style from server COSMETICS_CATALOG
      const cosItem = COSMETICS_CATALOG.find(c=>c.id===id);
      if (cosItem) {
        await sql`INSERT INTO magnum_cosmetics (user_id, cosmetic_id, slot, equipped, purchased_at) VALUES (${user.id}, ${id}, ${cosItem.slot}, false, now())`;
      } else {
        await sql`INSERT INTO magnum_shop_inventory (user_id, skin_id, purchased_at, equipped) VALUES (${user.id}, ${id}, now(), false)`;
      }
    }
    // update pity counters
    curPulls++;
    if (rarity === "legendary") {
      curPity5 = 0;
      curPityCounter = 0;
    } else if (rarity === "epic") {
      curPityCounter = 0;
      curPity5++;
    } else {
      curPityCounter++;
      curPity5++;
    }
    if (roll.nextLost5050 !== null) curLost = Boolean(roll.nextLost5050);
    results.push({ id, rarity, isNew, dust, isEvent: roll.isEvent });
  }
  // upsert pity
  await sql`INSERT INTO magnum_pity (user_id, banner_type, pity_counter, pity_5star, lost_50_50, pulls, updated_at) VALUES (${user.id}, ${banner}, ${curPityCounter}, ${curPity5}, ${curLost}, ${curPulls}, now()) ON CONFLICT (user_id, banner_type) DO UPDATE SET pity_counter=${curPityCounter}, pity_5star=${curPity5}, lost_50_50=${curLost}, pulls=${curPulls}, updated_at=now()`;
  await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${-price}, 'gacha_roll', ${JSON.stringify({ banner, count, price, results: results.map(r=>({id:r.id, rarity:r.rarity})) })}::jsonb)`;
  const balAfter = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const newBal = balAfter.length ? Number((balAfter[0] as { balance: number }).balance) : 0;
  const dustRows = await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
  const dustBal = dustRows.length ? Number((dustRows[0] as { balance: number }).balance) : 0;
  const guaranteeIn = {
    epic: Math.max(0, 90 - (curPityCounter + 1)),
    legendary: Math.max(0, 180 - (curPity5 + 1)),
  };
  // pity object for response (checker expects {pity, guaranteeIn})
  const pity = { counter: curPityCounter, pityCounter: curPityCounter, pity5star: curPity5, pity_5star: curPity5, lost_50_50: curLost, lost5050: curLost, pulls: curPulls, banner };
  return Response.json({ ok: true, results, pity, guaranteeIn, balance: newBal, dust: dustBal, banner, count, price });
}

async function handleGachaStatus(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const banner: BannerType = url.searchParams.get("banner") === "event" ? "event" : "standard";
  await ensurePityTable();
  const sql = getSql();
  const rows = await sql`SELECT pity_counter, pity_5star, lost_50_50, pulls FROM magnum_pity WHERE user_id=${user.id} AND banner_type=${banner} LIMIT 1`;
  if (rows.length === 0) return Response.json({ banner, pity: { counter: 0, pityCounter: 0, pity5star: 0, pity_5star: 0, lost_50_50: false, pulls: 0 }, guaranteeIn: { epic: 90, legendary: 180 } });
  const r = rows[0] as { pity_counter: number; pity_5star: number; lost_50_50: boolean; pulls: number };
  const pityCounter = Number(r.pity_counter); const pity5 = Number(r.pity_5star);
  return Response.json({ banner, pity: { counter: pityCounter, pityCounter, pity5star: pity5, pity_5star: pity5, lost_50_50: Boolean(r.lost_50_50), pulls: Number(r.pulls) }, guaranteeIn: { epic: Math.max(0, 90 - (pityCounter + 1)), legendary: Math.max(0, 180 - (pity5 + 1)) } });
}

async function handleGachaCatalog(): Promise<Response> {
  return Response.json({ rarities: RARITY_TABLE, dustReward: DUST_REWARD, pools: GACHA_POOL, eventLegendary: EVENT_LEGENDARY_POOL, standardLegendary: STANDARD_LEGENDARY_POOL, price: { single: 42, ten: 390 } });
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
async function ensureFrameTable(): Promise<void> {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_frames (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, verified boolean NOT NULL DEFAULT false, created_at timestamp DEFAULT now() NOT NULL)`;
}
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
    await ensureFrameTable();
    const sql = getSql();
    const rows = await sql`INSERT INTO magnum_frames (user_id, verified, created_at) VALUES (${user.id}, ${verified}, now()) RETURNING *`;
    return Response.json({ ok: true, frame: rows[0], verified });
  } catch (e) {
    console.error("[frame verify] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleFrameStatus(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  let user: { id: number; username: string } | null = null;
  try { user = await getUserByToken(token); } catch (e) { console.error("[frame status] getUserByToken failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    await ensureFrameTable();
    const sql = getSql();
    const rows = await sql`SELECT f.id, u.username, f.verified, f.created_at, s.skin_id as avatar FROM magnum_frames f LEFT JOIN magnum_users u ON u.id = f.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id = f.user_id AND s.equipped = true WHERE f.user_id = ${user.id} ORDER BY f.created_at DESC LIMIT 50`;
    const frames = rows.map((r: unknown) => {
      const x = r as { id: number; username: string; verified: boolean | null; created_at: string; avatar: string | null };
      return { id: Number(x.id), username: String(x.username || user!.username), verified: Boolean(x.verified), status: x.verified ? "verified" : "pending", created_at: x.created_at, avatar: x.avatar || null };
    });
    const verified = frames.filter(f => f.verified).length;
    // tier for FRAME VOLCANO GOLD — volcano-gold when verified, else none
    const tier = verified > 0 ? "volcano-gold" : "none";
    const tierLabel = verified > 0 ? "VOLCANO GOLD" : "NONE";
    return Response.json({ frames, total: frames.length, verified, pending: frames.length - verified, user: user.username, tier, tierLabel });
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
  if (!token) return Response.json({ error: "unauthorized — войди, братуха" }, { status: 401 });
  let authedUser: { id: number; username: string } | null = null;
  try { authedUser = await getUserByToken(token); } catch (e) { console.error("[eco submit] getUserByToken failed", e); }
  if (!authedUser) return Response.json({ error: "unauthorized — войди, братуха" }, { status: 401 });
  let body: { player?: string; name?: string; username?: string; score?: number; rank?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const score = Number(body.score);
  const rank = typeof body.rank === "string" ? body.rank.trim().slice(0, 32) : "pending";
  if (!Number.isFinite(score)) return Response.json({ error: "score required" }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`INSERT INTO magnum_eco_results (user_id, player, score, rank) VALUES (${authedUser.id}, ${authedUser.username}, ${Math.round(score)}, ${rank}) RETURNING *`;
    return Response.json({ ok: true, entry: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("[eco submit auth] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
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
  const token=extractToken(req); let user:{id:number;username:string}|null=null; if(token) try{user=await getUserByToken(token);}catch(e){ console.warn("[eco rating] getUserByToken failed", e instanceof Error ? e.message : String(e)); }
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

// ---- ECO LES 42 — Лес/Тайга/Кузбасс bio-вахта 7дн + freeze 420 1x/нед + share 1080 + economy 42/142/420 +1420 ----
function ecoWeekId(d=new Date()): string { const jan1=new Date(d.getFullYear(),0,1); const days=Math.floor((d.getTime()-jan1.getTime())/86400000); const w=Math.ceil((days+jan1.getDay()+1)/7); return `${d.getFullYear()}-W${String(w).padStart(2,"0")}`; }
function ecoTodayKey(d=new Date()): string { return d.toISOString().slice(0,10); }
async function ensureEcoChallengeTable(){ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_eco_challenges (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, week_id text NOT NULL, streak integer NOT NULL DEFAULT 0, freeze_used boolean NOT NULL DEFAULT false, last_claim_date text, streak_days jsonb DEFAULT '[]'::jsonb NOT NULL, updated_at timestamp DEFAULT now() NOT NULL)`; await sql`CREATE TABLE IF NOT EXISTS magnum_eco_shares (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, week_id text NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`; }
async function handleEcoChallengeGet(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({ weekId: ecoWeekId(), streak: 0, freezeUsed: false, canFreeze: false, streakDays: [], guest: true });
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({ weekId: ecoWeekId(), streak: 0, freezeUsed: false, canFreeze: false, streakDays: [] });
  await ensureEcoChallengeTable(); const sql=getSql(); const wk=ecoWeekId();
  const rows=await sql`SELECT week_id, streak, freeze_used, streak_days FROM magnum_eco_challenges WHERE user_id=${user.id} LIMIT 1`;
  if(rows.length===0) return Response.json({ weekId: wk, streak: 0, freezeUsed: false, canFreeze: true, streakDays: [] });
  const r=rows[0] as {week_id:string;streak:number;freeze_used:boolean;streak_days:unknown};
  if(r.week_id!==wk) return Response.json({ weekId: wk, streak: 0, freezeUsed: false, canFreeze: true, streakDays: [] });
  return Response.json({ weekId: r.week_id, streak: Number(r.streak), freezeUsed: Boolean(r.freeze_used), canFreeze: !r.freeze_used, streakDays: Array.isArray(r.streak_days)?r.streak_days:[] });
}
async function handleEcoChallengeClaim(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`eco:challenge:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{score?:unknown;answers?:unknown;boss?:unknown}; try{ body=await req.json() as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const score=validateEcoScore(body.score); if(score===null) return Response.json({error:"score -1000..1000"},{status:400});
  const isBoss=Boolean(body.boss);
  const today=ecoTodayKey(); const wk=ecoWeekId();
  await ensureEcoChallengeTable(); const sql=getSql();
  const rows=await sql`SELECT week_id, streak, freeze_used, last_claim_date, streak_days FROM magnum_eco_challenges WHERE user_id=${user.id} LIMIT 1`;
  let streak=0; let freeze_used=false; let last_claim=""; let streak_days: string[]=[];
  let week_id=wk;
  if(rows.length>0){ const r=rows[0] as {week_id:string;streak:number;freeze_used:boolean;last_claim_date:string|null;streak_days:unknown}; if(r.week_id===wk){ streak=Number(r.streak); freeze_used=Boolean(r.freeze_used); last_claim=String(r.last_claim_date||""); streak_days=Array.isArray(r.streak_days)?r.streak_days as string[]:[]; } }
  if(last_claim===today) return Response.json({ ok:false, alreadyClaimed:true, streak, weekId: wk, coins:0 });
  // streak increment
  const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1); const yKey=yesterday.toISOString().slice(0,10);
  let nextStreak=1;
  if(last_claim===yKey) nextStreak=Math.min(7, streak+1);
  else if(streak===0 || last_claim==="") nextStreak=1;
  else if(last_claim!==today) { // gap >1 day -> reset but freeze can save once per week
    if(freeze_used) { nextStreak=Math.min(7, streak+1); } else nextStreak=1;
  }
  if(!streak_days.includes(today)) streak_days=[...streak_days, today].slice(-7);
  // economy: 42/142/420 +1420 boss
  let coins=42; if(score>=200) coins=420; else if(score>=100) coins=142;
  if(isBoss) coins+=1420 - (coins===420?420:coins===142?142:42) + 0; // boss overrides to 1420 total
  if(isBoss) coins=1420;
  // grant coins
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+${coins} WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${coins},'eco_les',${JSON.stringify({score, boss:isBoss, streak: nextStreak, weekId: wk})}::jsonb)`;
  // upsert challenge
  await sql`INSERT INTO magnum_eco_challenges (user_id, week_id, streak, freeze_used, last_claim_date, streak_days, updated_at) VALUES (${user.id}, ${wk}, ${nextStreak}, ${freeze_used}, ${today}, ${JSON.stringify(streak_days)}::jsonb, now()) ON CONFLICT (user_id) DO UPDATE SET week_id=${wk}, streak=${nextStreak}, last_claim_date=${today}, streak_days=${JSON.stringify(streak_days)}::jsonb, updated_at=now()`;
  return Response.json({ ok:true, coins, streak: nextStreak, weekId: wk, boss: isBoss });
}
async function handleEcoFreeze(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`eco:freeze:${user.id}:${ip}`,5,60_000)) return Response.json({error:"rate limited"},{status:429});
  const wk=ecoWeekId(); await ensureEcoChallengeTable(); const sql=getSql();
  const rows=await sql`SELECT week_id, freeze_used FROM magnum_eco_challenges WHERE user_id=${user.id} LIMIT 1`;
  if(rows.length>0){ const r=rows[0] as {week_id:string;freeze_used:boolean}; if(r.week_id===wk && r.freeze_used) return Response.json({error:"freeze already used this week", weekId:wk},{status:409}); }
  // cost 420
  const coinsRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  let bal=coinsRows.length?Number((coinsRows[0] as {balance:number}).balance):1000;
  if(coinsRows.length===0) await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  if(bal<420) return Response.json({error:"not enough coins", required:420, balance:bal},{status:402});
  await sql`UPDATE magnum_coins SET balance=balance-420 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-420},'eco_freeze',${JSON.stringify({weekId:wk})}::jsonb)`;
  const existing=await sql`SELECT user_id FROM magnum_eco_challenges WHERE user_id=${user.id} LIMIT 1`;
  if(existing.length===0) await sql`INSERT INTO magnum_eco_challenges (user_id, week_id, streak, freeze_used, last_claim_date, streak_days) VALUES (${user.id}, ${wk}, 0, true, null, '[]'::jsonb)`;
  else await sql`UPDATE magnum_eco_challenges SET week_id=${wk}, freeze_used=true, updated_at=now() WHERE user_id=${user.id}`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, weekId:wk, balance: Number((upd[0] as {balance:number}).balance) });
}
async function handleEcoShare(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const wk=ecoWeekId(); await ensureEcoChallengeTable(); const sql=getSql();
  const today=ecoTodayKey();
  // 1 share per day guard via magnum_eco_shares
  const todayRows=await sql`SELECT id FROM magnum_eco_shares WHERE user_id=${user.id} AND week_id=${wk} AND created_at::date = ${today}::date LIMIT 1`;
  // allow 1 per day but give coins only once per day
  if(todayRows.length>0) return Response.json({ ok:false, error:"already shared today", coins:0 },{status:409});
  await sql`INSERT INTO magnum_eco_shares (user_id, week_id) VALUES (${user.id}, ${wk})`;
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'eco_share',${JSON.stringify({weekId:wk})}::jsonb)`;
  return Response.json({ ok:true, coins:42, weekId:wk });
}

// ---- MAP KUZBASS 42 — 5 точек ×2Q + босс +1420 + streak 7дн + freeze 420 + OG 1080 + vision verify ----
// MAP канон теперь в src/lib/map42.ts (POINTS_CANON) — единый источник true ответов
const MAP_POINTS = MAP_POINT_IDS as unknown as readonly string[] as typeof MAP_POINT_IDS;
type MapPointId = typeof MAP_POINT_IDS[number];
function isMapPoint(v:string): boolean { return (MAP_POINT_IDS as readonly string[]).includes(v); }
async function ensureMapTable(): Promise<void> {
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_map_progress (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, points jsonb NOT NULL DEFAULT '{}'::jsonb, completed integer NOT NULL DEFAULT 0, streak integer NOT NULL DEFAULT 0, week_id text NOT NULL DEFAULT '', freeze_used boolean NOT NULL DEFAULT false, last_claim_date text, streak_days jsonb NOT NULL DEFAULT '[]'::jsonb, boss_done boolean NOT NULL DEFAULT false, updated_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_map_events (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, point_id text NOT NULL, q integer NOT NULL DEFAULT 0, correct boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_map_shares (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, week_id text NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_map_events_user_point ON magnum_map_events(user_id, point_id)`;
  // migrate missing cols for old table created via spec literal
  await sql`ALTER TABLE magnum_map_progress ADD COLUMN IF NOT EXISTS boss_done boolean DEFAULT false`;
  await sql`ALTER TABLE magnum_map_progress ADD COLUMN IF NOT EXISTS freeze_used boolean DEFAULT false`;
  await sql`ALTER TABLE magnum_map_progress ADD COLUMN IF NOT EXISTS streak_days jsonb DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE magnum_map_progress ADD COLUMN IF NOT EXISTS last_claim_date text`;
  await sql`ALTER TABLE magnum_map_progress ADD COLUMN IF NOT EXISTS week_id text DEFAULT ''`;
}
function mapWeekId(d=new Date()): string { const jan1=new Date(d.getFullYear(),0,1); const days=Math.floor((d.getTime()-jan1.getTime())/86400000); const w=Math.ceil((days+jan1.getDay()+1)/7); return `${d.getFullYear()}-W${String(w).padStart(2,"0")}`; }
function mapTodayKey(d=new Date()): string { return d.toISOString().slice(0,10); }
async function handleMapProgress(req: Request): Promise<Response> {
  const token=extractToken(req);
  const wk=mapWeekId();
  if(!token){
    return Response.json({ points:{}, completed:0, streak:0, weekId:wk, freezeUsed:false, canFreeze:false, streakDays:[], bossDone:false, guest:true });
  }
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{}
  if(!user) return Response.json({ points:{}, completed:0, streak:0, weekId:wk, freezeUsed:false, canFreeze:false, streakDays:[], bossDone:false });
  await ensureMapTable(); const sql=getSql();
  const rows=await sql`SELECT points, completed, streak, week_id, freeze_used, streak_days, boss_done FROM magnum_map_progress WHERE user_id=${user.id} LIMIT 1`;
  if(rows.length===0){
    return Response.json({ points:{}, completed:0, streak:0, weekId:wk, freezeUsed:false, canFreeze:true, streakDays:[], bossDone:false });
  }
  const r=rows[0] as {points:unknown;completed:number;streak:number;week_id:string;freeze_used:boolean;streak_days:unknown;boss_done:boolean};
  const points = (r.points && typeof r.points==="object" && !Array.isArray(r.points)) ? r.points as Record<string,boolean> : {};
  const weekId = String(r.week_id||wk);
  if(weekId!==wk){
    return Response.json({ points, completed:Number(r.completed||0), streak:0, weekId:wk, freezeUsed:false, canFreeze:true, streakDays:[], bossDone: Boolean(r.boss_done) });
  }
  return Response.json({ points, completed:Number(r.completed||0), streak:Number(r.streak||0), weekId, freezeUsed:Boolean(r.freeze_used), canFreeze:!r.freeze_used, streakDays: Array.isArray(r.streak_days)?r.streak_days:[], bossDone: Boolean(r.boss_done) });
}
async function handleMapAnswer(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`map:answer:${user.id}:${ip}`,20,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{pointId?:string; answerId?:string}; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const pid=String(body.pointId||"").trim().toLowerCase(); if(!isMapPoint(pid)) return Response.json({error:"pointId kemerovo|novokuznetsk|belovo|prokopievsk|mezhdurechensk"},{status:400});
  const answerId=String((body as {answerId?:unknown}).answerId ?? "").trim(); if(!answerId) return Response.json({error:"answerId required"},{status:400});
  if(!isCorrectAnswer(pid, answerId)) return Response.json({error:"wrong answer", pointId:pid},{status:400});
  await ensureMapTable(); const sql=getSql(); const wk=mapWeekId(); const today=mapTodayKey();
  await sql`BEGIN`;
  try{
    const rows=await sql`SELECT points, completed, streak, week_id, freeze_used, last_claim_date, streak_days, boss_done FROM magnum_map_progress WHERE user_id=${user.id} LIMIT 1 FOR UPDATE`;
    let points: Record<string,boolean>={}; let completed=0; let streak=0; let freeze_used=false; let last_claim=""; let streak_days:string[]=[]; let boss_done=false; let week_id=wk;
    if(rows.length>0){
      const r=rows[0] as {points:unknown;completed:number;streak:number;week_id:string;freeze_used:boolean;last_claim_date:string|null;streak_days:unknown;boss_done:boolean};
      points=(r.points && typeof r.points==="object" && !Array.isArray(r.points)) ? r.points as Record<string,boolean> : {};
      completed=Number(r.completed||0); streak=Number(r.streak||0); week_id=String(r.week_id||wk); freeze_used=Boolean(r.freeze_used); last_claim=String(r.last_claim_date||""); streak_days=Array.isArray(r.streak_days)?r.streak_days as string[]:[]; boss_done=Boolean(r.boss_done);
      if(week_id!==wk){ points={}; completed=0; streak=0; freeze_used=false; streak_days=[]; week_id=wk; last_claim=""; }
    }
    if(points[pid]){ await sql`ROLLBACK`; return Response.json({error:"already completed", pointId:pid, points, completed},{status:409}); }
    // also check magnum_map_events unique guard (race via direct insert)
    const dupEvent=await sql`SELECT id FROM magnum_map_events WHERE user_id=${user.id} AND point_id=${pid} LIMIT 1 FOR UPDATE`;
    if(dupEvent.length>0){ await sql`ROLLBACK`; return Response.json({error:"already completed", pointId:pid, points, completed},{status:409}); }
    // mark point done
    points[pid]=true; completed=Object.keys(points).filter(k=>points[k]).length;
    // streak update
    const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1); const yKey=yesterday.toISOString().slice(0,10);
    let nextStreak=1;
    if(last_claim===yKey) nextStreak=Math.min(7, streak+1);
    else if(last_claim===today) nextStreak=streak;
    else if(streak===0 || last_claim==="") nextStreak=1;
    else if(last_claim!==today){ if(freeze_used) nextStreak=Math.min(7, streak+1); else nextStreak=1; }
    if(!streak_days.includes(today)) streak_days=[...streak_days, today].slice(-7);
    let coins=42;
    if(completed===5) coins+=142;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    // lock coins row for this user to serialize balance updates
    await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} FOR UPDATE`;
    await sql`UPDATE magnum_coins SET balance=balance+${coins} WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${coins},'map_point',${JSON.stringify({pointId:pid, completed, streak:nextStreak, weekId:wk})}::jsonb)`;
    // use ON CONFLICT DO NOTHING for idempotence; if conflict, rollback and 409
    const ev=await sql`INSERT INTO magnum_map_events (user_id, point_id, q, correct) VALUES (${user.id}, ${pid}, 2, true) ON CONFLICT (user_id, point_id) DO NOTHING RETURNING id`;
    if(ev.length===0){ await sql`ROLLBACK`; return Response.json({error:"already completed", pointId:pid},{status:409}); }
    await sql`INSERT INTO magnum_map_progress (user_id, points, completed, streak, week_id, freeze_used, last_claim_date, streak_days, boss_done, updated_at) VALUES (${user.id}, ${JSON.stringify(points)}::jsonb, ${completed}, ${nextStreak}, ${wk}, ${freeze_used}, ${today}, ${JSON.stringify(streak_days)}::jsonb, ${boss_done}, now()) ON CONFLICT (user_id) DO UPDATE SET points=${JSON.stringify(points)}::jsonb, completed=${completed}, streak=${nextStreak}, week_id=${wk}, last_claim_date=${today}, streak_days=${JSON.stringify(streak_days)}::jsonb, updated_at=now()`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    await sql`COMMIT`;
    return Response.json({ ok:true, pointId:pid, points, completed, streak:nextStreak, weekId:wk, coins, balance: Number((upd[0] as {balance:number}).balance), bossAvailable: completed===5 && !boss_done });
  }catch(e){ try{ await sql`ROLLBACK`; }catch{} throw e; }
}
async function handleMapBoss(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`map:boss:${user.id}:${ip}`,8,60_000)) return Response.json({error:"rate limited"},{status:429});
  await ensureMapTable(); const sql=getSql();
  await sql`BEGIN`;
  try{
    const rows=await sql`SELECT points, completed, boss_done FROM magnum_map_progress WHERE user_id=${user.id} LIMIT 1 FOR UPDATE`;
    if(rows.length===0){ await sql`ROLLBACK`; return Response.json({error:"need 5/5 points"},{status:400}); }
    const r=rows[0] as {points:unknown;completed:number;boss_done:boolean};
    const completed=Number(r.completed||0); const bossDone=Boolean(r.boss_done);
    if(bossDone){ await sql`ROLLBACK`; return Response.json({error:"boss already done"},{status:409}); }
    if(completed<5){ await sql`ROLLBACK`; return Response.json({error:"need 5/5 points", completed},{status:400}); }
    // канон-проверка: все 5 точек из POINTS_CANON должны быть true в points jsonb
    const bossPoints=(r.points && typeof r.points==="object" && !Array.isArray(r.points)) ? r.points as Record<string,boolean> : {};
    if(!isAllPointsDone(bossPoints)){ await sql`ROLLBACK`; return Response.json({error:"need 5/5 points", completed},{status:400}); }
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} FOR UPDATE`;
    await sql`UPDATE magnum_coins SET balance=balance+1420 WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},1420,'map_boss',${JSON.stringify({completed})}::jsonb)`;
    await sql`UPDATE magnum_map_progress SET boss_done=true, updated_at=now() WHERE user_id=${user.id}`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    await sql`COMMIT`;
    return Response.json({ ok:true, coins:1420, balance: Number((upd[0] as {balance:number}).balance) });
  }catch(e){ try{ await sql`ROLLBACK`; }catch{} throw e; }
}
async function handleMapShare(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const wk=mapWeekId(); await ensureMapTable(); const sql=getSql(); const today=mapTodayKey();
  const todayRows=await sql`SELECT id FROM magnum_map_shares WHERE user_id=${user.id} AND week_id=${wk} AND created_at::date = ${today}::date LIMIT 1`;
  if(todayRows.length>0) return Response.json({ ok:false, error:"already shared today", coins:0 },{status:409});
  await sql`INSERT INTO magnum_map_shares (user_id, week_id) VALUES (${user.id}, ${wk})`;
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'map_share',${JSON.stringify({weekId:wk})}::jsonb)`;
  return Response.json({ ok:true, coins:42, weekId:wk });
}
async function handleMapFreeze(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`map:freeze:${user.id}:${ip}`,5,60_000)) return Response.json({error:"rate limited"},{status:429});
  const wk=mapWeekId(); await ensureMapTable(); const sql=getSql();
  const rows=await sql`SELECT week_id, freeze_used FROM magnum_map_progress WHERE user_id=${user.id} LIMIT 1`;
  if(rows.length>0){ const r=rows[0] as {week_id:string;freeze_used:boolean}; if(r.week_id===wk && r.freeze_used) return Response.json({error:"freeze already used this week", weekId:wk},{status:409}); }
  const coinsRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  let bal=coinsRows.length?Number((coinsRows[0] as {balance:number}).balance):1000;
  if(coinsRows.length===0) await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  if(bal<420) return Response.json({error:"not enough coins", required:420, balance:bal},{status:402});
  await sql`UPDATE magnum_coins SET balance=balance-420 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-420},'map_freeze',${JSON.stringify({weekId:wk})}::jsonb)`;
  const existing=await sql`SELECT user_id FROM magnum_map_progress WHERE user_id=${user.id} LIMIT 1`;
  if(existing.length===0) await sql`INSERT INTO magnum_map_progress (user_id, points, completed, streak, week_id, freeze_used, last_claim_date, streak_days, boss_done) VALUES (${user.id}, '{}'::jsonb, 0, 0, ${wk}, true, null, '[]'::jsonb, false)`;
  else await sql`UPDATE magnum_map_progress SET week_id=${wk}, freeze_used=true, updated_at=now() WHERE user_id=${user.id}`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, weekId:wk, balance: Number((upd[0] as {balance:number}).balance) });
}
async function handleMapVerify(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`map:verify:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{pointId?:string}; try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const pid=String(body.pointId||"").trim().toLowerCase(); if(!isMapPoint(pid)) return Response.json({error:"pointId required"},{status:400});
  await ensureMapTable(); const sql=getSql(); const wk=mapWeekId(); const today=mapTodayKey();
  await sql`BEGIN`;
  try{
    const rows=await sql`SELECT points, completed, streak, week_id, freeze_used, last_claim_date, streak_days, boss_done FROM magnum_map_progress WHERE user_id=${user.id} LIMIT 1 FOR UPDATE`;
    let points: Record<string,boolean>={}; let completed=0; let streak=0; let freeze_used=false; let last_claim=""; let streak_days:string[]=[]; let boss_done=false; let week_id=wk;
    if(rows.length>0){
      const r=rows[0] as {points:unknown;completed:number;streak:number;week_id:string;freeze_used:boolean;last_claim_date:string|null;streak_days:unknown;boss_done:boolean};
      points=(r.points && typeof r.points==="object" && !Array.isArray(r.points)) ? r.points as Record<string,boolean> : {};
      completed=Number(r.completed||0); streak=Number(r.streak||0); week_id=String(r.week_id||wk); freeze_used=Boolean(r.freeze_used); last_claim=String(r.last_claim_date||""); streak_days=Array.isArray(r.streak_days)?r.streak_days as string[]:[]; boss_done=Boolean(r.boss_done);
      if(week_id!==wk){ points={}; completed=0; streak=0; freeze_used=false; streak_days=[]; week_id=wk; last_claim=""; }
    }
    if(points[pid]){ await sql`ROLLBACK`; return Response.json({error:"already completed", pointId:pid},{status:409}); }
    const dupEvent=await sql`SELECT id FROM magnum_map_events WHERE user_id=${user.id} AND point_id=${pid} LIMIT 1 FOR UPDATE`;
    if(dupEvent.length>0){ await sql`ROLLBACK`; return Response.json({error:"already completed", pointId:pid},{status:409}); }
    points[pid]=true; completed=Object.keys(points).filter(k=>points[k]).length;
    const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1); const yKey=yesterday.toISOString().slice(0,10);
    let nextStreak=1;
    if(last_claim===yKey) nextStreak=Math.min(7, streak+1);
    else if(last_claim===today) nextStreak=streak;
    else if(streak===0 || last_claim==="") nextStreak=1;
    else if(last_claim!==today){ if(freeze_used) nextStreak=Math.min(7, streak+1); else nextStreak=1; }
    if(!streak_days.includes(today)) streak_days=[...streak_days, today].slice(-7);
    let coins=42; if(completed===5) coins+=142;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} FOR UPDATE`;
    await sql`UPDATE magnum_coins SET balance=balance+${coins} WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${coins},'map_verify',${JSON.stringify({pointId:pid, completed, via:"vision"})}::jsonb)`;
    const ev=await sql`INSERT INTO magnum_map_events (user_id, point_id, q, correct) VALUES (${user.id}, ${pid}, 0, true) ON CONFLICT (user_id, point_id) DO NOTHING RETURNING id`;
    if(ev.length===0){ await sql`ROLLBACK`; return Response.json({error:"already completed", pointId:pid},{status:409}); }
    await sql`INSERT INTO magnum_map_progress (user_id, points, completed, streak, week_id, freeze_used, last_claim_date, streak_days, boss_done, updated_at) VALUES (${user.id}, ${JSON.stringify(points)}::jsonb, ${completed}, ${nextStreak}, ${wk}, ${freeze_used}, ${today}, ${JSON.stringify(streak_days)}::jsonb, ${boss_done}, now()) ON CONFLICT (user_id) DO UPDATE SET points=${JSON.stringify(points)}::jsonb, completed=${completed}, streak=${nextStreak}, week_id=${wk}, last_claim_date=${today}, streak_days=${JSON.stringify(streak_days)}::jsonb, updated_at=now()`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    await sql`COMMIT`;
    return Response.json({ ok:true, pointId:pid, points, completed, streak:nextStreak, coins, balance: Number((upd[0] as {balance:number}).balance) });
  }catch(e){ try{ await sql`ROLLBACK`; }catch{} throw e; }
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
  let body: { url?: string; variant?: string; ts?: number };
  try { body = (await req.json().catch(() => ({}))) as typeof body; } catch { body = {}; }
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 300) : "/magnum";
  if (url.length > 300 || url.includes("<") || url.includes("\"")) return Response.json({ error: "invalid url" }, { status: 400 });
  const allowedVariants = new Set(["a", "b", "return-popup"]);
  const rawVariant = typeof body.variant === "string" ? body.variant.trim().slice(0, 32) : "";
  const variant = allowedVariants.has(rawVariant) ? rawVariant : null;
  const token = extractToken(req);
  let userId: number | null = null;
  if (token) { try { const u = await getUserByToken(token); if (u) userId = u.id; } catch (e) { console.error("[presave] getUserByToken failed", e); } }
  try {
    const sql = getSql();
    // variant column may not exist on older DB — try with variant, fallback without
    try {
      if (variant) await sql`INSERT INTO magnum_presave_clicks (user_id, url, ip, variant, created_at) VALUES (${userId}, ${url}, ${ip}, ${variant}, now())`;
      else await sql`INSERT INTO magnum_presave_clicks (user_id, url, ip, created_at) VALUES (${userId}, ${url}, ${ip}, now())`;
    } catch (e) {
      const msg = String(e);
      if (msg.includes("variant") || msg.includes("column")) {
        await sql`INSERT INTO magnum_presave_clicks (user_id, url, ip, created_at) VALUES (${userId}, ${url}, ${ip}, now())`;
      } else throw e;
    }
    // bonus incentive +42 монеты за первый пресейв (P0 funnel)
    if (userId) {
      try {
        const cntR = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id=${userId}`;
        const cnt = Number((cntR[0] as { c: number }).c);
        if (cnt === 1) {
          await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${userId}, 1000) ON CONFLICT (user_id) DO NOTHING`;
          const upd = await sql`UPDATE magnum_coins SET balance = balance + 42 WHERE user_id=${userId} RETURNING balance`;
          const bal = upd.length ? Number((upd[0] as { balance: number }).balance) : 0;
          await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${userId}, 42, 'presave_bonus', '{"bonus":42}'::jsonb)`;
          try { await ensureNotification(userId, "Пресейв MAGNUM", "+42 монеты за пресейв — спасибо! 🔥", "presave"); } catch {}
          try { await maybeValidateReferral(userId); } catch {}
          return Response.json({ ok: true, bonus: 42, balance: bal, firstPresave: true });
        }
        try { await maybeValidateReferral(userId); } catch {}
      } catch (e) { console.error("[presave bonus] failed", e); }
    }
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
const GAME_WHITELIST = new Set(["runner","match3","knife","memory","clicker","clicker42","rhythm","stack","blackjack","roulette","2042","flappy","typing","snake","dodge","quiz","duel","duel42","mining","nitro"]);
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
  let coinsEarned = score < 10 ? 0 : Math.min(42, Math.floor(score / 200));
  // P0 funnel активация: +10 бонус за первую игру (идемпотентно через флаг первой записи в magnum_game_scores)
  let funnelBonus = 0;
  try {
    const sql = getSql();
    const prev = await sql`SELECT count(*)::int as c FROM magnum_game_scores WHERE user_id=${user.id}`;
    const isFirst = Number((prev[0] as { c: number }).c) === 0;
    if (isFirst) funnelBonus = 10;
  } catch { funnelBonus = 0; }
  const totalCoins = coinsEarned + funnelBonus;
  try {
    const sql = getSql();
    await sql`INSERT INTO magnum_game_scores (user_id, game, score, coins_earned, meta) VALUES (${user.id}, ${game}, ${score}, ${coinsEarned}, ${JSON.stringify(meta)}::jsonb)`;
    try { await maybeValidateReferral(user.id); } catch {}
    if (totalCoins > 0) {
      await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
      const upd = await sql`UPDATE magnum_coins SET balance = balance + ${totalCoins} WHERE user_id=${user.id} RETURNING balance`;
      const bal = Number((upd[0] as { balance: number }).balance);
      await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${coinsEarned}, 'game_reward', ${JSON.stringify({ game, score })}::jsonb)`;
      if (funnelBonus > 0) {
        await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${funnelBonus}, 'funnel_first_game', ${JSON.stringify({ game, score, funnel: 'funnel-activation-20260901-1807' })}::jsonb)`;
      }
      return Response.json({ ok: true, game, score, coinsEarned, funnelBonus, totalCoins, balance: bal });
    }
    if (funnelBonus > 0) {
      const sql2 = getSql();
      await sql2`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
      const upd2 = await sql2`UPDATE magnum_coins SET balance = balance + ${funnelBonus} WHERE user_id=${user.id} RETURNING balance`;
      const bal2 = Number((upd2[0] as { balance: number }).balance);
      await sql2`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${funnelBonus}, 'funnel_first_game', ${JSON.stringify({ game, score, funnel: 'funnel-activation-20260901-1807' })}::jsonb)`;
      return Response.json({ ok: true, game, score, coinsEarned: 0, funnelBonus, totalCoins: funnelBonus, balance: bal2 });
    }
    return Response.json({ ok: true, game, score, coinsEarned: 0, funnelBonus: 0, totalCoins: 0 });
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
// БРАТУХА-КОД 42-XXXX — deterministic 4-char base36 from userId, no DB column needed
function referralCodeFor(user: { id: number; username: string }): string {
  const raw = user.id.toString(36).toUpperCase().padStart(4, "0").slice(-4);
  return `42-${raw}`;
}
function bratCodeToUserId(code: string): number | null {
  const m = code.trim().toUpperCase().match(/^42-([A-Z0-9]{4})$/);
  if (!m) return null;
  const n = parseInt(m[1], 36);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
function isOldReferralCode(code: string): boolean { return /[A-Z0-9]+42$/i.test(code); }
function oldReferralCodeFor(user: { id: number; username: string }): string {
  return `${user.username.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12) || "BRAT"}${user.id.toString(36).toUpperCase()}42`;
}
async function getValidatedPrestige(inviterId: number): Promise<number> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT invited_id FROM magnum_referrals WHERE inviter_id=${inviterId}`;
    if (rows.length === 0) return 0;
    let count = 0;
    for (const r of rows as { invited_id: number }[]) {
      const iid = Number((r as any).invited_id);
      const pres = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id=${iid} LIMIT 1`;
      const hasPresave = Number((pres[0] as any).c) > 0;
      const gs = await sql`SELECT count(*)::int as c FROM magnum_game_scores WHERE user_id=${iid} LIMIT 1`;
      const hasGame = Number((gs[0] as any).c) > 0;
      if (hasPresave || hasGame) count++;
    }
    return count;
  } catch { return 0; }
}
async function maybeValidateReferral(invitedId: number): Promise<void> {
  try {
    const sql = getSql();
    const r = await sql`SELECT inviter_id FROM magnum_referrals WHERE invited_id=${invitedId} LIMIT 1`;
    if (r.length === 0) return;
    const pres = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id=${invitedId} LIMIT 1`;
    const gs = await sql`SELECT count(*)::int as c FROM magnum_game_scores WHERE user_id=${invitedId} LIMIT 1`;
    const ok = Number((pres[0] as any).c) > 0 || Number((gs[0] as any).c) > 0;
    if (!ok) return;
    try { await sql`UPDATE magnum_referrals SET reward_claimed=true WHERE invited_id=${invitedId} AND reward_claimed=false`; } catch {}
  } catch (e) { console.error("[prestige validate] failed", e); }
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
    const prestige = await getValidatedPrestige(user.id);
    const prestigeBonus = Math.min(10, prestige);
    return Response.json({ code, invited, invitedCount: invited.length, redeemed: redeemed.length ? redeemed[0] : null, prestige, prestigeBonus, prestigeBonusLabel: `+${prestigeBonus}% редкости` });
  } catch (e) { console.error("[referral code] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
}
async function handleReferralPrestige(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const prestige = await getValidatedPrestige(user.id);
    return Response.json({ prestige, bonus: Math.min(10, prestige), bonusLabel: `+${Math.min(10, prestige)}%`, cap: 10 });
  } catch (e) { console.error("[referral prestige] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
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
  // allow 42-XXXX and legacy
  if (raw.startsWith("42-") && raw.length !== 7) return Response.json({ error: "invalid brat code 42-XXXX" }, { status: 400 });
  try {
    const sql = getSql();
    const already = await sql`SELECT id FROM magnum_referrals WHERE invited_id=${user.id} LIMIT 1`;
    if (already.length > 0) return Response.json({ error: "already redeemed referral" }, { status: 409 });
    let inviterId: number | null = bratCodeToUserId(raw);
    if (inviterId === null) {
      const m = raw.match(/^(.*)42$/);
      if (!m) return Response.json({ error: "invalid code format" }, { status: 400 });
      const without42 = raw.slice(0, -2);
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
    }
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
  const rawWager=Number(body.wager ?? 0); const wager=Number.isFinite(rawWager)?Math.max(0,Math.min(420,Math.floor(rawWager))):0;
  if(wager>0 && ![0,42,142,420].includes(wager)) return Response.json({error:"wager must be 0/42/142/420"},{status:400});
  const roomId=typeof body.roomId==="string"?body.roomId.trim().slice(0,64):[...rooms.keys()][0]||`room-${Date.now().toString(36)}`;
  try{ const sql=getSql(); await sql`CREATE TABLE IF NOT EXISTS magnum_duel_invites (id serial PRIMARY KEY, from_user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, to_user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, room_id text NOT NULL, status text DEFAULT 'pending' NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    if(wager>0){ const cr=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`; const bal=cr.length?Number((cr[0] as {balance:number}).balance):0; if(bal<wager) return Response.json({error:"not enough coins for wager",required:wager,balance:bal},{status:402}); await sql`UPDATE magnum_coins SET balance=balance-${wager} WHERE user_id=${user.id}`; await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-wager},'duel_wager_hold',${JSON.stringify({wager,roomId,to:toName})}::jsonb)`; }
    const toRows=await sql`SELECT id FROM magnum_users WHERE username=${toName} LIMIT 1`; if(toRows.length===0) return Response.json({error:"recipient not found"},{status:404});
    const toId=Number((toRows[0] as {id:number}).id);
    const rows=await sql`INSERT INTO magnum_duel_invites (from_user_id,to_user_id,room_id,status) VALUES (${user.id},${toId},${roomId},'pending') RETURNING id,room_id,status,created_at`;
    try{ await ensureNotification(toId,`Дуэль 42: вызов от ${user.username}`+(wager?` (ставка ${wager})`:""),`Братуха ${user.username} зовёт в дуэль — комната ${roomId}`+(wager?` • ставка ${wager} монет`:""),"duel"); }catch(e){ console.warn("[duel notify] failed", e instanceof Error ? e.message : String(e)); }
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
    try{ await ensureNotification(otherId,`Дуэль 42: ${nextStatus==="accepted"?"принят ✅":"отклонён ❌"}`, `Братуха ${user.username} ${nextStatus==="accepted"?"принял":"отклонил"} вызов — комната ${inv.room_id}`,"duel"); }catch(e){ console.warn("[duel notify] failed", e instanceof Error ? e.message : String(e)); }
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
// ---- БАТАЛЬОН 42: squads 5 + котёл + ELO + OG sharing ----
async function ensureSquadTables(): Promise<void>{
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_squads (id serial PRIMARY KEY, code text NOT NULL UNIQUE, leader_id integer NOT NULL REFERENCES magnum_users(id) ON DELETE CASCADE, pot integer NOT NULL DEFAULT 0, mult integer NOT NULL DEFAULT 10, created_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_squad_members (id serial PRIMARY KEY, squad_id integer NOT NULL REFERENCES magnum_squads(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES magnum_users(id) ON DELETE CASCADE, joined_at timestamp DEFAULT now() NOT NULL, UNIQUE(squad_id, user_id))`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_squad_battles (id serial PRIMARY KEY, squad_id integer NOT NULL REFERENCES magnum_squads(id) ON DELETE CASCADE, winner_id integer REFERENCES magnum_users(id), score jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON magnum_squad_members(squad_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_squad_battles_squad ON magnum_squad_battles(squad_id, created_at DESC)`;
}
function squadMultForPot(pot:number):{mult:number;label:string}{
  if(pot>=420) return {mult:20,label:"x2.0"};
  if(pot>=142) return {mult:15,label:"x1.5"};
  if(pot>=42) return {mult:12,label:"x1.2"};
  return {mult:10,label:"x1.0"};
}
function genSquadCode():string{
  const letters="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s=""; for(let i=0;i<4;i++) s+=letters[Math.floor(Math.random()*letters.length)]!;
  return `B42-${s}`;
}
async function handleSquadCreate(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  await ensureSquadTables();
  const sql=getSql();
  // already in squad?
  const existing=await sql`SELECT squad_id FROM magnum_squad_members WHERE user_id=${user.id} LIMIT 1`;
  if(existing.length>0) return Response.json({error:"already in squad"},{status:409});
  let code=genSquadCode(); let tries=0;
  while(tries<5){
    try{
      const rows=await sql`INSERT INTO magnum_squads (code, leader_id, pot, mult) VALUES (${code}, ${user.id}, 0, 10) RETURNING id, code, pot, mult, created_at`;
      const squad=rows[0] as {id:number;code:string;pot:number;mult:number;created_at:string};
      await sql`INSERT INTO magnum_squad_members (squad_id, user_id) VALUES (${Number(squad.id)}, ${user.id})`;
      return Response.json({ok:true,squad:{id:Number(squad.id),code:String(squad.code),pot:0,mult:10,label:"x1.0",leaderId:user.id,members:[{userId:user.id,username:user.username}] }},{status:201});
    }catch(e:any){
      const msg=String(e?.message||"");
      if(msg.includes("duplicate")||msg.includes("unique")||msg.includes("23505")){ code=genSquadCode(); tries++; continue; }
      console.error("[squad create] failed",e); return Response.json({error:"db error"},{status:500});
    }
  }
  return Response.json({error:"retry"},{status:500});
}
async function handleSquadJoin(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  let body:{code?:string;invite?:string}; try{body=(await req.json()) as any;}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const raw=String(body.code??body.invite??"").trim().toUpperCase().replace(/[^A-Z0-9-]/g,"");
  if(!raw || raw.length<4) return Response.json({error:"code required B42-XXXX"},{status:400});
  const code=raw.startsWith("B42-")?raw:`B42-${raw.slice(-4)}`;
  await ensureSquadTables();
  const sql=getSql();
  const squads=await sql`SELECT id, code, leader_id, pot, mult FROM magnum_squads WHERE code=${code} LIMIT 1`;
  if(squads.length===0) return Response.json({error:"squad not found"},{status:404});
  const squad=squads[0] as {id:number;code:string;leader_id:number;pot:number;mult:number};
  const sid=Number(squad.id);
  const members=await sql`SELECT user_id FROM magnum_squad_members WHERE squad_id=${sid}`;
  if(members.some((m:any)=>Number((m as any).user_id)===user.id)) return Response.json({error:"already member"},{status:409});
  if(members.length>=5) return Response.json({error:"squad full 5/5"},{status:409});
  const existingSquad=await sql`SELECT squad_id FROM magnum_squad_members WHERE user_id=${user.id} LIMIT 1`;
  if(existingSquad.length>0) return Response.json({error:"already in another squad"},{status:409});
  await sql`INSERT INTO magnum_squad_members (squad_id, user_id) VALUES (${sid}, ${user.id})`;
  // invite bonus +42 both (joiner + leader)
  try{
    const bonus=42;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${Number(squad.leader_id)},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`UPDATE magnum_coins SET balance=balance+${bonus} WHERE user_id=${user.id}`;
    await sql`UPDATE magnum_coins SET balance=balance+${bonus} WHERE user_id=${Number(squad.leader_id)}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${bonus},'squad_invite',${JSON.stringify({code,squadId:sid})}::jsonb)`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${Number(squad.leader_id)},${bonus},'squad_invite_bonus',${JSON.stringify({code,newMember:user.username})}::jsonb)`;
    try{ await ensureNotification(Number(squad.leader_id),`Батальон ${code}: +${bonus}`,`Братуха ${user.username} вступил по инвайту B42 +${bonus} обоим`,"squad"); }catch{}
  }catch(e){ console.error("[squad join bonus] failed",e); }
  const updMembers=await sql`SELECT m.user_id, u.username FROM magnum_squad_members m JOIN magnum_users u ON u.id=m.user_id WHERE m.squad_id=${sid} ORDER BY m.joined_at ASC`;
  const list=updMembers.map((r:any)=>({userId:Number(r.user_id),username:String(r.username)}));
  return Response.json({ok:true,squad:{id:sid,code:String(squad.code),pot:Number(squad.pot),mult:Number(squad.mult),label:squadMultForPot(Number(squad.pot)).label,leaderId:Number(squad.leader_id),members:list}});
}
async function handleSquadPot(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  let body:{squadId?:number;amount?:number}; try{body=(await req.json()) as any;}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const amount=Number(body.amount);
  if(![42,142,420].includes(amount)) return Response.json({error:"amount must be 42/142/420"},{status:400});
  await ensureSquadTables();
  const sql=getSql();
  const mem=await sql`SELECT squad_id FROM magnum_squad_members WHERE user_id=${user.id} LIMIT 1`;
  if(mem.length===0) return Response.json({error:"not in squad"},{status:400});
  const sid=Number((mem[0] as any).squad_id);
  if(body.squadId && Number(body.squadId)!==sid) return Response.json({error:"wrong squad"},{status:400});
  const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  let bal=coins.length?Number((coins[0] as any).balance):1000;
  if(coins.length===0) await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  if(bal<amount) return Response.json({error:"not enough coins",balance:bal,required:amount},{status:402});
  await sql`UPDATE magnum_coins SET balance=balance-${amount} WHERE user_id=${user.id}`;
  const sq=await sql`UPDATE magnum_squads SET pot=pot+${amount} WHERE id=${sid} RETURNING pot`;
  const pot=Number((sq[0] as any).pot);
  const {mult,label}=squadMultForPot(pot);
  await sql`UPDATE magnum_squads SET mult=${mult} WHERE id=${sid}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-amount},'squad_pot',${JSON.stringify({squadId:sid,amount,pot})}::jsonb)`;
  const updated=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ok:true,pot,mult,label,balance:Number((updated[0] as any).balance)});
}
async function handleSquadMy(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  await ensureSquadTables();
  const sql=getSql();
  const mem=await sql`SELECT squad_id FROM magnum_squad_members WHERE user_id=${user.id} LIMIT 1`;
  if(mem.length===0) return Response.json({squad:null,members:[],battles:[]});
  const sid=Number((mem[0] as any).squad_id);
  const squads=await sql`SELECT id, code, leader_id, pot, mult, created_at FROM magnum_squads WHERE id=${sid} LIMIT 1`;
  if(squads.length===0) return Response.json({squad:null});
  const s=squads[0] as any;
  const members=await sql`SELECT m.user_id, u.username, m.joined_at FROM magnum_squad_members m JOIN magnum_users u ON u.id=m.user_id WHERE m.squad_id=${sid} ORDER BY m.joined_at ASC`;
  const battles=await sql`SELECT id, winner_id, score, created_at FROM magnum_squad_battles WHERE squad_id=${sid} ORDER BY created_at DESC LIMIT 20`;
  const coins=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const bal=coins.length?Number((coins[0] as any).balance):0;
  return Response.json({squad:{id:Number(s.id),code:String(s.code),pot:Number(s.pot),mult:Number(s.mult),label:squadMultForPot(Number(s.pot)).label,leaderId:Number(s.leader_id),created_at:s.created_at},members:members.map((r:any)=>({userId:Number(r.user_id),username:String(r.username),joined_at:r.joined_at})),battles:battles.map((r:any)=>({id:Number(r.id),winnerId:r.winner_id?Number(r.winner_id):null,score:r.score,created_at:r.created_at})),balance:bal});
}
async function handleSquadBattles(req:Request):Promise<Response>{
  const url=new URL(req.url);
  const code=url.searchParams.get("code"); const sidParam=url.searchParams.get("squadId");
  await ensureSquadTables();
  const sql=getSql();
  let sid: number|null=null;
  if(sidParam) sid=Number(sidParam);
  else if(code){ const r=await sql`SELECT id FROM magnum_squads WHERE code=${String(code).trim().toUpperCase()} LIMIT 1`; if(r.length) sid=Number((r[0] as any).id); }
  else{
    const token=extractToken(req);
    if(token){ try{ const u=await getUserByToken(token); if(u){ const m=await sql`SELECT squad_id FROM magnum_squad_members WHERE user_id=${u.id} LIMIT 1`; if(m.length) sid=Number((m[0] as any).squad_id); } }catch{} }
  }
  if(sid===null) return Response.json({battles:[],count:0});
  const rows=await sql`SELECT b.id, b.winner_id, b.score, b.created_at, u.username as winner FROM magnum_squad_battles b LEFT JOIN magnum_users u ON u.id=b.winner_id WHERE b.squad_id=${sid} ORDER BY b.created_at DESC LIMIT 20`;
  return Response.json({battles:rows.map((r:any)=>({id:Number(r.id),winnerId:r.winner_id?Number(r.winner_id):null,winner:String(r.winner||""),score:r.score,created_at:r.created_at})),count:rows.length,squadId:sid});
}
// ---- VOLCANO SEASON 42: ELO 7d + volcano-crown топ-3 + pulse 1.2s + duel42 store ----
async function handleDuel42Leaderboard(req: Request): Promise<Response> {
  try {
    const sql=getSql();
    const url=new URL(req.url);
    const limit=Math.min(30,Math.max(1,Number(url.searchParams.get("limit")||20)));
    // season 7d: game=duel42 + created_at > now-7d
    const rows=await sql`SELECT l.player, l.score, l.created_at, s.skin_id as avatar FROM magnum_leaderboard l LEFT JOIN magnum_users u ON u.username=l.player LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE l.game='duel42' AND l.created_at > now() - interval '7 days' ORDER BY l.score DESC, l.created_at ASC LIMIT ${limit}`;
    const board=rows.map((r:unknown)=>{const x=r as {player:string;score:number;created_at:string;avatar:string|null}; return {player:String(x.player),score:Number(x.score),created_at:x.created_at,avatar:x.avatar||null};});
    // top 3 volcano-crown bonus + pulse 1.2s (VOLCANO SEASON 42 spec)
    return Response.json({ leaderboard:board, season:"7d", game:"duel42", count:board.length, top3Bonus:1420, crown:"volcano-crown-42", pulse:"1.2s", volcanoBar:"conic-volcano" });
  } catch(e){ console.error("[duel42 lb] failed",e); return Response.json({error:"db error"},{status:500}); }
}
// Generic leaderboard: /magnum/api/leaderboard?game=duel42 — ELO season 7d, alias for duel42
async function handleLeaderboard(req: Request): Promise<Response> {
  try {
    const url=new URL(req.url);
    const game=String(url.searchParams.get("game")||"duel42");
    if(game==="duel42" || game==="duel") return handleDuel42Leaderboard(req);
    const sql=getSql();
    const limit=Math.min(30,Math.max(1,Number(url.searchParams.get("limit")||20)));
    const rows=await sql`SELECT l.player, l.score, l.created_at FROM magnum_leaderboard l WHERE l.game=${game} AND l.created_at > now() - interval '7 days' ORDER BY l.score DESC, l.created_at ASC LIMIT ${limit}`;
    const board=rows.map((r:unknown)=>{const x=r as {player:string;score:number;created_at:string}; return {player:String(x.player),score:Number(x.score),created_at:x.created_at};});
    return Response.json({ leaderboard:board, season:"7d", game, count:board.length });
  } catch(e){ console.error("[leaderboard] failed",e); return Response.json({error:"db error"},{status:500}); }
}
// Arena season claim — +42 win / +142 streak3 / +1420 crown топ-3 (idempotent per season via transactions meta)
async function handleArenaClaim(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`arena:claim:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{kind?:unknown; season?:unknown}; try{ body=(await req.json()) as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const kind=String(body.kind||"");
  const season=String(body.season|| weekIdNowArena());
  const allowed=["win","streak3","crown"] as const;
  if(!allowed.includes(kind as typeof allowed[number])) return Response.json({error:"kind must be win/streak3/crown"},{status:400});
  const rewardMap:{Record<string,number>}={win:42,streak3:142,crown:1420};
  const reward=rewardMap[kind]!;
  const sql=getSql();
  await sql`BEGIN`;
  try{
    // serialize per user via coins row lock
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} FOR UPDATE`;
    // idempotence: check transactions meta season+kind with lock
    const dup=await sql`SELECT id FROM magnum_transactions WHERE user_id=${user.id} AND reason=${"arena_"+kind} AND meta->>'season'=${season} LIMIT 1 FOR UPDATE`;
    if(dup.length){ await sql`ROLLBACK`; return Response.json({ok:true, already:true, reward:0, season, kind}); }
    // crown requires top-3 check
    if(kind==="crown"){
      const rows=await sql`SELECT l.player FROM magnum_leaderboard l WHERE l.game='duel42' AND l.created_at > now() - interval '7 days' ORDER BY l.score DESC LIMIT 3`;
      const isTop3=rows.some((r:unknown)=> String((r as {player:string}).player)===user.username);
      if(!isTop3){ await sql`ROLLBACK`; return Response.json({error:"not in top-3", top3:false},{status:403}); }
    }
    const upd=await sql`UPDATE magnum_coins SET balance=balance+${reward} WHERE user_id=${user.id} RETURNING balance`;
    const balance=Number((upd[0] as {balance:number}).balance);
    // attempt insert; if race created dup between SELECT and INSERT, unique would not exist — so check again via ON CONFLICT would need constraint. Use duplicate check after insert via row existence: we already hold lock, so safe.
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${reward},${"arena_"+kind},${JSON.stringify({season,kind,reward})}::jsonb)`;
    await sql`COMMIT`;
    return Response.json({ok:true, reward, balance, season, kind});
  }catch(e){ try{ await sql`ROLLBACK`; }catch{} console.error("[arena claim] failed",e); return Response.json({error:"db error"},{status:500}); }
}
function weekIdNowArena(): string {
  const d=new Date(); const jan1=new Date(d.getFullYear(),0,1); const days=Math.floor((d.getTime()-jan1.getTime())/86400000);
  const week=Math.ceil((days + jan1.getDay()+1)/7); return `${d.getFullYear()}-W${String(week).padStart(2,"0")}`;
}
async function handleDuel42Elo(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401}); const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  try{
    const sql=getSql();
    await sql`CREATE TABLE IF NOT EXISTS magnum_duel42_elo (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, elo integer NOT NULL DEFAULT 1000, updated_at timestamp DEFAULT now())`;
    const r=await sql`SELECT elo FROM magnum_duel42_elo WHERE user_id=${user.id} LIMIT 1`;
    const elo=r.length?Number((r[0] as {elo:number}).elo):1000;
    const top=await sql`SELECT u.username, e.elo FROM magnum_duel42_elo e JOIN magnum_users u ON u.id=e.user_id ORDER BY e.elo DESC LIMIT 20`;
    return Response.json({ elo, top: top.map((x:unknown)=>{const r=x as {username:string;elo:number}; return {username:String(r.username),elo:Number(r.elo)};}) });
  }catch(e){ console.error("[duel42 elo] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleDuel42Wager(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401}); const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`duel42:wager:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{wager?:unknown;roomId?:unknown}; try{body=(await req.json()) as typeof body;}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const wagerRaw=Number(body.wager ?? 0);
  const wager=[0,42,142,420].includes(wagerRaw)?wagerRaw:null;
  if(wager===null) return Response.json({error:"wager must be 0/42/142/420"},{status:400});
  if(wager===0) return Response.json({ok:true,wager:0});
  try{
    const sql=getSql();
    await sql`CREATE TABLE IF NOT EXISTS magnum_duel42_wager_hold (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, wager integer NOT NULL, room_id text NOT NULL, refunded boolean DEFAULT false NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    await sql`BEGIN`;
    let bal:number;
    try{
      const cr=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1 FOR UPDATE`;
      bal=cr.length?Number((cr[0] as {balance:number}).balance):1000;
      if(cr.length===0) { await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`; bal=1000; }
      if(bal<wager) { await sql`ROLLBACK`; return Response.json({error:"not enough coins",required:wager,balance:bal},{status:402}); }
      await sql`UPDATE magnum_coins SET balance=balance-${wager} WHERE user_id=${user.id}`;
      await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-wager},'duel42_wager_hold',${JSON.stringify({wager,roomId:String(body.roomId||"")})}::jsonb)`;
      await sql`INSERT INTO magnum_duel42_wager_hold (user_id,wager,room_id,refunded) VALUES (${user.id},${wager},${String(body.roomId||"")},false)`;
      await sql`COMMIT`;
    }catch(e){ try{ await sql`ROLLBACK`; }catch{} throw e; }
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const nb=Number((upd[0] as {balance:number}).balance);
    // attach to in-memory room if exists + track hold for 30s expiry
    const holdRoomId = typeof body.roomId==="string" && body.roomId ? String(body.roomId) : "";
    if(holdRoomId){
      const r=rooms.get(holdRoomId) || rooms.get(`room:${holdRoomId}`) || rooms.get(holdRoomId.replace(/^room:/,"")) || null;
      if(r) r.wager=Math.max(r.wager,wager);
      const key = r ? r.id : (holdRoomId.startsWith("room:") || holdRoomId.startsWith("room-") || holdRoomId.startsWith("squad:") ? holdRoomId : holdRoomId ? `room:${holdRoomId}` : `hold:${user.id}:${Date.now()}`);
      let m=duel42WagerHolds.get(key); if(!m){ m=new Map(); duel42WagerHolds.set(key,m); }
      m.set(user.id, (m.get(user.id)??0)+wager);
      if(!duel42WagerTimers.has(key)){
        const t=setTimeout(async()=>{
          duel42WagerTimers.delete(key);
          const holds=duel42WagerHolds.get(key); if(!holds) return;
          const room=rooms.get(key) || rooms.get(holdRoomId) || null;
          const isFinished = room?.state==="finished";
          if(isFinished){ duel42WagerHolds.delete(key); return; }
          // refund if not finished (timeout / room dissolved)
          for(const [uid,w] of holds){
            if(w<=0) continue;
            try{
              const s=getSql();
              const rows=await s`SELECT id FROM magnum_duel42_wager_hold WHERE user_id=${uid} AND room_id=${holdRoomId} AND refunded=false LIMIT 1`;
              if(rows.length===0) continue;
              await s`UPDATE magnum_coins SET balance=balance+${w} WHERE user_id=${uid}`;
              await s`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${uid},${w},'duel42_wager_refund',${JSON.stringify({wager:w,roomId:holdRoomId,reason:"timeout"})}::jsonb)`;
              await s`UPDATE magnum_duel42_wager_hold SET refunded=true WHERE user_id=${uid} AND room_id=${holdRoomId} AND refunded=false`;
              const rr=rooms.get(key); if(rr) rr.wager=Math.max(0, rr.wager-w);
              holds.set(uid,0);
            }catch(e){ console.error("[duel42 wager expiry] refund failed",e); }
          }
          duel42WagerHolds.delete(key);
        }, 30_000);
        // @ts-ignore
        if(typeof (t as any).unref==="function") (t as any).unref();
        duel42WagerTimers.set(key,t);
      }
    }
    return Response.json({ok:true,wager,balance:nb});
  }catch(e){ console.error("[duel42 wager] failed",e); return Response.json({error:"db error"},{status:500}); }
}
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
// ---- КОНВЕЙЕР 42 — Idle-завод Кузбасса offline фабрика 6 цехов ----
export const CONVEYOR_CATALOG = [
  { idx:0, id:"mine", name:"Шахта", icon:"⛏️", base:4, price:42 },
  { idx:1, id:"crusher", name:"Дробилка", icon:"🪨", base:14, price:42 },
  { idx:2, id:"belt", name:"Конвейер", icon:"🚚", base:42, price:142 },
  { idx:3, id:"enrich", name:"Обогатиловка", icon:"🏭", base:84, price:142 },
  { idx:4, id:"tec", name:"ТЭЦ", icon:"⚡", base:142, price:420 },
  { idx:5, id:"lab", name:"Лаба", icon:"🧪", base:420, price:1420 },
] as const;
const CONVEYOR_CAP_MIN = 240; // 4ч
const CONVEYOR_PRESTIGE_NEED = 42000;
async function ensureConveyorTable():Promise<void>{
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_conveyor_state (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, levels integer[] NOT NULL DEFAULT '{0,0,0,0,0,0}', prestige integer NOT NULL DEFAULT 0, last_claim timestamptz NOT NULL DEFAULT now(), dust integer NOT NULL DEFAULT 0)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conveyor_prestige ON magnum_conveyor_state(prestige)`;
}
function conveyorIncomePerMin(levels:number[], prestige:number):number{
  let sum=0;
  for(let i=0;i<6;i++){ const base=CONVEYOR_CATALOG[i]!.base; const lvl=Number(levels[i]||0); sum+=lvl*base; }
  const mult=1+prestige*0.15;
  return Math.floor(sum*mult);
}
async function getPresaveBonus(userId:number):Promise<number>{
  try{ const sql=getSql(); const r=await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id=${userId}`; const c=Number((r[0] as {c:number}).c); return c>0?2:1; }catch{ return 1; }
}
async function ensureConveyorRow(userId:number){
  await ensureConveyorTable();
  const sql=getSql();
  const rows=await sql`SELECT user_id, levels, prestige, last_claim, dust FROM magnum_conveyor_state WHERE user_id=${userId} LIMIT 1`;
  if(rows.length) return rows[0] as {user_id:number;levels:number[];prestige:number;last_claim:string;dust:number};
  const ins=await sql`INSERT INTO magnum_conveyor_state (user_id, levels, prestige, last_claim, dust) VALUES (${userId}, '{0,0,0,0,0,0}'::int[], 0, now(), 0) RETURNING user_id, levels, prestige, last_claim, dust`;
  return ins[0] as {user_id:number;levels:number[];prestige:number;last_claim:string;dust:number};
}
async function handleConveyorState(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  try{
    const row=await ensureConveyorRow(user.id);
    const levels=(row.levels as unknown as number[]).map(n=>Number(n)||0); while(levels.length<6) levels.push(0);
    const prestige=Number(row.prestige||0);
    const dust=Number(row.dust||0);
    const last=new Date(row.last_claim).getTime();
    const now=Date.now();
    const elapsedMin=Math.min(CONVEYOR_CAP_MIN, Math.max(0, (now-last)/60000));
    const basePerMin=conveyorIncomePerMin(levels, prestige);
    const bonus=await getPresaveBonus(user.id);
    const perMin=Math.floor(basePerMin*bonus);
    const pending=Math.floor(elapsedMin*perMin);
    const sql=getSql();
    const coinsR=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const balance=coinsR.length?Number((coinsR[0] as {balance:number}).balance):1000;
    // leaderboard top 10 conveyor
    let top:unknown[]=[];
    try{ const r=await sql`SELECT player, score, created_at FROM magnum_leaderboard WHERE game='conveyor' ORDER BY score DESC LIMIT 10`; top=r as unknown[]; }catch{}
    return Response.json({ ok:true, levels, prestige, dust, lastClaim:row.last_claim, perMin, basePerMin, bonusX2:bonus===2, pending, elapsedMin:Math.floor(elapsedMin), capMin:CONVEYOR_CAP_MIN, balance, catalog:CONVEYOR_CATALOG, prestigeNeed:CONVEYOR_PRESTIGE_NEED, prestigeBonus:`+${prestige*15}%`, top });
  }catch(e){ console.error("[conveyor state] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleConveyorClaim(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`conveyor:claim:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{
    const row=await ensureConveyorRow(user.id);
    const levels=(row.levels as unknown as number[]).map(n=>Number(n)||0); while(levels.length<6) levels.push(0);
    const prestige=Number(row.prestige||0);
    const dust=Number(row.dust||0);
    const last=new Date(row.last_claim).getTime();
    const now=Date.now();
    const elapsedMin=Math.min(CONVEYOR_CAP_MIN, Math.max(0, (now-last)/60000));
    const basePerMin=conveyorIncomePerMin(levels, prestige);
    const bonus=await getPresaveBonus(user.id);
    const perMin=Math.floor(basePerMin*bonus);
    const pending=Math.floor(elapsedMin*perMin);
    if(pending<=0) return Response.json({ok:true, claimed:0, pending:0, dust, balance:(await getSql()`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`).then(r=>r.length?Number((r[0] as {balance:number}).balance):1000) });
    const sql=getSql();
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    const upd=await sql`UPDATE magnum_coins SET balance=balance+${pending} WHERE user_id=${user.id} RETURNING balance`;
    const balance=Number((upd[0] as {balance:number}).balance);
    const newDust=dust+pending;
    await sql`UPDATE magnum_conveyor_state SET dust=${newDust}, last_claim=now() WHERE user_id=${user.id}`;
    // also add to magnum_dust for shop vault discount
    try{ await ensureDustTable(); await sql`INSERT INTO magnum_dust (user_id,balance) VALUES (${user.id},${pending}) ON CONFLICT (user_id) DO UPDATE SET balance=magnum_dust.balance+${pending}, updated_at=now()`; }catch{}
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${pending},'conveyor_claim',${JSON.stringify({pending, perMin, elapsedMin:Math.floor(elapsedMin)})}::jsonb)`;
    // leaderboard update — best dust
    try{ await sql`INSERT INTO magnum_leaderboard (player,score,game,created_at) VALUES (${user.username},${newDust},'conveyor',now())`; }catch{}
    return Response.json({ok:true, claimed:pending, pending:0, dust:newDust, balance, perMin});
  }catch(e){ console.error("[conveyor claim] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleConveyorUpgrade(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`conveyor:upgrade:${user.id}:${ip}`,20,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{idx?:unknown; bulk?:unknown; index?:unknown}; try{ body=(await req.json()) as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const idxRaw=Number(body.idx ?? body.index);
  if(!Number.isInteger(idxRaw)||idxRaw<0||idxRaw>5) return Response.json({error:"idx must be 0..5"},{status:400});
  const bulk=Boolean(body.bulk);
  const countInc=bulk?10:1;
  const shop=CONVEYOR_CATALOG[idxRaw]!;
  const price=shop.price*(bulk?10:1);
  try{
    const sql=getSql();
    const row=await ensureConveyorRow(user.id);
    const coinsR=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    let bal=coinsR.length?Number((coinsR[0] as {balance:number}).balance):0;
    if(coinsR.length===0){ await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`; bal=1000; }
    if(bal<price) return Response.json({error:"not enough coins",required:price,balance:bal,price},{status:402});
    await sql`UPDATE magnum_coins SET balance=balance-${price} WHERE user_id=${user.id}`;
    const levels=(row.levels as unknown as number[]).map(n=>Number(n)||0); while(levels.length<6) levels.push(0);
    levels[idxRaw]+=countInc;
    const pgLevels=`{${levels.join(",")}}`;
    await sql`UPDATE magnum_conveyor_state SET levels=${pgLevels}::int[] WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-price},'conveyor_upgrade',${JSON.stringify({idx:idxRaw, bulk, price, shop:shop.id})}::jsonb)`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const newBal=Number((upd[0] as {balance:number}).balance);
    const prestige=Number(row.prestige||0);
    const perMin=Math.floor(conveyorIncomePerMin(levels, prestige)*(await getPresaveBonus(user.id)));
    return Response.json({ok:true, idx:idxRaw, levels, price, balance:newBal, perMin});
  }catch(e){ console.error("[conveyor upgrade] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleConveyorPrestige(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`conveyor:prestige:${user.id}:${ip}`,6,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{
    const row=await ensureConveyorRow(user.id);
    const levels=(row.levels as unknown as number[]).map(n=>Number(n)||0);
    const prestige=Number(row.prestige||0);
    const dust=Number(row.dust||0);
    const totalMined=dust;
    if(totalMined<CONVEYOR_PRESTIGE_NEED) return Response.json({error:`need ${CONVEYOR_PRESTIGE_NEED} добытых, сейчас ${totalMined}`,required:CONVEYOR_PRESTIGE_NEED,dust:totalMined},{status:402});
    const sql=getSql();
    const newPrestige=prestige+1;
    const newDust=dust; // keep dust for shop
    await sql`UPDATE magnum_conveyor_state SET levels='{0,0,0,0,0,0}'::int[], prestige=${newPrestige}, dust=${newDust} WHERE user_id=${user.id}`;
    // bonus +15% permanent captured via prestige count
    try{ await sql`INSERT INTO magnum_leaderboard (player,score,game,created_at) VALUES (${user.username},${newDust},'conveyor',now())`; }catch{}
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},0,'conveyor_prestige',${JSON.stringify({prestige:newPrestige, dust:newDust})}::jsonb)`;
    return Response.json({ok:true, prestige:newPrestige, dust:newDust, bonus:`+${newPrestige*15}%`, levels:[0,0,0,0,0,0]});
  }catch(e){ console.error("[conveyor prestige] failed",e); return Response.json({error:"db error"},{status:500}); }
}

// ---- ПИТОМЕЦ 42 — тамагочи-маскот MAGNUM (4 стадии, баффы, офлайн тик, кейс) ----
const PET_STAGE_XP = [0,142,420,1420] as const;
const PET_FEED_COST = 42, PET_FEED_HUNGER = 20, PET_FEED_XP = 42;
const PET_PLAY_HAPPINESS = 15, PET_PLAY_XP = 24, PET_PLAY_CD = 30*60*1000;
const PET_SLEEP_ENERGY = 30, PET_SLEEP_CD = 4*60*60*1000;
function petStageFromXp(xp:number):0|1|2|3{ if(xp>=1420) return 3; if(xp>=420) return 2; if(xp>=142) return 1; return 0; }
function petMiningBonusPct(stage:number){ return Math.max(0,Math.min(3,stage))*5; }
function petConveyorBonusPct(stage:number){ if(stage>=3) return 15; if(stage>=2) return 10; return 0; }
async function ensurePetTable():Promise<void>{
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_pets (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, stage integer NOT NULL DEFAULT 0, xp integer NOT NULL DEFAULT 0, hunger integer NOT NULL DEFAULT 70, happiness integer NOT NULL DEFAULT 70, energy integer NOT NULL DEFAULT 70, last_tick timestamptz NOT NULL DEFAULT now(), last_play_at timestamptz, last_sleep_at timestamptz, last_claim_at timestamptz, streak integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE magnum_pets ADD COLUMN IF NOT EXISTS last_play_at timestamptz`;
  await sql`ALTER TABLE magnum_pets ADD COLUMN IF NOT EXISTS last_sleep_at timestamptz`;
  await sql`ALTER TABLE magnum_pets ADD COLUMN IF NOT EXISTS last_claim_at timestamptz`;
  await sql`ALTER TABLE magnum_pets ADD COLUMN IF NOT EXISTS streak integer DEFAULT 0`;
}
async function getOrCreatePet(userId:number){
  await ensurePetTable();
  const sql=getSql();
  const rows=await sql`SELECT user_id, stage, xp, hunger, happiness, energy, last_tick, last_play_at, last_sleep_at, last_claim_at, streak, updated_at FROM magnum_pets WHERE user_id=${userId} LIMIT 1`;
  if(rows.length) return rows[0] as {user_id:number;stage:number;xp:number;hunger:number;happiness:number;energy:number;last_tick:string;last_play_at:string|null;last_sleep_at:string|null;last_claim_at:string|null;streak:number;updated_at:string};
  const ins=await sql`INSERT INTO magnum_pets (user_id, stage, xp, hunger, happiness, energy, last_tick, streak) VALUES (${userId}, 0, 0, 70, 70, 70, now(), 0) RETURNING user_id, stage, xp, hunger, happiness, energy, last_tick, last_play_at, last_sleep_at, last_claim_at, streak, updated_at`;
  return ins[0] as {user_id:number;stage:number;xp:number;hunger:number;happiness:number;energy:number;last_tick:string;last_play_at:string|null;last_sleep_at:string|null;last_claim_at:string|null;streak:number;updated_at:string};
}
function applyPetOfflineTick(p:{hunger:number;happiness:number;energy:number;last_tick:string}){
  const elapsedMs=Date.now()-new Date(p.last_tick).getTime();
  const hours=Math.min(24, Math.max(0, Math.floor(elapsedMs/3600000)));
  if(hours<=0) return {hunger:p.hunger, happiness:p.happiness, energy:p.energy, hours:0, decay:0};
  const dec=hours*1;
  return {hunger:Math.max(0, Number(p.hunger)-dec), happiness:Math.max(0, Number(p.happiness)-dec), energy:Math.max(0, Number(p.energy)-dec), hours, decay:dec};
}
async function handlePetGet(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  try{
    const pet=await getOrCreatePet(user.id);
    const tick=applyPetOfflineTick(pet as unknown as {hunger:number;happiness:number;energy:number;last_tick:string});
    let hunger=tick.hunger, happiness=tick.happiness, energy=tick.energy;
    const stage=petStageFromXp(Number(pet.xp));
    if(tick.hours>0){
      const sql=getSql();
      await sql`UPDATE magnum_pets SET hunger=${hunger}, happiness=${happiness}, energy=${energy}, last_tick=now(), stage=${stage}, updated_at=now() WHERE user_id=${user.id}`;
    } else if(stage!==Number(pet.stage)){
      const sql=getSql();
      await sql`UPDATE magnum_pets SET stage=${stage}, updated_at=now() WHERE user_id=${user.id}`;
    }
    const xp=Number(pet.xp);
    const coinsR=await getSql()`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const balance=coinsR.length?Number((coinsR[0] as {balance:number}).balance):1000;
    const dustR=await getSql()`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
    const dust=dustR.length?Number((dustR[0] as {balance:number}).balance):0;
    const miningBonus=petMiningBonusPct(stage);
    const conveyorBonus=petConveyorBonusPct(stage);
    const canClaimDaily=(()=>{ if(!pet.last_claim_at) return true; const diff=(Date.now()-new Date(pet.last_claim_at).getTime())/3600000; return diff>=20; })();
    return Response.json({ ok:true, pet:{ user_id:user.id, stage, xp, hunger, happiness, energy, last_tick: new Date().toISOString(), last_play_at:pet.last_play_at, last_sleep_at:pet.last_sleep_at, last_claim_at:pet.last_claim_at, streak:Number(pet.streak||0), updated_at:pet.updated_at, thresholds:PET_STAGE_XP, stageName:["яйцо","личинка","медуза","титан"][stage], emoji:["🥚","🐛","🪼","🐉"][stage], miningBonus, conveyorBonus, buff:`+${miningBonus}% mining${conveyorBonus?` · +${conveyorBonus}% conveyor`:``}${stage>=3?` · кейс/день`:``}` }, balance, dust, offline:{hours:tick.hours, decay:tick.decay}, canClaimDaily, nextStageXp: stage<3?PET_STAGE_XP[stage+1]:null });
  }catch(e){ console.error("[pet get] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handlePetFeed(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pet:feed:${user.id}:${ip}`,20,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{
    const pet=await getOrCreatePet(user.id);
    const tick=applyPetOfflineTick(pet as unknown as {hunger:number;happiness:number;energy:number;last_tick:string});
    let hunger=tick.hunger, happiness=tick.happiness, energy=tick.energy;
    const sql=getSql();
    const coinsR=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    let bal=coinsR.length?Number((coinsR[0] as {balance:number}).balance):1000;
    if(coinsR.length===0) await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    if(bal<PET_FEED_COST) return Response.json({error:"not enough coins", required:PET_FEED_COST, balance:bal},{status:402});
    const newHunger=Math.min(100, hunger+PET_FEED_HUNGER);
    const newXp=Number(pet.xp)+PET_FEED_XP;
    const newStage=petStageFromXp(newXp);
    const prevStage=Number(pet.stage);
    const evolved=newStage>prevStage;
    await sql`UPDATE magnum_coins SET balance=balance-${PET_FEED_COST} WHERE user_id=${user.id}`;
    await sql`UPDATE magnum_pets SET hunger=${newHunger}, happiness=${happiness}, energy=${energy}, xp=${newXp}, stage=${newStage}, last_tick=now(), updated_at=now() WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-PET_FEED_COST},'pet_feed',${JSON.stringify({xp:PET_FEED_XP, hunger:PET_FEED_HUNGER, stage:newStage, evolved})}::jsonb)`;
    if(evolved){
      try{ await sql`INSERT INTO magnum_leaderboard (player,score,game) VALUES (${user.username},${newXp},'pet42')`; }catch{}
    }
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const newBal=Number((upd[0] as {balance:number}).balance);
    return Response.json({ ok:true, pet:{ stage:newStage, xp:newXp, hunger:newHunger, happiness, energy, evolved, prevStage, nextStageXp: newStage<3?PET_STAGE_XP[newStage+1]:null, stageName:["яйцо","личинка","медуза","титан"][newStage], emoji:["🥚","🐛","🪼","🐉"][newStage], miningBonus:petMiningBonusPct(newStage) }, balance:newBal, cost:PET_FEED_COST, xpGain:PET_FEED_XP });
  }catch(e){ console.error("[pet feed] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handlePetPlay(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pet:play:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{
    const pet=await getOrCreatePet(user.id);
    const tick=applyPetOfflineTick(pet as unknown as {hunger:number;happiness:number;energy:number;last_tick:string});
    let hunger=tick.hunger, happiness=tick.happiness, energy=tick.energy;
    if(pet.last_play_at){
      const diff=Date.now()-new Date(pet.last_play_at).getTime();
      if(diff<PET_PLAY_CD) return Response.json({error:"cooldown", remainingMs:PET_PLAY_CD-diff, remainingMin:Math.ceil((PET_PLAY_CD-diff)/60000)},{status:429});
    }
    const newHappy=Math.min(100, happiness+PET_PLAY_HAPPINESS);
    const newXp=Number(pet.xp)+PET_PLAY_XP;
    const newStage=petStageFromXp(newXp);
    const evolved=newStage>Number(pet.stage);
    const sql=getSql();
    await sql`UPDATE magnum_pets SET happiness=${newHappy}, hunger=${hunger}, energy=${energy}, xp=${newXp}, stage=${newStage}, last_play_at=now(), last_tick=now(), updated_at=now() WHERE user_id=${user.id}`;
    if(evolved){ try{ await sql`INSERT INTO magnum_leaderboard (player,score,game) VALUES (${user.username},${newXp},'pet42')`; }catch{} }
    return Response.json({ ok:true, pet:{ stage:newStage, xp:newXp, happiness:newHappy, hunger, energy, evolved, stageName:["яйцо","личинка","медуза","титан"][newStage], emoji:["🥚","🐛","🪼","🐉"][newStage], miningBonus:petMiningBonusPct(newStage) }, xpGain:PET_PLAY_XP });
  }catch(e){ console.error("[pet play] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handlePetSleep(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pet:sleep:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{
    const pet=await getOrCreatePet(user.id);
    const tick=applyPetOfflineTick(pet as unknown as {hunger:number;happiness:number;energy:number;last_tick:string});
    let hunger=tick.hunger, happiness=tick.happiness, energy=tick.energy;
    if(pet.last_sleep_at){
      const diff=Date.now()-new Date(pet.last_sleep_at).getTime();
      if(diff<PET_SLEEP_CD) return Response.json({error:"cooldown", remainingMs:PET_SLEEP_CD-diff, remainingMin:Math.ceil((PET_SLEEP_CD-diff)/60000)},{status:429});
    }
    const newEnergy=Math.min(100, energy+PET_SLEEP_ENERGY);
    const sql=getSql();
    await sql`UPDATE magnum_pets SET energy=${newEnergy}, hunger=${hunger}, happiness=${happiness}, last_sleep_at=now(), last_tick=now(), updated_at=now() WHERE user_id=${user.id}`;
    return Response.json({ ok:true, pet:{ energy:newEnergy, hunger, happiness, stage:petStageFromXp(Number(pet.xp)), xp:Number(pet.xp) }, energyGain:PET_SLEEP_ENERGY });
  }catch(e){ console.error("[pet sleep] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handlePetClaim(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pet:claim:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{
    const pet=await getOrCreatePet(user.id);
    const sql=getSql();
    if(pet.last_claim_at){
      const diff=(Date.now()-new Date(pet.last_claim_at).getTime())/3600000;
      if(diff<20) return Response.json({error:"already claimed", waitH:(20-diff).toFixed(1), remainingMs: Math.ceil((20*3600000 - (Date.now()-new Date(pet.last_claim_at).getTime())))},{status:429});
    }
    const isDaily=Number(pet.stage)>=3 || true; // daily +42 always, extra case only s4
    let reward=42;
    let epic=false;
    let caseReward=0;
    if(Number(pet.stage)>=3){
      caseReward=Math.floor(42+Math.random()*100); // 42-142
      epic=Math.random()<0.05;
      if(epic) caseReward=Math.max(caseReward,120);
      reward=caseReward;
    }
    const today=new Date().toISOString().slice(0,10);
    const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
    const lastClaimDate=pet.last_claim_at? new Date(pet.last_claim_at).toISOString().slice(0,10): null;
    let streak=Number(pet.streak||0);
    if(lastClaimDate===yesterday) streak=Math.min(7, streak+1);
    else if(!lastClaimDate || lastClaimDate!==today) streak=1;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`UPDATE magnum_coins SET balance=balance+${reward} WHERE user_id=${user.id}`;
    await sql`UPDATE magnum_pets SET last_claim_at=now(), streak=${streak}, updated_at=now() WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${reward},'pet_daily',${JSON.stringify({reward, caseReward, epic, stage:pet.stage, streak})}::jsonb)`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const bal=Number((upd[0] as {balance:number}).balance);
    return Response.json({ ok:true, reward, caseReward: Number(pet.stage)>=3?caseReward:null, epic, stage:Number(pet.stage), streak, balance:bal });
  }catch(e){ console.error("[pet claim] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handlePetLeaderboard():Promise<Response>{
  try{
    const sql=getSql();
    await ensurePetTable();
    const rows=await sql`SELECT player, score, created_at FROM magnum_leaderboard WHERE game='pet42' ORDER BY score DESC, created_at ASC LIMIT 20`;
    const board=rows.map((r:unknown)=>{ const x=r as {player:string;score:number;created_at:string}; return {player:String(x.player), score:Number(x.score), created_at:x.created_at}; });
    return Response.json({ ok:true, leaderboard:board, game:"pet42", count:board.length });
  }catch(e){ console.error("[pet leaderboard] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handlePetPrestige(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  try{
    const pet=await getOrCreatePet(user.id);
    if(Number(pet.xp)<1420) return Response.json({error:"need 1420 XP (титан)", xp:Number(pet.xp), required:1420},{status:402});
    await ensureDustTable();
    const sql=getSql();
    const drow=await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
    const dust=drow.length?Number((drow[0] as {balance:number}).balance):0;
    if(dust<1420) return Response.json({error:"need 1420 dust", dust, required:1420},{status:402});
    await sql`UPDATE magnum_dust SET balance=balance-1420, updated_at=now() WHERE user_id=${user.id}`;
    const skinId="pet-titan-gold";
    await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${skinId},'frame',false,now()) ON CONFLICT DO NOTHING`;
    try{ await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${skinId},'frame',false,now())`; }catch{}
    // ensure cosmetic catalog includes? fallback just insert
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-1420},'pet_prestige',${JSON.stringify({skin:skinId})}::jsonb)`;
    const nd=await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
    return Response.json({ ok:true, skin:skinId, dust: nd.length?Number((nd[0] as {balance:number}).balance):0 });
  }catch(e){
    // if magnum_cosmetics insert fails due to missing table, still deduct fallback path via magnum_shop_inventory
    console.error("[pet prestige] failed",e);
    try{
      const sql=getSql();
      await sql`INSERT INTO magnum_shop_inventory (user_id,skin_id,purchased_at,equipped) VALUES (${(await getUserByToken(extractToken(req)!) )!.id},'pet-titan-gold',now(),false)`;
      return Response.json({ ok:true, skin:"pet-titan-gold", fallback:true });
    }catch(e2){ console.error("[pet prestige fallback] failed",e2); return Response.json({error:"db error"},{status:500}); }
  }
}

// ---- STUDIO 42 — нейро-визуализатор + клип-конструктор ----
async function ensureStudioTables(): Promise<void> {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_studio_saves (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, track_slug text NOT NULL, preset text NOT NULL, scenes jsonb NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_studio_likes (id serial PRIMARY KEY, save_id integer REFERENCES magnum_studio_saves(id) ON DELETE CASCADE NOT NULL, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, created_at timestamp DEFAULT now() NOT NULL, UNIQUE(save_id, user_id))`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_studio_shares (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, day_id text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, UNIQUE(user_id, day_id))`;
}
async function handleStudioList(_req: Request): Promise<Response> {
  try {
    await ensureStudioTables();
    const sql = getSql();
    const rows = await sql`SELECT s.id, s.user_id, s.track_slug, s.preset, s.scenes, s.created_at, u.username, COALESCE(l.cnt,0)::int as likes FROM magnum_studio_saves s LEFT JOIN magnum_users u ON u.id=s.user_id LEFT JOIN (SELECT save_id, count(*) as cnt FROM magnum_studio_likes GROUP BY save_id) l ON l.save_id=s.id ORDER BY s.created_at DESC LIMIT 50`;
    const saves = rows.map((r: unknown) => {
      const x = r as { id:number; user_id:number; track_slug:string; preset:string; scenes:unknown; created_at:string; username:string|null; likes:number };
      return { id:Number(x.id), userId:Number(x.user_id), username:x.username?String(x.username):"Братуха", trackSlug:String(x.track_slug), track_slug:String(x.track_slug), preset:String(x.preset), scenes:x.scenes, likes:Number(x.likes), created_at:x.created_at };
    });
    return Response.json({ saves, count:saves.length });
  } catch(e){ console.error("[studio list] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleStudioSave(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`studio:save:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{trackSlug?:string; track_slug?:string; preset?:string; scenes?:unknown};
  try{ body=(await req.json()) as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const slugRaw=String(body.trackSlug ?? body.track_slug ?? "").trim().toLowerCase();
  if(!isStudioTrackSlug(slugRaw as never)) return Response.json({error:"trackSlug clay|vpn|nova|magnum"},{status:400});
  const presetRaw=String(body.preset ?? "").trim().toLowerCase();
  if(!isStudioPresetId(presetRaw as never)) return Response.json({error:"preset meduza-wave|neon-kuzbass|glitch-42"},{status:400});
  const scenes=validateScenes(body.scenes); if(!scenes) return Response.json({error:"scenes must be 4 {bg,text,filter}"},{status:400});
  try{
    await ensureStudioTables();
    const sql=getSql();
    const rows=await sql`INSERT INTO magnum_studio_saves (user_id, track_slug, preset, scenes) VALUES (${user.id}, ${slugRaw}, ${presetRaw}, ${JSON.stringify(scenes)}::jsonb) RETURNING id, track_slug, preset, scenes, created_at`;
    const r=rows[0] as {id:number; track_slug:string; preset:string; scenes:unknown; created_at:string};
    return Response.json({ ok:true, save:{ id:Number(r.id), trackSlug:String(r.track_slug), preset:String(r.preset), scenes:r.scenes, created_at:r.created_at }},{status:201});
  }catch(e){ console.error("[studio save] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleStudioLike(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`studio:like:${user.id}:${ip}`,20,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{saveId?:unknown; save_id?:unknown; id?:unknown};
  try{ body=(await req.json()) as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const raw=Number(body.saveId ?? body.save_id ?? body.id);
  if(!Number.isInteger(raw)||raw<=0) return Response.json({error:"saveId required"},{status:400});
  try{
    await ensureStudioTables();
    const sql=getSql();
    const ex=await sql`SELECT id FROM magnum_studio_saves WHERE id=${raw} LIMIT 1`;
    if(ex.length===0) return Response.json({error:"save not found"},{status:404});
    const dup=await sql`SELECT id FROM magnum_studio_likes WHERE save_id=${raw} AND user_id=${user.id} LIMIT 1`;
    if(dup.length>0) return Response.json({error:"already liked", saveId:raw},{status:409});
    await sql`INSERT INTO magnum_studio_likes (save_id, user_id) VALUES (${raw}, ${user.id})`;
    const cnt=await sql`SELECT count(*)::int as c FROM magnum_studio_likes WHERE save_id=${raw}`;
    return Response.json({ ok:true, saveId:raw, likes:Number((cnt[0] as {c:number}).c) });
  }catch(e){ console.error("[studio like] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleStudioLeaderboard(): Promise<Response> {
  try{
    await ensureStudioTables();
    const sql=getSql();
    const rows=await sql`SELECT s.id, s.user_id, s.track_slug, s.preset, s.scenes, s.created_at, u.username, COALESCE(l.cnt,0)::int as likes FROM magnum_studio_saves s LEFT JOIN magnum_users u ON u.id=s.user_id LEFT JOIN (SELECT save_id, count(*) as cnt FROM magnum_studio_likes WHERE created_at > now() - interval '7 days' GROUP BY save_id) l ON l.save_id=s.id WHERE s.created_at > now() - interval '7 days' ORDER BY likes DESC, s.created_at ASC LIMIT 20`;
    const top=rows.map((r: unknown)=>{
      const x=r as {id:number; user_id:number; track_slug:string; preset:string; scenes:unknown; created_at:string; username:string|null; likes:number};
      let reward=0; // placeholder: 142/420/1420 for top3 could be claimed via share? leaderboard itself is read-only
      return { id:Number(x.id), userId:Number(x.user_id), username:x.username?String(x.username):"Братуха", trackSlug:String(x.track_slug), preset:String(x.preset), scenes:x.scenes, likes:Number(x.likes), created_at:x.created_at };
    });
    // weekly rewards mapping for display: top1 1420 top2 420 top3 142
    const rewards=[1420,420,142];
    top.forEach((t,idx)=>{ (t as unknown as {reward:number}).reward = idx<3?rewards[idx]!:0; });
    return Response.json({ leaderboard:top, top, count:top.length, weekRewards:rewards });
  }catch(e){ console.error("[studio leaderboard] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleStudioShare(req: Request): Promise<Response> {
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const dayId=new Date().toISOString().slice(0,10);
  await ensureStudioTables();
  const sql=getSql();
  const dup=await sql`SELECT id FROM magnum_studio_shares WHERE user_id=${user.id} AND day_id=${dayId} LIMIT 1`;
  if(dup.length>0) return Response.json({error:"already shared today", dayId, coins:0},{status:409});
  await sql`INSERT INTO magnum_studio_shares (user_id, day_id) VALUES (${user.id}, ${dayId})`;
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'magnum-share-studio',${JSON.stringify({dayId})}::jsonb)`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, coins:42, dayId, balance:Number((upd[0] as {balance:number}).balance) });
}
void ensureStudioTables().then(()=> console.log("[startup] magnum_studio_* ensured")).catch(e=> console.error("[startup] studio ensure failed",e));

// ---- ДОСКА 42 — лента рекордов + вызовы друзей + глобальный шаринг ----
const BOARD_GAMES = ["mining","conveyor","duel","pet","studio"] as const;
type BoardGame = typeof BOARD_GAMES[number];
function isBoardGame(v:string): v is BoardGame { return (BOARD_GAMES as readonly string[]).includes(v); }
async function ensureBoardTables(): Promise<void> {
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_challenges (id serial PRIMARY KEY, challenger_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, challenged_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, game text NOT NULL, score integer NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamp DEFAULT now() NOT NULL, expires_at timestamp NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_board_shares (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, day_id text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, UNIQUE(user_id, day_id))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_board_challenges_status ON magnum_challenges(status, expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_board_challenges_challenged ON magnum_challenges(challenged_id, status)`;
}
void ensureBoardTables().then(()=> console.log("[startup] magnum_board_* ensured")).catch(e=> console.error("[startup] board ensure failed",e));

async function handleBoardFeed(req:Request):Promise<Response>{
  const url=new URL(req.url);
  const game=url.searchParams.get("game")?.trim().toLowerCase()||"";
  const tab=url.searchParams.get("tab")?.trim().toLowerCase()||"global"; // global | friends | challenges
  const page=Math.max(1, Math.min(100, Number(url.searchParams.get("page")||1)));
  const limit=20; const offset=(page-1)*limit;
  const token=extractToken(req);
  let user: {id:number; username:string}|null=null;
  if(token) try{ user=await getUserByToken(token);}catch{}
  try{
    await ensureBoardTables();
    const sql=getSql();
    // expire stale challenges
    try{ await sql`UPDATE magnum_challenges SET status='expired' WHERE status='pending' AND expires_at < now()`;}catch{}
    if(tab==="challenges" && user){
      const rows=await sql`SELECT c.id, c.challenger_id, c.challenged_id, c.game, c.score, c.status, c.created_at, c.expires_at, u1.username as challenger, u2.username as challenged FROM magnum_challenges c LEFT JOIN magnum_users u1 ON u1.id=c.challenger_id LEFT JOIN magnum_users u2 ON u2.id=c.challenged_id WHERE c.challenged_id=${user.id} AND c.status='pending' AND c.expires_at > now() ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      const items=rows.map((r:unknown)=>{ const x=r as {id:number; challenger_id:number; challenged_id:number; game:string; score:number; status:string; created_at:string; expires_at:string; challenger:string|null; challenged:string|null}; const exp=new Date(x.expires_at).getTime(); const rem=Math.max(0, exp-Date.now()); return { id:Number(x.id), challengerId:Number(x.challenger_id), challengedId:Number(x.challenged_id), challenger:x.challenger?String(x.challenger):`user#${x.challenger_id}`, challenged:x.challenged?String(x.challenged):`user#${x.challenged_id}`, game:String(x.game), score:Number(x.score), status:String(x.status), created_at:x.created_at, expires_at:x.expires_at, remainingMs:rem, remainingH:(rem/3600000).toFixed(1)};});
      return Response.json({ ok:true, tab:"challenges", items, page, limit });
    }
    // friends tab: only records from followed users
    if(tab==="friends" && user){
      const friends=await sql`SELECT following_id FROM magnum_follows WHERE follower_id=${user.id}`;
      const ids=friends.map((r:unknown)=> Number((r as {following_id:number}).following_id)).filter(n=>Number.isFinite(n));
      if(ids.length===0) return Response.json({ ok:true, tab:"friends", items:[], page, limit, note:"no friends — подпишись на братух" });
      // fetch game scores from friends only
      const idsArr=`{${ids.join(",")}}`;
      let rows: unknown[]=[];
      if(game && isBoardGame(game)){
        rows=await sql`SELECT g.game, g.score, g.created_at, u.username, u.id as user_id, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true WHERE g.user_id = ANY(${idsArr}::int[]) AND g.game=${game} ORDER BY g.score DESC, g.created_at ASC LIMIT ${limit} OFFSET ${offset}`;
      } else {
        rows=await sql`SELECT g.game, g.score, g.created_at, u.username, u.id as user_id, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true WHERE g.user_id = ANY(${idsArr}::int[]) ORDER BY g.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      }
      const items=rows.map((r:unknown)=>{ const x=r as {game:string;score:number;created_at:string;username:string;user_id:number;avatar:string|null}; return { game:String(x.game), score:Number(x.score), username:String(x.username), userId:Number(x.user_id), avatar:x.avatar||null, created_at:x.created_at, timeAgo: timeAgo(x.created_at)};});
      return Response.json({ ok:true, tab:"friends", items, page, limit });
    }
    // global tab: all records
    {
      let rows: unknown[]=[];
      if(game && isBoardGame(game)){
        rows=await sql`SELECT g.game, g.score, g.created_at, u.username, u.id as user_id, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true WHERE g.game=${game} ORDER BY g.score DESC, g.created_at ASC LIMIT ${limit} OFFSET ${offset}`;
      } else {
        rows=await sql`SELECT g.game, g.score, g.created_at, u.username, u.id as user_id, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true ORDER BY g.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      }
      const items=rows.map((r:unknown)=>{ const x=r as {game:string;score:number;created_at:string;username:string;user_id:number;avatar:string|null}; return { game:String(x.game), score:Number(x.score), username:String(x.username), userId:Number(x.user_id), avatar:x.avatar||null, created_at:x.created_at, timeAgo: timeAgo(x.created_at)};});
      return Response.json({ ok:true, tab:"global", items, page, limit, game: game||"all" });
    }
  }catch(e){ console.error("[board feed] failed",e); return Response.json({error:"db error"},{status:500});}
}
function timeAgo(iso:string):string{
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60) return "только что";
  if(d<3600) return `${Math.floor(d/60)}м назад`;
  if(d<86400) return `${Math.floor(d/3600)}ч назад`;
  return `${Math.floor(d/86400)}д назад`;
}
async function handleBoardChallenge(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`board:challenge:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{friendId?:unknown; friend_id?:unknown; game?:unknown; score?:unknown};
  try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const friendId=Number(body.friendId ?? body.friend_id);
  if(!Number.isInteger(friendId)||friendId<=0) return Response.json({error:"friendId required"},{status:400});
  if(friendId===user.id) return Response.json({error:"cannot challenge yourself"},{status:400});
  const game=String(body.game||"duel").trim().toLowerCase().slice(0,32);
  if(!isBoardGame(game)) return Response.json({error:"game must be "+BOARD_GAMES.join("|")},{status:400});
  const score=Number(body.score); if(!Number.isInteger(score)||score<0||score>999999) return Response.json({error:"score 0..999999"},{status:400});
  try{
    await ensureBoardTables();
    const sql=getSql();
    const ex=await sql`SELECT id FROM magnum_users WHERE id=${friendId} LIMIT 1`;
    if(ex.length===0) return Response.json({error:"friend not found"},{status:404});
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
    const rows=await sql`INSERT INTO magnum_challenges (challenger_id, challenged_id, game, score, status, expires_at) VALUES (${user.id}, ${friendId}, ${game}, ${score}, 'pending', ${expiresAt}) RETURNING id, challenger_id, challenged_id, game, score, status, created_at, expires_at`;
    const r=rows[0] as {id:number; challenger_id:number; challenged_id:number; game:string; score:number; status:string; created_at:string; expires_at:string};
    try{ await ensureNotification(friendId, `Вызов 42 от ${user.username}`, `${user.username} бросил вызов: ${game} ${score} — прими за 24ч! ⚔️`, "challenge"); }catch{}
    return Response.json({ ok:true, challenge:{ id:Number(r.id), challengerId:Number(r.challenger_id), challengedId:Number(r.challenged_id), game:String(r.game), score:Number(r.score), status:String(r.status), created_at:r.created_at, expires_at:r.expires_at } },{status:201});
  }catch(e){ console.error("[board challenge] failed",e); return Response.json({error:"db error"},{status:500});}
}
async function handleBoardAccept(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`board:accept:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{challengeId?:unknown; id?:unknown};
  try{ body=(await req.json()) as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const cid=Number(body.challengeId ?? body.id);
  if(!Number.isInteger(cid)||cid<=0) return Response.json({error:"challengeId required"},{status:400});
  try{
    await ensureBoardTables();
    const sql=getSql();
    await sql`UPDATE magnum_challenges SET status='expired' WHERE status='pending' AND expires_at < now()`;
    const rows=await sql`SELECT id, challenger_id, challenged_id, game, score, status, expires_at FROM magnum_challenges WHERE id=${cid} LIMIT 1`;
    if(rows.length===0) return Response.json({error:"not found"},{status:404});
    const ch=rows[0] as {id:number; challenger_id:number; challenged_id:number; game:string; score:number; status:string; expires_at:string};
    if(Number(ch.challenged_id)!==user.id) return Response.json({error:"not your challenge"},{status:403});
    if(String(ch.status)!=="pending") return Response.json({error:`already ${ch.status}`},{status:409});
    if(new Date(ch.expires_at).getTime() < Date.now()){ await sql`UPDATE magnum_challenges SET status='expired' WHERE id=${cid}`; return Response.json({error:"expired"},{status:410});}
    await sql`UPDATE magnum_challenges SET status='accepted' WHERE id=${cid}`;
    // game redirect mapping
    const gameMap:Record<string,string>={ duel:"/magnum/games/duel-volcano", mining:"/magnum/mining", conveyor:"/magnum/conveyor", pet:"/magnum/map", studio:"/magnum/shop" };
    const redirect=gameMap[String(ch.game)] || "/magnum/games/duel-volcano";
    // ELO +42 winner handled via separate settle; here we just give +10% pot if both in same squad — deferred to duel finish, not accept. Return redirect.
    return Response.json({ ok:true, challenge:{ id:cid, status:"accepted" }, redirect, game:String(ch.game), score:Number(ch.score) });
  }catch(e){ console.error("[board accept] failed",e); return Response.json({error:"db error"},{status:500});}
}
async function handleBoardShare(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const dayId=new Date().toISOString().slice(0,10);
  await ensureBoardTables();
  const sql=getSql();
  const dup=await sql`SELECT id FROM magnum_board_shares WHERE user_id=${user.id} AND day_id=${dayId} LIMIT 1`;
  if(dup.length>0) return Response.json({error:"already shared today", dayId, coins:0},{status:409});
  await sql`INSERT INTO magnum_board_shares (user_id, day_id) VALUES (${user.id}, ${dayId})`;
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'board-share',${JSON.stringify({dayId})}::jsonb)`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const balance=Number((upd[0] as {balance:number}).balance);
  const cntRes=await sql`SELECT count(*)::int as c FROM magnum_board_shares`;
  const globalCount=Number((cntRes[0] as {c:number}).c);
  return Response.json({ ok:true, coins:42, dayId, balance, globalCount });
}
async function handleBoardLeaderboard():Promise<Response>{
  try{
    await ensureBoardTables();
    const sql=getSql();
    const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-7);
    const rows=await sql`SELECT g.user_id, u.username, max(g.score)::int as best, count(*)::int as plays, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true WHERE g.created_at > ${weekStart.toISOString()} GROUP BY g.user_id, u.username, s.skin_id ORDER BY best DESC LIMIT 20`;
    const top=rows.map((r:unknown,i:number)=>{ const x=r as {user_id:number; username:string; best:number; plays:number; avatar:string|null}; const idx=i; const reward= idx===0?1420: idx===1?420: idx===2?142:0; return { rank:idx+1, userId:Number(x.user_id), username:String(x.username), score:Number(x.best), plays:Number(x.plays), avatar:x.avatar||null, reward, crown: idx<3?"conic-gold":"", isTop3: idx<3 };});
    const globalRes=await sql`SELECT count(*)::int as c FROM magnum_board_shares`;
    const globalCount=Number((globalRes[0] as {c:number}).c);
    return Response.json({ leaderboard:top, top, count:top.length, globalCount, weekRewards:[1420,420,142], crown:"conic-gold", weekStart: weekStart.toISOString() });
  }catch(e){ console.error("[board leaderboard] failed",e); return Response.json({error:"db error"},{status:500});}
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
    let exchangesCount = 0; let commentsCount = 0; let reportsCount = 0; let modLogCount = 0; let chatCount = 0; let squadCount=0; let squadBattlesCount=0;
    const healthWarnings: string[] = [];
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_mining_exchanges`; exchangesCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] mining_exchanges count failed", e); healthWarnings.push("mining_exchanges: drift"); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_idea_comments`; commentsCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] idea_comments count failed", e); healthWarnings.push("idea_comments: drift"); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_reports`; reportsCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] reports count failed", e); healthWarnings.push("reports: drift"); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_moderation_log`; modLogCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] mod_log count failed", e); healthWarnings.push("moderation_log: drift"); }
    try { const r = await sql`SELECT count(*)::int as c FROM magnum_chat_messages`; chatCount = Number((r[0] as {c:number}).c); } catch (e) { console.error("[health] chat_messages count failed", e); healthWarnings.push("chat_messages: drift"); }
    try{ const r=await sql`SELECT count(*)::int as c FROM magnum_squads`; squadCount=Number((r[0] as {c:number}).c);}catch(e){ squadCount=0; }
    try{ const r=await sql`SELECT count(*)::int as c FROM magnum_squad_battles`; squadBattlesCount=Number((r[0] as {c:number}).c);}catch(e){ squadBattlesCount=0; }
    // P0: follows/aiUsage must fail health honestly (500) on 42P01 — no try/catch masking
    const followsRes = await sql`SELECT count(*)::int as c FROM magnum_follows`;
    const followsCount = Number((followsRes[0] as {c:number}).c);
    const aiUsageRes = await sql`SELECT count(*)::int as c FROM magnum_ai_usage`;
    const aiUsageCount = Number((aiUsageRes[0] as {c:number}).c);
    const counts = {
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
        squads: squadCount,
        squadBattles: squadBattlesCount,
      };
    if (healthWarnings.length) {
      return Response.json({ ok: false, warnings: healthWarnings, counts, ts: new Date().toISOString(), uptime: process.uptime() }, { status: 500 });
    }
    return Response.json({
      ok: true,
      ts: new Date().toISOString(),
      counts,
      warnings: healthWarnings,
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
  const apiKey = process.env.XIAOMI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "XIAOMI_API_KEY not configured on server" }, { status: 500 });
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

// ---- WebSocket duel (2-4 игрока) + DUEL VOLCANO 42 2-4 volcano x11 eruption ghost wager ELO heartbeat ----
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
  // MAGMA 42 extensions
  wager: number;
  magma: Map<import("bun").ServerWebSocket<WSData>, number>;
  volcano: Map<import("bun").ServerWebSocket<WSData>, number>;
  eruptionPending: Map<import("bun").ServerWebSocket<WSData>, boolean>;
  lastClickAt: Map<import("bun").ServerWebSocket<WSData>, number>;
  heldMaxSince: Map<import("bun").ServerWebSocket<WSData>, number | null>;
  suspect: Set<import("bun").ServerWebSocket<WSData>>;
  overheatUntil: Map<import("bun").ServerWebSocket<WSData>, number>;
  heartbeat: ReturnType<typeof setInterval> | null;
  clickCounts: Map<import("bun").ServerWebSocket<WSData>, number[]>;
};

const rooms = new Map<string, DuelRoom>();
// duel42 wager hold — возврат при timeout/развале комнаты 30с если не finished
const duel42WagerHolds = new Map<string, Map<number, number>>(); // roomId -> userId->wager
const duel42WagerTimers = new Map<string, ReturnType<typeof setTimeout>>();

function roomPublic(room: DuelRoom) {
  const players: Array<{ name: string; score: number; ready: boolean; magma?: number; volcano?: number; suspect?: boolean }> = [];
  for (const ws of room.players) {
    const v = room.volcano?.get(ws) ?? room.magma.get(ws) ?? 0;
    players.push({ name: room.names.get(ws) ?? "Братуха", score: room.scores.get(ws) ?? 0, ready: wsReady.get(ws) ?? false, magma: v, volcano: v, suspect: room.suspect.has(ws) });
  }
  return { id: room.id, state: room.state, players, durationSec: room.durationSec, wager: room.wager };
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
  const room: DuelRoom = { id, players: new Set(), scores: new Map(), names: new Map(), state: "waiting", startedAt: null, timer: null, durationSec: 10, wager: 0, magma: new Map(), volcano: new Map(), lastClickAt: new Map(), heldMaxSince: new Map(), suspect: new Set(), overheatUntil: new Map(), heartbeat: null, clickCounts: new Map(), eruptionPending: new Map() };
  rooms.set(id, room);
  return room;
}
function findOrCreateRoomABCD(code?: string): DuelRoom {
  if (code) {
    const cid = code.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
    if (cid.length===4 && rooms.has(`room:${cid}`)) return rooms.get(`room:${cid}`)!;
    if (cid.length===4) {
      const r: DuelRoom = { id:`room:${cid}`, players:new Set(), scores:new Map(), names:new Map(), state:"waiting", startedAt:null, timer:null, durationSec:10, wager:0, magma:new Map(), volcano:new Map(), lastClickAt:new Map(), heldMaxSince:new Map(), suspect:new Set(), overheatUntil:new Map(), heartbeat:null, clickCounts:new Map(), eruptionPending:new Map() };
      rooms.set(r.id,r); return r;
    }
  }
  return findOrCreateRoom();
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
      const isSuspect = room.suspect.has(ws);
      scoresJson.push({ name, score, suspect: isSuspect });
      // duel42 season: skip suspect from leaderboard, otherwise persist both duel + duel42
      if (!isSuspect) {
        await sql`INSERT INTO magnum_leaderboard (player, score, game, created_at) VALUES (${name}, ${score}, 'duel', ${now})`;
        await sql`INSERT INTO magnum_leaderboard (player, score, game, created_at) VALUES (${name}, ${score}, 'duel42', ${now})`;
        try {
          const uid = Number(ws.data.id);
          if (Number.isFinite(uid) && uid > 0) {
            const gScore = Math.max(0, Math.min(999999, Math.round(score * 10) || 0));
            const coinsEarned = gScore < 10 ? 0 : Math.min(42, Math.floor(gScore / 200));
            await sql`INSERT INTO magnum_game_scores (user_id, game, score, coins_earned, meta) VALUES (${uid}, 'duel', ${gScore}, ${coinsEarned}, ${JSON.stringify({ src: 'ws-duel', room: room.id, raw: score })}::jsonb)`;
            if (coinsEarned > 0) {
              await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${uid},1000) ON CONFLICT (user_id) DO NOTHING`;
              await sql`UPDATE magnum_coins SET balance = balance + ${coinsEarned} WHERE user_id=${uid}`;
              await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${uid},${coinsEarned},'game_reward',${JSON.stringify({ game:'duel', score:gScore })}::jsonb)`;
            }
          }
        } catch (e) { console.error("[duel game_scores] failed", e); }
      }
      if (!isSuspect && score > maxScore) { maxScore = score; winner = name; }
    }
    try {
      await sql`INSERT INTO magnum_duel_history (room_id, winner, scores, duration_sec, player_count) VALUES (${room.id}, ${winner}, ${JSON.stringify(scoresJson)}::jsonb, ${room.durationSec}, ${room.players.size})`;
    } catch (e) { console.error("[duel history insert] failed", e); }
    // wager + ELO settlement (only if not all suspect and wager>0)
    if (scoresJson.length >= 2 && room.wager >= 42) {
      try {
        await sql`CREATE TABLE IF NOT EXISTS magnum_duel42_elo (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, elo integer NOT NULL DEFAULT 1000, updated_at timestamp DEFAULT now())`;
        // detect draw: top 2 equal
        const sorted = [...scoresJson].sort((a,b)=>b.score-a.score);
        const isDraw = sorted.length>=2 && sorted[0]!.score===sorted[1]!.score;
        for (const ws of room.players) {
          const name = room.names.get(ws) ?? "Братуха";
          const uid = Number(ws.data.id);
          if (!Number.isFinite(uid) || room.suspect.has(ws)) continue;
          const sc = room.scores.get(ws) ?? 0;
          const isWin = !isDraw && name===winner;
          let eloDelta = 0; let coinsDelta = 0;
          if (isDraw) { coinsDelta = room.wager; eloDelta = 0; }
          else if (isWin) { coinsDelta = room.wager * 2; eloDelta = 42; }
          else { coinsDelta = 0; eloDelta = -12; }
          if (coinsDelta>0) {
            await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${uid},1000) ON CONFLICT (user_id) DO NOTHING`;
            await sql`UPDATE magnum_coins SET balance = balance + ${coinsDelta} WHERE user_id=${uid}`;
            await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${uid},${coinsDelta},${isWin?'duel42_win':'duel42_draw'},${JSON.stringify({room:room.id,wager:room.wager,winner})}::jsonb)`;
          }
          await sql`INSERT INTO magnum_duel42_elo (user_id,elo) VALUES (${uid},1000) ON CONFLICT (user_id) DO NOTHING`;
          if (eloDelta!==0) await sql`UPDATE magnum_duel42_elo SET elo = elo + ${eloDelta}, updated_at=now() WHERE user_id=${uid}`;
        }
      } catch(e){ console.error("[duel42 settle] failed",e); }
    }
    // squad battles persistence: if room is squad:* also insert into magnum_squad_battles + ELO + pot 10%
    if (room.id.startsWith("squad:")) {
      try{
        const code=`B42-${room.id.replace("squad:","")}`;
        const sqRows=await sql`SELECT id, pot FROM magnum_squads WHERE code=${code} LIMIT 1`;
        if(sqRows.length>0){
          const sid=Number((sqRows[0] as any).id);
          const pot=Number((sqRows[0] as any).pot);
          // find winner ws
          let winnerWs: import("bun").ServerWebSocket<WSData>|null=null;
          let winnerUid:number|null=null;
          for(const ws of room.players){ const n=room.names.get(ws); if(n===winner && !room.suspect.has(ws)) { winnerWs=ws; winnerUid=Number(ws.data.id); break; } }
          const scoreJson={ room:room.id, winner, scores:scoresJson, durationSec:room.durationSec };
          await sql`INSERT INTO magnum_squad_battles (squad_id, winner_id, score) VALUES (${sid}, ${winnerUid}, ${JSON.stringify(scoreJson)}::jsonb)`;
          // winner gets +42 ELO (duel42_elo) + 10% pot coins
          if(winnerWs && winnerUid){
            await sql`CREATE TABLE IF NOT EXISTS magnum_duel42_elo (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, elo integer NOT NULL DEFAULT 1000, updated_at timestamp DEFAULT now())`;
            await sql`INSERT INTO magnum_duel42_elo (user_id,elo) VALUES (${winnerUid},1000) ON CONFLICT (user_id) DO NOTHING`;
            await sql`UPDATE magnum_duel42_elo SET elo=elo+42, updated_at=now() WHERE user_id=${winnerUid}`;
            const potBonus=Math.floor(pot*0.1);
            if(potBonus>0){
              await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${winnerUid},1000) ON CONFLICT (user_id) DO NOTHING`;
              await sql`UPDATE magnum_coins SET balance=balance+${potBonus} WHERE user_id=${winnerUid}`;
              await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${winnerUid},${potBonus},'squad_win_pot',${JSON.stringify({squadId:sid,pot,winner})}::jsonb)`;
            }
            await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${winnerUid},42,'squad_elo',${JSON.stringify({squadId:sid,winner})}::jsonb)`;
          }
        }
      }catch(e){ console.error("[squad persist] failed",e); }
    }
    // cleanup wager holds — prevent 30s refund after normal finish
    try{
      const hk=room.id;
      if(duel42WagerHolds.has(hk)){ duel42WagerHolds.delete(hk); }
      if(duel42WagerTimers.has(hk)){ clearTimeout(duel42WagerTimers.get(hk)!); duel42WagerTimers.delete(hk); }
      // also clear any hold:* that matches room
      for(const k of [...duel42WagerHolds.keys()]){ if(k.includes(hk) || hk.includes(k)) { duel42WagerHolds.delete(k); if(duel42WagerTimers.has(k)){ clearTimeout(duel42WagerTimers.get(k)!); duel42WagerTimers.delete(k); } } }
      // mark DB holds as settled (refunded=true to avoid double refund logic)
      try{ const s=getSql(); await s`UPDATE magnum_duel42_wager_hold SET refunded=true WHERE room_id=${hk} AND refunded=false`; }catch{}
    }catch{}
  } catch (e) {
    console.error("[ws persist] failed", e);
  }
}

function startDuel(room: DuelRoom) {
  if (room.state === "playing") return;
  room.state = "playing";
  room.startedAt = Date.now();
  // reset scores for new round
  for (const ws of room.players) { room.scores.set(ws, 0); room.magma.set(ws,0); room.volcano.set(ws,0); room.lastClickAt.set(ws,0); room.heldMaxSince.set(ws,null); room.overheatUntil.set(ws,0); room.suspect.delete(ws); room.clickCounts.set(ws, []); room.eruptionPending.set(ws,false); }
  broadcast(room, { type: "start", room: roomPublic(room), duration: room.durationSec });
  // heartbeat 25s
  if (room.heartbeat) clearInterval(room.heartbeat);
  room.heartbeat = setInterval(()=>{ broadcast(room,{type:"ping"}); },25000);
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    room.state = "finished";
    if (room.heartbeat) { clearInterval(room.heartbeat); room.heartbeat=null; }
    broadcast(room, { type: "finish", room: roomPublic(room) });
    void persistDuelResults(room);
    // reset to waiting after 5s for rematch
    setTimeout(() => {
      room.state = "waiting";
      for (const ws of room.players) { room.scores.set(ws, 0); room.magma.set(ws,0); room.volcano.set(ws,0); room.suspect.delete(ws); room.eruptionPending.set(ws,false); }
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
    if (url.pathname === "/magnum/api/squad" || url.pathname === "/magnum/api/squad/") {
      const token = extractToken(req);
      if (!token) return Response.json({ error: "unauthorized — войди, братуха" }, { status: 401 });
      let user: { id: number; username: string } | null = null;
      try { user = await getUserByToken(token); } catch (e) { console.error("[ws squad] getUserByToken failed", e); }
      if (!user) return Response.json({ error: "unauthorized — войди, братуха" }, { status: 401 });
      // need squad membership to enter squad WS; create/find squad room
      try{ await ensureSquadTables(); }catch{}
      try{
        const sql=getSql();
        const mem=await sql`SELECT squad_id FROM magnum_squad_members WHERE user_id=${user.id} LIMIT 1`;
        if(mem.length===0) return Response.json({ error: "no squad — создай батальон" }, { status: 400 });
        const sid=Number((mem[0] as any).squad_id);
        const sq=await sql`SELECT code FROM magnum_squads WHERE id=${sid} LIMIT 1`;
        const code=sq.length?String((sq[0] as any).code).replace("B42-",""):String(sid);
        const roomId=`squad:${code}`;
        if(!rooms.has(roomId)){
          const nr: DuelRoom = { id:roomId, players:new Set(), scores:new Map(), names:new Map(), state:"waiting", startedAt:null, timer:null, durationSec:10, wager:0, magma:new Map(), volcano:new Map(), lastClickAt:new Map(), heldMaxSince:new Map(), suspect:new Set(), overheatUntil:new Map(), heartbeat:null, clickCounts:new Map(), eruptionPending:new Map() };
          rooms.set(roomId,nr);
        }
        const ok = server.upgrade(req, { data: { id: String(user.id), username: user.username, roomId } });
        if (ok) return undefined as unknown as Response;
        return Response.json({ error: "Upgrade failed" }, { status: 426 });
      }catch(e){ console.error("[squad ws upgrade] failed",e); return Response.json({error:"db error"},{status:500}); }
    }
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
    if (url.pathname === "/magnum/api/eco/challenge" && req.method === "GET") return handleEcoChallengeGet(req);
    if (url.pathname === "/magnum/api/eco/challenge/claim" && req.method === "POST") return handleEcoChallengeClaim(req);
    if (url.pathname === "/magnum/api/eco/challenge/freeze" && req.method === "POST") return handleEcoFreeze(req);
    if (url.pathname === "/magnum/api/eco/share" && req.method === "POST") return handleEcoShare(req);
    // map kuzbass
    if (url.pathname === "/magnum/api/map/progress" && req.method === "GET") return handleMapProgress(req);
    if (url.pathname === "/magnum/api/map/answer" && req.method === "POST") return handleMapAnswer(req);
    if (url.pathname === "/magnum/api/map/boss" && req.method === "POST") return handleMapBoss(req);
    if (url.pathname === "/magnum/api/map/share" && req.method === "POST") return handleMapShare(req);
    if (url.pathname === "/magnum/api/map/freeze" && req.method === "POST") return handleMapFreeze(req);
    if (url.pathname === "/magnum/api/map/verify" && req.method === "POST") return handleMapVerify(req);

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
    if (url.pathname === "/magnum/api/shop/subscriptions" && req.method === "GET") return handleShopSubscriptions(req);
    if (url.pathname === "/magnum/api/shop/bundles" && req.method === "GET") return handleShopBundleCatalog();
    if (url.pathname === "/magnum/api/shop/bundle/buy" && req.method === "POST") return handleShopBundleBuy(req);
    if (url.pathname === "/magnum/api/shop/prism" && req.method === "GET") return handlePrismCatalog();
    if (url.pathname === "/magnum/api/shop/glacier" && req.method === "GET") return handleGlacierCatalog();
    if (url.pathname === "/magnum/api/shop/crystal" && req.method === "GET") return handleCrystalCatalog();
    if (url.pathname === "/magnum/api/shop/volcano" && req.method === "GET") return handleVolcanoCatalog();
    if (url.pathname === "/magnum/api/shop/obsidian" && req.method === "GET") return handleObsidianCatalog();
    if (url.pathname === "/magnum/api/shop/dust" && req.method === "GET") return handleDustGet(req);
    if (url.pathname === "/magnum/api/shop/dismantle" && req.method === "POST") return handleDismantle(req);
    if (url.pathname === "/magnum/api/shop/craft" && req.method === "POST") return handlePrismCraft(req);
    if (url.pathname === "/magnum/api/shop/prism/craft" && req.method === "POST") return handlePrismCraft(req);
    if (url.pathname === "/magnum/api/shop/glacier/craft" && req.method === "POST") return handleGlacierCraft(req);
    if (url.pathname === "/magnum/api/shop/crystal/craft" && req.method === "POST") return handleCrystalCraft(req);
    if (url.pathname === "/magnum/api/shop/volcano/craft" && req.method === "POST") return handleVolcanoCraft(req);
    if (url.pathname === "/magnum/api/shop/obsidian/craft" && req.method === "POST") return handleObsidianCraft(req);
    if (url.pathname === "/magnum/api/shop/forge" && req.method === "POST") return handleGlacierCraft(req);

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
    // P0 funnel alias: /magnum/api/game/score (singular) → same handler for checklist
    if (url.pathname === "/magnum/api/game/score" && req.method === "POST") return handleGameSubmit(req);
    if (url.pathname === "/magnum/api/games/top" && req.method === "GET") return handleGameTop(req);
    if (url.pathname === "/magnum/api/games/my" && req.method === "GET") return handleGameMy(req);
    // referrals 42 (code = USERNAME+id36+42, reward 42 each)
    if (url.pathname === "/magnum/api/referral/code" && req.method === "GET") return handleReferralCode(req);
    if (url.pathname === "/magnum/api/referral/prestige" && req.method === "GET") return handleReferralPrestige(req);
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
    if (url.pathname === "/magnum/api/duel42/leaderboard" && req.method === "GET") return handleDuel42Leaderboard(req);
    if (url.pathname === "/magnum/api/leaderboard" && req.method === "GET") return handleLeaderboard(req);
    if (url.pathname === "/magnum/api/duel42/elo" && req.method === "GET") return handleDuel42Elo(req);
    if (url.pathname === "/magnum/api/duel42/wager" && req.method === "POST") return handleDuel42Wager(req);
    if (url.pathname === "/magnum/api/arena/claim" && req.method === "POST") return handleArenaClaim(req);
    if (url.pathname === "/magnum/api/squad/create" && req.method === "POST") return handleSquadCreate(req);
    if (url.pathname === "/magnum/api/squad/join" && req.method === "POST") return handleSquadJoin(req);
    if (url.pathname === "/magnum/api/squad/pot" && req.method === "POST") return handleSquadPot(req);
    if (url.pathname === "/magnum/api/squad/my" && req.method === "GET") return handleSquadMy(req);
    if (url.pathname === "/magnum/api/squad/battles" && req.method === "GET") return handleSquadBattles(req);
    if (url.pathname === "/magnum/api/mining/boost" && req.method === "POST") return handleMiningBoost(req);
    if (url.pathname === "/magnum/api/mining/boost" && req.method === "GET") return handleMiningBoost(req);
    // conveyor 42
    if (url.pathname === "/magnum/api/conveyor/state" && req.method === "GET") return handleConveyorState(req);
    if (url.pathname === "/magnum/api/conveyor/claim" && req.method === "POST") return handleConveyorClaim(req);
    if (url.pathname === "/magnum/api/conveyor/upgrade" && req.method === "POST") return handleConveyorUpgrade(req);
    if (url.pathname === "/magnum/api/conveyor/prestige" && req.method === "POST") return handleConveyorPrestige(req);
    // board 42 — лента рекордов + вызовы + шаринг
    if (url.pathname === "/magnum/api/board/feed" && req.method === "GET") return handleBoardFeed(req);
    if (url.pathname === "/magnum/api/board/challenge" && req.method === "POST") return handleBoardChallenge(req);
    if (url.pathname === "/magnum/api/board/accept" && req.method === "POST") return handleBoardAccept(req);
    if (url.pathname === "/magnum/api/board/share" && req.method === "POST") return handleBoardShare(req);
    if (url.pathname === "/magnum/api/board/leaderboard" && req.method === "GET") return handleBoardLeaderboard();
    // pet 42 — тамагочи
    if (url.pathname === "/magnum/api/pet" && req.method === "GET") return handlePetGet(req);
    if (url.pathname === "/magnum/api/pet/feed" && req.method === "POST") return handlePetFeed(req);
    if (url.pathname === "/magnum/api/pet/play" && req.method === "POST") return handlePetPlay(req);
    if (url.pathname === "/magnum/api/pet/sleep" && req.method === "POST") return handlePetSleep(req);
    if (url.pathname === "/magnum/api/pet/claim" && req.method === "POST") return handlePetClaim(req);
    if (url.pathname === "/magnum/api/pet/leaderboard" && req.method === "GET") return handlePetLeaderboard();
    if (url.pathname === "/magnum/api/pet/prestige" && req.method === "POST") return handlePetPrestige(req);
    // studio 42
    if (url.pathname === "/magnum/api/studio/list" && req.method === "GET") return handleStudioList(req);
    if (url.pathname === "/magnum/api/studio/save" && req.method === "POST") return handleStudioSave(req);
    if (url.pathname === "/magnum/api/studio/like" && req.method === "POST") return handleStudioLike(req);
    if (url.pathname === "/magnum/api/studio/leaderboard" && req.method === "GET") return handleStudioLeaderboard();
    if (url.pathname === "/magnum/api/studio/share" && req.method === "POST") return handleStudioShare(req);
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
    if (url.pathname === "/magnum/api/log" && req.method === "POST") return handleLog(req);

    // SPEC-42: unknown /magnum/api/* → 404 JSON (не отдавать index.html — SPA fallback только для страниц)
    if (url.pathname.startsWith("/magnum/api/")) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

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
      const preRoomId=(ws.data as WSData).roomId;
      let room: DuelRoom;
      if(preRoomId && preRoomId.startsWith("squad:") && rooms.has(preRoomId)){
        room=rooms.get(preRoomId)!;
      } else {
        room = findOrCreateRoom();
        (ws.data as WSData).roomId = room.id;
      }
      room.players.add(ws);
      room.scores.set(ws, 0);
      room.names.set(ws, ws.data.username);
      room.magma.set(ws,0); room.volcano.set(ws,0); room.lastClickAt.set(ws,0); room.heldMaxSince.set(ws,null); room.overheatUntil.set(ws,0); room.clickCounts.set(ws,[]); room.eruptionPending.set(ws,false);
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
      // allow lobby:create before room assigned
      let parsed: unknown;
      try { parsed = JSON.parse(String(message)); } catch { return; }
      const msg = parsed as { type?: string; username?: string; text?: string; message?: string; code?: string; wager?: unknown; magma?: unknown };
      // lobby:create → ABCD
      if (msg.type === "lobby:create") {
        const w = [0,42,142,420].includes(Number(msg.wager)) ? Number(msg.wager) : 0;
        const letters="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let abcd=""; for(let i=0;i<4;i++) abcd+=letters[Math.floor(Math.random()*letters.length)]!;
        const nr: DuelRoom = { id:`room:${abcd}`, players:new Set(), scores:new Map(), names:new Map(), state:"waiting", startedAt:null, timer:null, durationSec:10, wager:w, magma:new Map(), volcano:new Map(), lastClickAt:new Map(), heldMaxSince:new Map(), suspect:new Set(), overheatUntil:new Map(), heartbeat:null, clickCounts:new Map(), eruptionPending:new Map() };
        rooms.set(nr.id,nr);
        // move ws to new room
        const oldId = data.roomId; if(oldId){ const old=rooms.get(oldId); if(old){ old.players.delete(ws); old.scores.delete(ws); old.names.delete(ws); try{ws.unsubscribe(oldId);}catch{} } }
        nr.players.add(ws); nr.scores.set(ws,0); nr.names.set(ws, ws.data.username); nr.magma.set(ws,0); nr.volcano.set(ws,0); nr.lastClickAt.set(ws,0); nr.heldMaxSince.set(ws,null); (ws.data as WSData).roomId=nr.id; ws.subscribe(nr.id); wsReady.set(ws,false);
        broadcast(nr,{type:"lobby:created", code:abcd, room:roomPublic(nr), wager:w}); broadcast(nr,{type:"room", room:roomPublic(nr)}); return;
      }
      if (msg.type === "join" && typeof msg.code === "string" && msg.code.trim().length===4) {
        const code = msg.code.trim().toUpperCase(); const target = rooms.get(`room:${code}`);
        if(target && target.players.size<4 && target.state==="waiting"){
          const oldId=data.roomId; if(oldId && oldId!==target.id){ const old=rooms.get(oldId); if(old){ old.players.delete(ws); old.scores.delete(ws); old.names.delete(ws); try{ws.unsubscribe(oldId);}catch{} } }
          target.players.add(ws); target.scores.set(ws,0); target.names.set(ws, ws.data.username); target.magma.set(ws,0); target.volcano.set(ws,0); (ws.data as WSData).roomId=target.id; ws.subscribe(target.id); wsReady.set(ws,false);
          broadcast(target,{type:"room", room:roomPublic(target)}); return;
        }
      }
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      // re-parse for room-bound messages already have msg
      if (msg.type === "click") {
        if (room.state !== "playing") return;
        if (!wsRateOk(ws.data.id)) { room.suspect.add(ws); broadcast(room,{type:"suspect", from:ws.data.username, toast:"братуха, газуй мягче — nitro перегрев 🔥"}); return; }
        // nitro overheat 3с -> 1с кулдаун -50% (NITRO 42 spec) + ghost-nitro trail
        const ohUntil = room.overheatUntil.get(ws) ?? 0;
        if (Date.now() < ohUntil) return;
        // CPS>20 suspect throttle 30/сек heartbeat 25с — anti-cheat
        const now = Date.now();
        const arr = room.clickCounts.get(ws) ?? [];
        const fresh = arr.filter(t=> now - t < 1000);
        fresh.push(now); room.clickCounts.set(ws, fresh);
        const total10 = (room.clickCounts.get(ws) ?? []).filter(t=> now - t < 10000).length;
        if (fresh.length>20 || total10>165) { room.suspect.add(ws); broadcast(room,{type:"suspect", from:ws.data.username, cps:fresh.length, ghost:true, toast:"братуха, ты nitro-призрак? 👻"}); }
        // NITRO 42 logic: nitro <0.18с +9% капа x9 (1.0..1.72), overheat 3с удержания x9 -> 1с кулдаун -50%
        const last = room.lastClickAt.get(ws) ?? 0;
        const dt = last? now - last : 999;
        let nitro = room.volcano.get(ws) ?? room.magma.get(ws) ?? 0;
        if (dt < 180) nitro = Math.min(9, nitro+1); else nitro = 1;
        room.volcano.set(ws, nitro); room.magma.set(ws, nitro); (room as unknown as { nitro: Map<unknown,number> }).nitro?.set?.(ws,nitro); room.lastClickAt.set(ws, now);
        let held = room.heldMaxSince.get(ws) ?? null;
        if (nitro>=9) { if(held===null) held=now; } else held=null;
        room.heldMaxSince.set(ws, held);
        const heldMs = held!==null? now - held : 0;
        const overheat = heldMs >= 3000;
        let cur = room.scores.get(ws) ?? 0;
        let mult = nitro<=1?1:Math.min(1.72, 1+(nitro-1)*0.09);
        let add = 1*mult;
        // ghost-nitro pending: at x9 next click triggers ghost trail? use eruptionPending as nitro-burst
        const nitroBurstReady = room.eruptionPending.get(ws)===true;
        if (nitroBurstReady) { add *= 1.5; room.eruptionPending.set(ws,false); }
        const nitroBurst = nitro>=9 && !nitroBurstReady;
        if (nitroBurst) room.eruptionPending.set(ws,true);
        const ghostTrail = nitro>=6 || room.suspect.has(ws);
        if (overheat) { add = cur*0.5 - cur; room.overheatUntil.set(ws, now+1000); room.heldMaxSince.set(ws,null); room.eruptionPending.set(ws,false); broadcast(room,{type:"overheat", from:ws.data.username, ghost:true}); }
        cur = Math.max(0, cur + add);
        room.scores.set(ws, cur);
        broadcast(room, { type: "tick", from:ws.data.username, nitro, magma:nitro, volcano:nitro, score:cur, nitroBurst, eruption:nitroBurst, eruptionPending: room.eruptionPending.get(ws)??false, overheat, ghostTrail, ghost:ghostTrail, lavaSpike: nitroBurst });
        broadcast(room, { type: "scores", room: roomPublic(room) });
      } else if (msg.type === "ping") { try{ ws.send(JSON.stringify({type:"pong"})); }catch{} return;
      } else if (msg.type === "pong") { return;
      } else if (msg.type === "chat") {
        const raw = typeof msg.text === "string" ? msg.text : typeof msg.message === "string" ? msg.message : "";
        const text = raw.trim().slice(0, 200);
        if (!text || text.length < 1) return;
        if (text.includes("<") || text.includes(">")) return;
        if (!wsChatRateOk(ws.data.id)) return;
        broadcast(room, { type: "chat", from: ws.data.username, text, at: new Date().toISOString() });
      } else if (msg.type === "start") {
        if (room.state === "waiting" && room.players.size >= 1) startDuel(room);
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
        const wager = Math.max(0, Math.min(420, Math.floor(Number((msg as {wager?:unknown}).wager ?? 0))));
        if(![0,42,142,420].includes(wager)) return;
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
      room.magma.delete(ws); room.volcano.delete(ws); room.lastClickAt.delete(ws); room.heldMaxSince.delete(ws); room.overheatUntil.delete(ws); room.clickCounts.delete(ws); room.suspect.delete(ws); room.eruptionPending.delete(ws);
      wsReady.delete(ws);
      wsClickTimes.delete(ws.data.id);
      wsChatTimes.delete(ws.data.id);
      try { ws.unsubscribe(roomId); } catch (e) { console.error("[ws unsubscribe] failed", e); }
      if (room.players.size === 0) {
        if (room.timer) clearTimeout(room.timer); if(room.heartbeat) clearInterval(room.heartbeat);
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
