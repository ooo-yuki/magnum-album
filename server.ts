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
import type { BannerType, Rarity as GachaRarity } from "./src/lib/gacha.ts";
import { XP_PER_LEVEL, MAX_LEVEL, SEASON_ID, PASS_REWARDS, xpForSource } from "./src/lib/pass42.ts";
import { TRACKS as CHARTS_TRACKS, seededSnapshots, isPeriod } from "./src/lib/charts42.ts";
import { FLASHMOB_TYPES, hashDayToSeed, getFlashmobForDay } from "./src/lib/flashmob42.ts";
import { SPIN_SECTORS, getStreakMultiplier } from "./src/lib/spinRewards.ts";
import { TOUR_STOPS as TOUR_STOPS_CANON, type TourStop as TourStopCanon, getTourCityId as getTourCityIdCanon, isTourCityId as isTourCityIdCanon } from "./src/lib/tour42.ts";
import { QUEST_DEFS, WEEKLY_DEF, weekId as gachaWeekId, dayId as gachaDayId, eligibleComeback, COMEBACK_REWARD_ROLLS, COMEBACK_COINS } from "./src/lib/gachaQuests.ts";
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
  const RESERVED_NAMES = new Set(["admin", "support", "magnum", "system", "moderator", "bot"]);
  const usernameRaw = typeof body.username === "string" ? body.username.trim() : "";
  // Дефис разрешён: 1-клик регистрация выдаёт brat-xxxxxx. Раньше запрещённые
  // символы молча вырезались — юзер получал не тот логин, который вводил.
  const username = usernameRaw.toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const referralRaw = typeof body.referralCode === "string" ? body.referralCode.trim() : typeof body.referral_code === "string" ? body.referral_code.trim() : typeof body.code === "string" ? body.code.trim() : typeof body.bratCode === "string" ? body.bratCode.trim() : "";
  if (!/^[a-z0-9_-]{3,32}$/.test(username) || username.startsWith("-") || username.endsWith("-") || username.includes("--")) {
    return Response.json({ error: "username invalid: 3-32 [a-z0-9_-], дефис не в начале/конце" }, { status: 400 });
  }
  if (RESERVED_NAMES.has(username)) return Response.json({ error: "username reserved" }, { status: 409 });
  if (!password || password.length < 8) return Response.json({ error: "password min 8 chars" }, { status: 400 });

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

// ---- Косметика в публичных рейтингах ----
// Один запрос на весь лидерборд: username → {frame, banner, title} из magnum_cosmetics(equipped).
// Клиент достаёт стиль по id из src/lib/cosmetics.ts, поэтому отдаём только id.
export type EquippedCosmetics = { frame: string | null; banner: string | null; title: string | null };
const NO_COSMETICS: EquippedCosmetics = { frame: null, banner: null, title: null };

async function fetchCosmeticsByUsername(usernames: Array<string | null | undefined>): Promise<Map<string, EquippedCosmetics>> {
  const out = new Map<string, EquippedCosmetics>();
  const uniq = [...new Set(usernames.filter((u): u is string => typeof u === "string" && u.length > 0))];
  if (uniq.length === 0) return out;
  try {
    const sql = getSql();
    const rows = await sql`SELECT u.username, mc.slot, mc.cosmetic_id FROM magnum_cosmetics mc JOIN magnum_users u ON u.id = mc.user_id WHERE mc.equipped = true AND u.username = ANY(${uniq}::text[])`;
    for (const r of rows as Array<{ username: string; slot: string; cosmetic_id: string }>) {
      const key = String(r.username);
      const cur = out.get(key) ?? { frame: null, banner: null, title: null };
      const slot = String(r.slot);
      if (slot === "frame" || slot === "banner" || slot === "title") cur[slot] = String(r.cosmetic_id);
      out.set(key, cur);
    }
  } catch (e) {
    // косметика — украшение: её отсутствие не должно ронять лидерборд
    console.error("[cosmetics lookup] failed", e);
  }
  return out;
}

// Добавляет frame/banner/title к строкам лидерборда (ключ — username или player).
async function decorateWithCosmetics<T extends Record<string, unknown>>(rows: T[]): Promise<Array<T & EquippedCosmetics>> {
  const keyOf = (r: T): string => String((r as { username?: unknown }).username ?? (r as { player?: unknown }).player ?? "");
  const map = await fetchCosmeticsByUsername(rows.map(keyOf));
  return rows.map((r) => ({ ...r, ...(map.get(keyOf(r)) ?? NO_COSMETICS) }));
}

// ---- Coins leaderboard (top 20) ----
async function handleCoinsTop(): Promise<Response> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT u.username, c.balance, s.skin_id as avatar, COALESCE(f.verified,false) as verified FROM magnum_coins c JOIN magnum_users u ON u.hidden=false AND u.id=c.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=c.user_id AND s.equipped=true LEFT JOIN magnum_frames f ON f.user_id=c.user_id ORDER BY c.balance DESC LIMIT 20`;
    const mapped = rows.map((r: unknown) => {
      const x = r as { username: string; balance: number; avatar: string | null; verified: boolean | null };
      return { username: String(x.username), balance: Number(x.balance), avatar: x.avatar || null, verified: Boolean(x.verified) };
    });
    const top = await decorateWithCosmetics(mapped);
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
// Цены скинов и редкостей — единый источник: src/lib/shopCatalog.ts (SKINS)
// и src/lib/cosmetics.ts (RARITY_PRICE). Здесь только алиасы для legacy-клиентов.
const SHOP_PRICES: Record<string, number> = {
  ...Object.fromEntries(SKINS.map((sk) => [sk.id, sk.price])),
  "skin-common": RARITY_PRICE.common,
  "skin-rare": RARITY_PRICE.rare,
  "skin-epic": RARITY_PRICE.epic,
  "skin-legendary": RARITY_PRICE.legendary,
  "skin_42": RARITY_PRICE.common,
  "skin_142": RARITY_PRICE.rare,
  "skin_420": RARITY_PRICE.epic,
  "skin_1420": RARITY_PRICE.legendary,
  "basic": RARITY_PRICE.common,
  "rare": RARITY_PRICE.rare,
  "epic": RARITY_PRICE.epic,
  "legendary": RARITY_PRICE.legendary,
  "42": RARITY_PRICE.common,
  "142": RARITY_PRICE.rare,
  "420": RARITY_PRICE.epic,
  "1420": RARITY_PRICE.legendary,
};

function getSkinPrice(skinId: string): number | null {
  if (SHOP_PRICES[skinId] != null) return SHOP_PRICES[skinId];
  // P0 #5: strict — no heuristic fallback (was substring 42/142/etc allowed price bypass 13-33% discount abuse)
  return null;
}

// ---- Единая TOCTOU-защита покупок: транзакция + SELECT ... FOR UPDATE ----
// Двойной клик по «Купить» не должен списать монеты дважды или выдать дубликат.
type TxClient = { query: (q: string, prm?: unknown[]) => Promise<{ rows: unknown[] }> };
type PooledClient = TxClient & { release: () => void };
type PoolLike = { connect: () => Promise<PooledClient>; end: () => Promise<void> };
type TxOutcome = { ok: boolean; response: Response };

async function withCoinsLock(
  userId: number,
  fn: (client: TxClient, balance: number) => Promise<TxOutcome>,
): Promise<Response | null> {
  const unpooled = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
  if (!unpooled) return null;
  let pool: PoolLike | null = null;
  let client: PooledClient | null = null;
  try {
    pool = new Pool({ connectionString: unpooled }) as unknown as PoolLike;
    client = await pool.connect();
    if (!client) return null;
    await client.query("BEGIN");
    let balance = 0;
    const balRes = await client.query("SELECT balance FROM magnum_coins WHERE user_id=$1 FOR UPDATE", [userId]);
    if (balRes.rows.length === 0) {
      await client.query("INSERT INTO magnum_coins (user_id,balance) VALUES ($1,1000) ON CONFLICT (user_id) DO NOTHING", [userId]);
      const again = await client.query("SELECT balance FROM magnum_coins WHERE user_id=$1 FOR UPDATE", [userId]);
      balance = again.rows.length ? Number((again.rows[0] as { balance: number }).balance) : 1000;
    } else {
      balance = Number((balRes.rows[0] as { balance: number }).balance);
    }
    const out = await fn(client, balance);
    await client.query(out.ok ? "COMMIT" : "ROLLBACK");
    return out.response;
  } catch (e) {
    try { if (client) await client.query("ROLLBACK"); } catch { /* соединение уже мертво */ }
    console.error("[coins tx] failed", e);
    return null;
  } finally {
    try { if (client) client.release(); } catch { /* уже освобождён */ }
    try { if (pool) await pool.end(); } catch { /* уже закрыт */ }
  }
}

async function txBalance(client: TxClient, userId: number): Promise<number> {
  const r = await client.query("SELECT balance FROM magnum_coins WHERE user_id=$1 LIMIT 1", [userId]);
  return r.rows.length ? Number((r.rows[0] as { balance: number }).balance) : 0;
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
  // основной путь — транзакция с FOR UPDATE
  const txRes = await withCoinsLock(user.id, async (client, balance) => {
    const owned = await client.query("SELECT id FROM magnum_shop_inventory WHERE user_id=$1 AND skin_id=$2 LIMIT 1", [user.id, skinId]);
    if (owned.rows.length > 0) return { ok: false, response: Response.json({ error: "already owned", skinId }, { status: 409 }) };
    if (balance < price) return { ok: false, response: Response.json({ error: "not enough coins", price, balance, required: price }, { status: 402 }) };
    await client.query("UPDATE magnum_coins SET balance = balance - $1 WHERE user_id=$2", [price, user.id]);
    await client.query("INSERT INTO magnum_shop_inventory (user_id, skin_id, purchased_at, equipped) VALUES ($1,$2,now(),false)", [user.id, skinId]);
    const newBalance = await txBalance(client, user.id);
    return { ok: true, response: Response.json({ ok: true, skinId, price, balance: newBalance }) };
  });
  if (txRes) return txRes;
  // fallback — окружение без DATABASE_URL_UNPOOLED
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
// Каталог косметики и типы — единый источник src/lib/cosmetics.ts
import { COSMETICS_CATALOG, RARITY_PRICE } from "./src/lib/cosmetics.ts";
import type { CosmeticSlot, CosmeticItem } from "./src/lib/cosmetics.ts";
import { SKINS } from "./src/lib/shopCatalog.ts";
export { COSMETICS_CATALOG, RARITY_PRICE };
export type { CosmeticSlot, CosmeticItem };
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
  const txRes = await withCoinsLock(user.id, async (client, bal) => {
    // re-check ownership inside tx (TOCTOU guard)
    const ownedRes = await client.query("SELECT id FROM magnum_cosmetics WHERE user_id=$1 AND cosmetic_id=$2 LIMIT 1", [user.id, raw]);
    if (ownedRes.rows.length > 0) {
      return { ok: false, response: Response.json({ error: "already owned", cosmeticId: raw }, { status: 409 }) };
    }
    // verified -42/week discount — внутри транзакции, чтобы окно 7 дней не потратилось дважды
    let finalPrice = price;
    let discountApplied = 0;
    try {
      const vRes = await client.query("SELECT verified FROM magnum_frames WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1", [user.id]);
      const isVerified = vRes.rows.length > 0 && Boolean((vRes.rows[0] as { verified: boolean }).verified);
      if (isVerified) {
        const lastDiscRes = await client.query("SELECT created_at FROM magnum_transactions WHERE user_id=$1 AND reason='cosmetic_discount' ORDER BY created_at DESC LIMIT 1", [user.id]);
        const canDiscount = lastDiscRes.rows.length === 0 || (Date.now() - new Date((lastDiscRes.rows[0] as { created_at: string }).created_at).getTime() > 7 * 24 * 60 * 60 * 1000);
        if (canDiscount && finalPrice >= 42) { finalPrice = price - 42; discountApplied = 42; }
      }
    } catch (e) {
      console.error("[discount]", e);
    }
    if (bal < finalPrice) {
      return { ok: false, response: Response.json({ error: "not enough coins", price: finalPrice, originalPrice: price, discount: discountApplied, balance: bal, required: finalPrice }, { status: 402 }) };
    }
    await client.query("UPDATE magnum_coins SET balance=balance-$1 WHERE user_id=$2", [finalPrice, user.id]);
    await client.query("INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES ($1,$2,$3,false,now())", [user.id, raw, slot]);
    if (discountApplied > 0) {
      await client.query("INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES ($1,$2,'cosmetic_discount',$3::jsonb)", [user.id, -discountApplied, JSON.stringify({ cosmeticId: raw, discount: discountApplied, originalPrice: price })]);
    }
    // косметика, дающая тир (title-vip / title-god / prism), сразу создаёт подписку
    const tier = await grantTierFromCosmeticsTx(client, user.id, [raw]);
    const newBal = await txBalance(client, user.id);
    return { ok: true, response: Response.json({ ok: true, cosmeticId: raw, slot, price: finalPrice, originalPrice: price, discount: discountApplied, balance: newBal, tier }) };
  });
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
    const tier = await grantTierFromCosmetics(user.id, [raw]);
    return Response.json({ok:true,cosmeticId:raw,slot,price:finalPrice,originalPrice:price,discount:discountApplied,balance:newBal,tier});
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
// Индексы под чтение косметики (инвентарь + equipped в лидербордах).
// Дублирует drizzle/migrations/0034_cosmetics_index.sql, чтобы работать без прогона миграций.
async function ensureCosmeticsIndexes(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
  const sql = getSql();
  await sql`CREATE INDEX IF NOT EXISTS magnum_cosmetics_user_equipped_idx ON magnum_cosmetics (user_id, equipped)`;
  await sql`CREATE INDEX IF NOT EXISTS magnum_sessions_user_id_idx ON magnum_sessions (user_id)`;
}
async function ensurePityTable(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_pity (user_id integer NOT NULL REFERENCES magnum_users(id) ON DELETE CASCADE, banner_type text NOT NULL, pity_counter integer DEFAULT 0 NOT NULL, pity_5star integer DEFAULT 0 NOT NULL, lost_50_50 boolean DEFAULT false NOT NULL, pulls integer DEFAULT 0 NOT NULL, updated_at timestamp DEFAULT now() NOT NULL, PRIMARY KEY (user_id, banner_type))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_magnum_pity_user ON magnum_pity (user_id)`;
}
// ---- Tier из косметики — единое правило для backfill, покупки косметики и бандлов ----
// title-god → pro, любой prism → vip+, title-vip → vip. Приоритет сверху вниз.
const TIER_RANK: Record<string, number> = { vip: 1, "vip+": 2, pro: 3 };
export function tierFromCosmeticIds(ids: string[]): string | null {
  if (ids.includes("title-god")) return "pro";
  if (ids.some((id) => isPrismCosmetic(id))) return "vip+";
  if (ids.includes("title-vip")) return "vip";
  return null;
}

// Выдаёт подписку, если куплена косметика, дающая тир, и активной подписки
// такого же или более высокого уровня ещё нет. Возвращает актуальный тир.
async function grantTierFromCosmeticsTx(client: TxClient, userId: number, ids: string[]): Promise<string | null> {
  const derived = tierFromCosmeticIds(ids);
  if (!derived) return null;
  try {
    const active = await client.query(
      "SELECT tier FROM magnum_subscriptions WHERE user_id=$1 AND (ends_at IS NULL OR ends_at > now()) ORDER BY started_at DESC LIMIT 1",
      [userId],
    );
    const cur = active.rows.length ? String((active.rows[0] as { tier: string }).tier) : null;
    if (cur && (TIER_RANK[cur] ?? 0) >= (TIER_RANK[derived] ?? 0)) return cur;
    await client.query("INSERT INTO magnum_subscriptions (user_id, tier, started_at) VALUES ($1,$2,now())", [userId, derived]);
    return derived;
  } catch (e) {
    console.error("[tier grant tx] failed", e);
    return null;
  }
}

async function grantTierFromCosmetics(userId: number, ids: string[]): Promise<string | null> {
  const derived = tierFromCosmeticIds(ids);
  if (!derived) return null;
  try {
    await ensureSubscriptionTable();
    const sql = getSql();
    const active = await sql`SELECT tier FROM magnum_subscriptions WHERE user_id=${userId} AND (ends_at IS NULL OR ends_at > now()) ORDER BY started_at DESC LIMIT 1`;
    const cur = active.length ? String((active[0] as { tier: string }).tier) : null;
    if (cur && (TIER_RANK[cur] ?? 0) >= (TIER_RANK[derived] ?? 0)) return cur;
    await sql`INSERT INTO magnum_subscriptions (user_id, tier, started_at) VALUES (${userId}, ${derived}, now())`;
    return derived;
  } catch (e) {
    console.error("[tier grant] failed", e);
    return null;
  }
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
    const derived = tierFromCosmeticIds(ids);
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
async function ensureLeaderboardAccounts(): Promise<void> {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_leaderboard (id serial PRIMARY KEY, player text NOT NULL, score integer NOT NULL, game text NOT NULL, created_at timestamp DEFAULT now())`;
  await sql`ALTER TABLE magnum_leaderboard ADD COLUMN IF NOT EXISTS user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE`;
  // связываем исторические строки с аккаунтами по имени, остальные остаются без user_id и в топы не попадают
  await sql`UPDATE magnum_leaderboard l SET user_id = u.id FROM magnum_users u WHERE l.user_id IS NULL AND lower(u.username) = lower(l.player)`;
  await sql`CREATE INDEX IF NOT EXISTS magnum_leaderboard_user_game_idx ON magnum_leaderboard (user_id, game, score DESC)`;
}
const HIDDEN_TEST_ACCOUNTS = [
  "shopfix_1788300069","spec42_1788300404816","admin123","uniq_ee94sw",
  "t_s4ac_a","t_s4ac_b","uq_s4ac","t_s4ac_rate","tx_mtj8rw03_913w",
  "race7ojpnc","race2y2mfaa","shop20jst9","shopt9o42w","race2m8am6h",
  "racee77t44","race2ahyg5v","race677q1c","shopkw44je",
  "sess_test_1788303319_66981","t1788303334_5218",
  "t86_test_funnel","t86_test_funnel2","testshop42","123123",
  "system", // служебный аккаунт, не участник
];
// Тестовые аккаунты скрыты флагом, а не удалены: обратимо и не рвёт внешние ключи.
async function ensureHiddenAccounts(): Promise<void> {
  const sql = getSql();
  await sql`ALTER TABLE magnum_users ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`;
  await sql`CREATE INDEX IF NOT EXISTS magnum_users_hidden_idx ON magnum_users (hidden)`;
  await sql`UPDATE magnum_users SET hidden = true WHERE hidden = false AND lower(username) = ANY(${HIDDEN_TEST_ACCOUNTS}::text[])`;
}
void ensureHiddenAccounts().then(()=> console.log("[startup] hidden test accounts ensured")).catch(e=> console.error("[startup] ensureHiddenAccounts failed", e));
void ensureLeaderboardAccounts().then(()=> console.log("[startup] leaderboard accounts ensured")).catch(e=> console.error("[startup] ensureLeaderboardAccounts failed", e));
void ensureCosmeticsIndexes().then(()=> console.log("[startup] cosmetics indexes ensured")).catch(e=> console.error("[startup] ensureCosmeticsIndexes failed", e));
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
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
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
  await ensureGachaHistoryTable();
  const sql = getSql();
  await sql`BEGIN`;
  try {
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    const coinsRows = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} FOR UPDATE`;
    const bal = coinsRows.length ? Number((coinsRows[0] as { balance: number }).balance) : 0;
    if (bal < price) { await sql`ROLLBACK`; return Response.json({ error: "not enough coins", price, balance: bal, required: price }, { status: 402 }); }
    const pityRows = await sql`SELECT pity_counter, pity_5star, lost_50_50, pulls FROM magnum_pity WHERE user_id=${user.id} AND banner_type=${banner} LIMIT 1 FOR UPDATE`;
    let pityCounter = 0, pity5star = 0, lost5050 = false, pulls = 0;
    if (pityRows.length > 0) {
      const r = pityRows[0] as { pity_counter: number; pity_5star: number; lost_50_50: boolean; pulls: number };
      pityCounter = Number(r.pity_counter); pity5star = Number(r.pity_5star); lost5050 = Boolean(r.lost_50_50); pulls = Number(r.pulls);
    }
    await sql`UPDATE magnum_coins SET balance = balance - ${price} WHERE user_id=${user.id}`;
    const results: { id: string; rarity: GachaRarity; isNew: boolean; dust: number; isEvent?: boolean }[] = [];
    let curPityCounter = pityCounter;
    let curPity5 = pity5star;
    let curLost = lost5050;
    let curPulls = pulls;
    for (let i = 0; i < count; i++) {
      const roll = rollWithPity(curPity5, banner, { pity4: curPityCounter, lost5050: curLost });
      const rarity = roll.rarity as GachaRarity;
      const id = roll.id;
      let isNew = true;
      let dust = 0;
      const ownedCos = await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${id} LIMIT 1`;
      const ownedInv = await sql`SELECT id FROM magnum_shop_inventory WHERE user_id=${user.id} AND skin_id=${id} LIMIT 1`;
      if (ownedCos.length > 0 || ownedInv.length > 0) {
        isNew = false;
        dust = DUST_REWARD[rarity] ?? 0;
        if (dust > 0) {
          await sql`INSERT INTO magnum_dust (user_id, balance) VALUES (${user.id}, ${dust}) ON CONFLICT (user_id) DO UPDATE SET balance = magnum_dust.balance + ${dust}, updated_at = now()`;
        }
      } else {
        const cosItem = COSMETICS_CATALOG.find(c=>c.id===id);
        if (cosItem) {
          await sql`INSERT INTO magnum_cosmetics (user_id, cosmetic_id, slot, equipped, purchased_at) VALUES (${user.id}, ${id}, ${cosItem.slot}, false, now())`;
        } else {
          await sql`INSERT INTO magnum_shop_inventory (user_id, skin_id, purchased_at, equipped) VALUES (${user.id}, ${id}, now(), false)`;
        }
      }
      curPulls++;
      if (rarity === "legendary") { curPity5 = 0; curPityCounter = 0; }
      else if (rarity === "epic") { curPityCounter = 0; curPity5++; }
      else { curPityCounter++; curPity5++; }
      if (roll.nextLost5050 !== null) curLost = Boolean(roll.nextLost5050);
      results.push({ id, rarity, isNew, dust, isEvent: roll.isEvent });
    }
    await sql`INSERT INTO magnum_pity (user_id, banner_type, pity_counter, pity_5star, lost_50_50, pulls, updated_at) VALUES (${user.id}, ${banner}, ${curPityCounter}, ${curPity5}, ${curLost}, ${curPulls}, now()) ON CONFLICT (user_id, banner_type) DO UPDATE SET pity_counter=${curPityCounter}, pity_5star=${curPity5}, lost_50_50=${curLost}, pulls=${curPulls}, updated_at=now()`;
    for(const r of results){ await sql`INSERT INTO magnum_gacha_history (user_id,banner_type,rarity,cosmetic_id,is_new) VALUES (${user.id},${banner},${r.rarity},${r.id},${r.isNew})`; }
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${-price}, 'gacha_roll', ${JSON.stringify({ banner, count, price, results: results.map(r=>({id:r.id, rarity:r.rarity})) })}::jsonb)`;
    const balAfter = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const newBal = balAfter.length ? Number((balAfter[0] as { balance: number }).balance) : 0;
    const dustRows = await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
    const dustBal = dustRows.length ? Number((dustRows[0] as { balance: number }).balance) : 0;
    await sql`COMMIT`;
    const guaranteeIn = { epic: Math.max(0, 90 - (curPityCounter + 1)), legendary: Math.max(0, 180 - (curPity5 + 1)) };
    const pity = { counter: curPityCounter, pityCounter: curPityCounter, pity5star: curPity5, pity_5star: curPity5, lost_50_50: curLost, lost5050: curLost, pulls: curPulls, banner };
    return Response.json({ ok: true, results, pity, guaranteeIn, balance: newBal, dust: dustBal, banner, count, price });
  } catch(e){ try{ await sql`ROLLBACK`; }catch{} console.error("[gacha roll] tx failed",e); return Response.json({ error:"db error" },{status:500}); }
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
  return Response.json({ rarities: RARITY_TABLE, dustReward: DUST_REWARD, pools: GACHA_POOL, eventLegendary: EVENT_LEGENDARY_POOL, standardLegendary: STANDARD_LEGENDARY_POOL, price: { single: 42, ten: 420 } });
}
async function ensureGachaHistoryTable(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_gacha_history (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, banner_type text NOT NULL, rarity text NOT NULL, cosmetic_id text NOT NULL, is_new boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gacha_history_user ON magnum_gacha_history(user_id, created_at DESC)`;
}
void ensureGachaHistoryTable().then(()=> console.log("[startup] magnum_gacha_history ensured")).catch(e=> console.error("[startup] gacha_history failed",e));
async function handleGachaBanners(): Promise<Response> {
  const endsAt = new Date(Date.now() + 14*24*3600*1000).toISOString();
  const banners = [
    { id: "standard", name: "СТАНДАРТ 42", type: "standard", endsAt, rateUpId: null },
    { id: "magma-frost", name: "MAGMA FROST", type: "event", endsAt, rateUpId: "banner-magma-frost" },
  ];
  return Response.json({ banners });
}
async function handleGachaHistory(req: Request): Promise<Response> {
  const token=extractToken(req);
  if(!token) return Response.json({ error:"unauthorized", needAuth:true }, { status:401, headers:{ "magnum:need-auth":"1" } });
  const user=await getUserByToken(token); if(!user) return Response.json({ error:"unauthorized", needAuth:true }, { status:401, headers:{ "magnum:need-auth":"1" } });
  await ensureGachaHistoryTable(); const sql=getSql();
  const rows=await sql`SELECT banner_type, rarity, cosmetic_id, is_new, created_at FROM magnum_gacha_history WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 20`;
  const history=rows.map((r:unknown)=>{ const x=r as {banner_type:string; rarity:string; cosmetic_id:string; is_new:boolean; created_at:string}; return { banner_type:String(x.banner_type), rarity:String(x.rarity), cosmetic_id:String(x.cosmetic_id), is_new:Boolean(x.is_new), created_at:x.created_at };});
  return Response.json({ history, count: history.length });
}
async function handleGachaPity(req: Request): Promise<Response> {
  const token=extractToken(req);
  if(!token) return Response.json({ error:"unauthorized" }, { status:401, headers:{ "magnum:need-auth":"1" } });
  const user=await getUserByToken(token); if(!user) return Response.json({ error:"unauthorized" }, { status:401, headers:{ "magnum:need-auth":"1" } });
  await ensurePityTable(); const sql=getSql();
  const rows=await sql`SELECT pity_counter, pity_5star, lost_50_50, pulls FROM magnum_pity WHERE user_id=${user.id} LIMIT 1`;
  if(rows.length===0) return Response.json({ pity: { counter:0, pityCounter:0, pity5star:0, pity_5star:0, lost_50_50:false, pulls:0 }, guaranteeIn:{ epic:89, legendary:179 }, balances: { pity:0 } });
  const r=rows[0] as {pity_counter:number; pity_5star:number; lost_50_50:boolean; pulls:number};
  const c=Number(r.pity_counter); const p5=Number(r.pity_5star);
  return Response.json({ pity:{ counter:c, pityCounter:c, pity5star:p5, pity_5star:p5, lost_50_50:Boolean(r.lost_50_50), pulls:Number(r.pulls) }, guaranteeIn:{ epic: Math.max(0, 90 - c -1), legendary: Math.max(0, 180 - p5 -1) }, balances:{ pity:c } });
}
async function handleGachaFreeRoll(req: Request): Promise<Response> {
  const token=extractToken(req);
  if(!token) return Response.json({ error:"unauthorized", needAuth:true }, { status:401, headers:{ "magnum:need-auth":"1" } });
  const user=await getUserByToken(token); if(!user) return Response.json({ error:"unauthorized", needAuth:true }, { status:401, headers:{ "magnum:need-auth":"1" } });
  const ip=getClientIp(req); if(!checkRateLimit(`gacha:free-roll:${user.id}:${ip}`, 5, 60_000)) return Response.json({ error:"rate limited" }, { status:429 });
  const sql=getSql(); await ensurePityTable(); await ensureGachaHistoryTable(); await ensureDustTable();
  // streak >=3 required via magnum_daily_claims latest streak
  let streak=0;
  try{
    const drows=await sql`SELECT streak FROM magnum_daily_claims WHERE user_id=${user.id} ORDER BY claimed_at DESC LIMIT 1`;
    if(drows.length) streak=Number((drows[0] as {streak:number}).streak);
  }catch{}
  if(streak < 3) return Response.json({ error:"need streak >=3 for free roll" }, { status:429 });
  const today=new Date().toISOString().slice(0,10);
  try{ await sql`CREATE TABLE IF NOT EXISTS magnum_gacha_free_rolls (user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, day_id text, created_at timestamp DEFAULT now(), PRIMARY KEY (user_id, day_id))`; }catch{}
  await sql`BEGIN`;
  try{
    const ins=await sql`INSERT INTO magnum_gacha_free_rolls (user_id,day_id) VALUES (${user.id},${today}) ON CONFLICT (user_id, day_id) DO NOTHING RETURNING user_id`;
    if(ins.length===0){ await sql`ROLLBACK`; return Response.json({ error:"already free-rolled today" }, { status:429 }); }
    const pityRows=await sql`SELECT pity_counter, pity_5star, lost_50_50, pulls FROM magnum_pity WHERE user_id=${user.id} AND banner_type='standard' LIMIT 1 FOR UPDATE`;
    let pc=0,p5=0,lost=false,pulls=0; if(pityRows.length){ const r=pityRows[0] as {pity_counter:number; pity_5star:number; lost_50_50:boolean; pulls:number}; pc=Number(r.pity_counter); p5=Number(r.pity_5star); lost=Boolean(r.lost_50_50); pulls=Number(r.pulls); }
    const roll=rollWithPity(p5, "standard", { pity4: pc, lost5050: lost });
    const rarity=roll.rarity as GachaRarity; const id=roll.id;
    const ownedCos=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${id} LIMIT 1`;
    const ownedInv=await sql`SELECT id FROM magnum_shop_inventory WHERE user_id=${user.id} AND skin_id=${id} LIMIT 1`;
    let isNew=true; let dust=0;
    if(ownedCos.length||ownedInv.length){ isNew=false; dust=DUST_REWARD[rarity]??0; if(dust) await sql`INSERT INTO magnum_dust (user_id,balance) VALUES (${user.id},${dust}) ON CONFLICT (user_id) DO UPDATE SET balance=magnum_dust.balance+${dust}, updated_at=now()`; }
    else { const cos=COSMETICS_CATALOG.find(c=>c.id===id); if(cos) await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${id},${cos.slot},false,now())`; else await sql`INSERT INTO magnum_shop_inventory (user_id,skin_id,purchased_at,equipped) VALUES (${user.id},${id},now(),false)`; }
    let nextPc=pc, nextP5=p5; let nextLost=lost; if(rarity==="legendary"){ nextP5=0; nextPc=0; } else if(rarity==="epic"){ nextPc=0; nextP5++; } else { nextPc++; nextP5++; }
    if(roll.nextLost5050!==null) nextLost=Boolean(roll.nextLost5050);
    await sql`INSERT INTO magnum_pity (user_id,banner_type,pity_counter,pity_5star,lost_50_50,pulls,updated_at) VALUES (${user.id},'standard',${nextPc},${nextP5},${nextLost},${pulls+1},now()) ON CONFLICT (user_id,banner_type) DO UPDATE SET pity_counter=${nextPc}, pity_5star=${nextP5}, lost_50_50=${nextLost}, pulls=${pulls+1}, updated_at=now()`;
    await sql`INSERT INTO magnum_gacha_history (user_id,banner_type,rarity,cosmetic_id,is_new) VALUES (${user.id},'standard',${rarity},${id},${isNew})`;
    const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const bal=balRows.length?Number((balRows[0] as {balance:number}).balance):0;
    await sql`COMMIT`;
    return Response.json({ ok:true, results:[{ id, rarity, isNew, dust }], balance: bal });
  }catch(e){ try{ await sql`ROLLBACK`; }catch{} console.error("[gacha free-roll] tx failed",e); return Response.json({ error:"db error" },{status:500}); }
}

// ---- GACHA QUESTS 42 — daily/weekly + comeback 42 ----
async function ensureGachaQuestsTable(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_gacha_quests (user_id integer NOT NULL REFERENCES magnum_users(id) ON DELETE CASCADE, quest_id text NOT NULL, week_id text NOT NULL, progress integer DEFAULT 0 NOT NULL, target integer NOT NULL, claimed boolean DEFAULT false NOT NULL, completed boolean DEFAULT false NOT NULL, updated_at timestamp DEFAULT now() NOT NULL, PRIMARY KEY (user_id, quest_id, week_id))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gacha_quests_user ON magnum_gacha_quests (user_id, week_id)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_comeback_claims (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, last_claim timestamp DEFAULT now() NOT NULL, claims integer DEFAULT 0 NOT NULL)`;
}
void ensureGachaQuestsTable().then(()=> console.log("[startup] magnum_gacha_quests ensured")).catch(e=> console.error("[startup] gacha_quests failed", e));

function gachaQuestDefById(id: string) {
  if (id === WEEKLY_DEF.id) return WEEKLY_DEF;
  return QUEST_DEFS.find(q=>q.id===id) ?? null;
}

async function bumpQuest(userId: number, questId: string, inc = 1): Promise<void> {
  const def = gachaQuestDefById(questId);
  if (!def) return;
  const target = def.target;
  const weekId = gachaWeekId();
  const safeInc = Math.max(1, Math.min(inc, target));
  try {
    await ensureGachaQuestsTable();
    const sql = getSql();
    await sql`INSERT INTO magnum_gacha_quests (user_id, quest_id, week_id, progress, target, claimed, completed, updated_at) VALUES (${userId}, ${questId}, ${weekId}, ${Math.min(safeInc, target)}, ${target}, false, ${Math.min(safeInc, target) >= target}, now()) ON CONFLICT (user_id, quest_id, week_id) DO UPDATE SET progress = LEAST(magnum_gacha_quests.target, magnum_gacha_quests.progress + ${safeInc}), completed = (LEAST(magnum_gacha_quests.target, magnum_gacha_quests.progress + ${safeInc}) >= magnum_gacha_quests.target), updated_at = now()`;
  } catch (e) { console.error("[bumpQuest] failed", questId, e); }
}

async function handleGachaQuestsStatus(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const ip = getClientIp(req);
  if (!checkRateLimit(`gacha:quests:status:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  await ensureGachaQuestsTable();
  const sql = getSql();
  const weekId = gachaWeekId();
  let rows: unknown[] = [];
  try { rows = await sql`SELECT quest_id, progress, target, claimed, completed, updated_at FROM magnum_gacha_quests WHERE user_id=${user.id} AND week_id=${weekId}`; } catch {}
  const rowMap = new Map<string, { progress:number; target:number; claimed:boolean; completed:boolean }>();
  for (const r of rows as { quest_id:string; progress:number; target:number; claimed:boolean; completed:boolean }[]) rowMap.set(String(r.quest_id), { progress:Number(r.progress), target:Number(r.target), claimed:Boolean(r.claimed), completed:Boolean(r.completed) });
  const quests = QUEST_DEFS.map(def=>{
    const cur = rowMap.get(def.id);
    const progress = cur ? cur.progress : 0;
    const claimed = cur ? cur.claimed : false;
    const completed = cur ? cur.completed : progress >= def.target;
    return { id: def.id, title: def.title, desc: def.desc, target: def.target, progress, completed, claimed, reward: def.reward, banner: def.banner, icon: def.icon };
  });
  const wCur = rowMap.get(WEEKLY_DEF.id);
  const wProgress = wCur ? wCur.progress : 0;
  const wClaimed = wCur ? wCur.claimed : false;
  const wCompleted = wCur ? wCur.completed : wProgress >= WEEKLY_DEF.target;
  const weekly = { id: WEEKLY_DEF.id, title: WEEKLY_DEF.title, desc: WEEKLY_DEF.desc, target: WEEKLY_DEF.target, progress: wProgress, completed: wCompleted, claimed: wClaimed, reward: WEEKLY_DEF.reward, banner: WEEKLY_DEF.banner, icon: WEEKLY_DEF.icon, weekId };
  // comeback eligibility
  let lastActivity: Date|null = null;
  try {
    const la = await sql`SELECT GREATEST( (SELECT MAX(created_at) FROM magnum_transactions WHERE user_id=${user.id}), (SELECT MAX(claimed_at) FROM magnum_daily_claims WHERE user_id=${user.id}) ) as last`;
    const v = (la[0] as { last: string | null })?.last;
    if (v) lastActivity = new Date(v);
  } catch {}
  const { eligible, days } = eligibleComeback(lastActivity);
  let throttleEligible = eligible;
  let throttleDays = days;
  try {
    const cr = await sql`SELECT last_claim FROM magnum_comeback_claims WHERE user_id=${user.id} LIMIT 1`;
    if (cr.length) {
      const lastClaim = new Date((cr[0] as { last_claim:string }).last_claim);
      const diff = (Date.now() - lastClaim.getTime())/86400000;
      if (diff < 7) { throttleEligible = false; throttleDays = Math.floor(diff); }
    }
  } catch {}
  const comeback = { eligible: throttleEligible && eligible, days: throttleEligible ? days : throttleDays, lastActivity: lastActivity ? lastActivity.toISOString() : null, reward: { rolls: COMEBACK_REWARD_ROLLS, coins: COMEBACK_COINS } };
  return Response.json({ quests, weekly, comeback, weekId });
}

async function handleGachaQuestProgress(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const ip = getClientIp(req);
  if (!checkRateLimit(`gacha:quests:progress:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { questId?:string; quest_id?:string; id?:string; inc?:number };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const questId = String(body.questId ?? body.quest_id ?? body.id ?? "").trim();
  if (!questId) return Response.json({ error: "questId required" }, { status: 400 });
  const def = gachaQuestDefById(questId);
  if (!def) return Response.json({ error: "unknown questId", allowed: [...QUEST_DEFS.map(q=>q.id), WEEKLY_DEF.id] }, { status: 400 });
  const incRaw = body.inc != null ? Number(body.inc) : 1;
  const inc = Number.isFinite(incRaw) ? Math.max(1, Math.min(Math.floor(incRaw), def.target)) : 1;
  await ensureGachaQuestsTable();
  const sql = getSql();
  const weekId = gachaWeekId();
  try {
    await sql`INSERT INTO magnum_gacha_quests (user_id, quest_id, week_id, progress, target, claimed, completed, updated_at) VALUES (${user.id}, ${questId}, ${weekId}, ${Math.min(inc, def.target)}, ${def.target}, false, ${Math.min(inc, def.target) >= def.target}, now()) ON CONFLICT (user_id, quest_id, week_id) DO UPDATE SET progress = LEAST(magnum_gacha_quests.target, magnum_gacha_quests.progress + ${inc}), completed = (LEAST(magnum_gacha_quests.target, magnum_gacha_quests.progress + ${inc}) >= magnum_gacha_quests.target), updated_at = now()`;
    const rows = await sql`SELECT progress, target, claimed, completed FROM magnum_gacha_quests WHERE user_id=${user.id} AND quest_id=${questId} AND week_id=${weekId} LIMIT 1`;
    const r = rows[0] as { progress:number; target:number; claimed:boolean; completed:boolean };
    return Response.json({ ok:true, questId, progress:Number(r.progress), target:Number(r.target), completed:Boolean(r.completed), claimed:Boolean(r.claimed), weekId });
  } catch (e) { console.error("[gacha progress] failed", e); return Response.json({ error:"db error" }, { status:500 }); }
}

async function handleGachaQuestClaim(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const ip = getClientIp(req);
  if (!checkRateLimit(`gacha:quests:claim:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { questId?:string; quest_id?:string; id?:string };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const questId = String(body.questId ?? body.quest_id ?? body.id ?? "").trim();
  if (!questId) return Response.json({ error:"questId required" }, { status:400 });
  const def = gachaQuestDefById(questId);
  if (!def) return Response.json({ error:"unknown questId", allowed:[...QUEST_DEFS.map(q=>q.id), WEEKLY_DEF.id] }, { status:400 });
  await ensureGachaQuestsTable(); await ensurePityTable(); await ensureDustTable(); await ensureGachaHistoryTable();
  const sql = getSql();
  const weekId = gachaWeekId();
  await sql`BEGIN`;
  try {
    const qrows = await sql`SELECT progress, target, claimed, completed FROM magnum_gacha_quests WHERE user_id=${user.id} AND quest_id=${questId} AND week_id=${weekId} LIMIT 1 FOR UPDATE`;
    if (qrows.length===0) { await sql`ROLLBACK`; return Response.json({ error:"not found or no progress", questId, weekId }, { status:400 }); }
    const q = qrows[0] as { progress:number; target:number; claimed:boolean; completed:boolean };
    const progress = Number(q.progress); const target = Number(q.target);
    if (progress < target || !q.completed) { await sql`ROLLBACK`; return Response.json({ error:"not completed", questId, progress, target, completed:Boolean(q.completed) }, { status:400 }); }
    if (q.claimed) { await sql`ROLLBACK`; return Response.json({ error:"already claimed", questId }, { status:409 }); }
    const isWeekly = questId === WEEKLY_DEF.id;
    const rolls = isWeekly ? WEEKLY_DEF.reward : def.reward;
    const banner: BannerType = isWeekly ? "event" : (def.banner as BannerType);
    // pity FOR UPDATE
    const pityRows = await sql`SELECT pity_counter, pity_5star, lost_50_50, pulls FROM magnum_pity WHERE user_id=${user.id} AND banner_type=${banner} LIMIT 1 FOR UPDATE`;
    let pc=0,p5=0,lost=false,pulls=0;
    if (pityRows.length){ const r=pityRows[0] as {pity_counter:number; pity_5star:number; lost_50_50:boolean; pulls:number}; pc=Number(r.pity_counter); p5=Number(r.pity_5star); lost=Boolean(r.lost_50_50); pulls=Number(r.pulls); }
    let curPc=pc, curP5=p5, curLost=lost, curPulls=pulls;
    const results: { id:string; rarity:GachaRarity; isNew:boolean; dust:number; isEvent?:boolean }[] = [];
    for(let i=0;i<rolls;i++){
      const roll = rollWithPity(curP5, banner, { pity4: curPc, lost5050: curLost });
      const rarity = roll.rarity as GachaRarity;
      const id = roll.id;
      let isNew=true; let dust=0;
      const ownedCos=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${id} LIMIT 1`;
      const ownedInv=await sql`SELECT id FROM magnum_shop_inventory WHERE user_id=${user.id} AND skin_id=${id} LIMIT 1`;
      if(ownedCos.length>0 || ownedInv.length>0){ isNew=false; dust=DUST_REWARD[rarity]??0; if(dust>0) await sql`INSERT INTO magnum_dust (user_id,balance) VALUES (${user.id},${dust}) ON CONFLICT (user_id) DO UPDATE SET balance=magnum_dust.balance+${dust}, updated_at=now()`; }
      else { const cos=COSMETICS_CATALOG.find(c=>c.id===id); if(cos) await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${id},${cos.slot},false,now())`; else await sql`INSERT INTO magnum_shop_inventory (user_id,skin_id,purchased_at,equipped) VALUES (${user.id},${id},now(),false)`; }
      if(rarity==="legendary"){ curP5=0; curPc=0; } else if(rarity==="epic"){ curPc=0; curP5++; } else { curPc++; curP5++; }
      if(roll.nextLost5050!==null) curLost=Boolean(roll.nextLost5050);
      curPulls++;
      await sql`INSERT INTO magnum_gacha_history (user_id,banner_type,rarity,cosmetic_id,is_new) VALUES (${user.id},${banner},${rarity},${id},${isNew})`;
      results.push({ id, rarity, isNew, dust, isEvent: roll.isEvent });
    }
    await sql`INSERT INTO magnum_pity (user_id,banner_type,pity_counter,pity_5star,lost_50_50,pulls,updated_at) VALUES (${user.id},${banner},${curPc},${curP5},${curLost},${curPulls},now()) ON CONFLICT (user_id,banner_type) DO UPDATE SET pity_counter=${curPc}, pity_5star=${curP5}, lost_50_50=${curLost}, pulls=${curPulls}, updated_at=now()`;
    await sql`UPDATE magnum_gacha_quests SET claimed=true, completed=true, updated_at=now() WHERE user_id=${user.id} AND quest_id=${questId} AND week_id=${weekId}`;
    // auto bump weekly when daily claimed (once per day guard via daily claim dedup — allow multiple weekly bumps per week but tester expects 7 dailies -> weekly)
    // if daily claimed and not weekly, bump weekly by 1 (no per-day throttle for now — simple)
    if(!isWeekly){
      try{
        const wDef = WEEKLY_DEF;
        await sql`INSERT INTO magnum_gacha_quests (user_id, quest_id, week_id, progress, target, claimed, completed, updated_at) VALUES (${user.id}, ${wDef.id}, ${weekId}, 1, ${wDef.target}, false, ${1>=wDef.target}, now()) ON CONFLICT (user_id, quest_id, week_id) DO UPDATE SET progress = LEAST(magnum_gacha_quests.target, magnum_gacha_quests.progress + 1), completed = (LEAST(magnum_gacha_quests.target, magnum_gacha_quests.progress + 1) >= magnum_gacha_quests.target), updated_at = now()`;
      }catch{}
    }
    const dustRows = await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
    const dustBal = dustRows.length ? Number((dustRows[0] as {balance:number}).balance) : 0;
    const pity = { counter:curPc, pityCounter:curPc, pity5star:curP5, pity_5star:curP5, lost_50_50:curLost, lost5050:curLost, pulls:curPulls, banner };
    const guaranteeIn = { epic: Math.max(0, 90 - (curPc+1)), legendary: Math.max(0, 180 - (curP5+1)) };
    await sql`COMMIT`;
    return Response.json({ ok:true, questId, results, pity, guaranteeIn, dustBalance: dustBal, dust: dustBal, banner, rolls, claimed:true });
  } catch(e){ try{ await sql`ROLLBACK`; }catch{} console.error("[gacha quest claim] tx failed",e); return Response.json({ error:"db error" },{status:500}); }
}

async function handleGachaComebackClaim(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error:"unauthorized" }, { status:401, headers:{ "magnum:need-auth":"1" } });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error:"unauthorized" }, { status:401, headers:{ "magnum:need-auth":"1" } });
  const ip=getClientIp(req);
  if(!checkRateLimit(`gacha:comeback:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error:"rate limited" },{status:429});
  await ensureGachaQuestsTable(); await ensurePityTable(); await ensureDustTable(); await ensureGachaHistoryTable();
  const sql=getSql();
  let lastActivity: Date|null=null;
  try{
    const la=await sql`SELECT GREATEST( (SELECT MAX(created_at) FROM magnum_transactions WHERE user_id=${user.id}), (SELECT MAX(claimed_at) FROM magnum_daily_claims WHERE user_id=${user.id}) ) as last`;
    const v=(la[0] as {last:string|null})?.last;
    if(v) lastActivity=new Date(v);
  }catch{}
  const ch=eligibleComeback(lastActivity);
  if(!ch.eligible) return Response.json({ error:"not eligible yet", eligible:false, days: ch.days, required:7 }, { status:429 });
  try{
    const cr=await sql`SELECT last_claim FROM magnum_comeback_claims WHERE user_id=${user.id} LIMIT 1`;
    if(cr.length){
      const lastClaim=new Date((cr[0] as {last_claim:string}).last_claim);
      const diff=(Date.now()-lastClaim.getTime())/86400000;
      if(diff < 7) return Response.json({ error:"comeback throttle 7d", eligible:false, days: Math.floor(diff), required:7 }, { status:429 });
    }
  }catch{}
  const banner:BannerType = "standard";
  const rolls=COMEBACK_REWARD_ROLLS;
  await sql`BEGIN`;
  try{
    // re-check throttle FOR UPDATE
    const cr2=await sql`SELECT last_claim FROM magnum_comeback_claims WHERE user_id=${user.id} LIMIT 1 FOR UPDATE`;
    if(cr2.length){
      const lc=new Date((cr2[0] as {last_claim:string}).last_claim);
      const diff=(Date.now()-lc.getTime())/86400000;
      if(diff < 7){ await sql`ROLLBACK`; return Response.json({ error:"comeback throttle 7d", eligible:false, days:Math.floor(diff) },{status:429}); }
    }
    // re-check activity (if someone transacted in between)
    const la2=await sql`SELECT GREATEST( (SELECT MAX(created_at) FROM magnum_transactions WHERE user_id=${user.id}), (SELECT MAX(claimed_at) FROM magnum_daily_claims WHERE user_id=${user.id}) ) as last`;
    const v2=(la2[0] as {last:string|null})?.last;
    const last2=v2? new Date(v2):null;
    const ch2=eligibleComeback(last2);
    if(!ch2.eligible){ await sql`ROLLBACK`; return Response.json({ error:"not eligible yet", eligible:false, days:ch2.days },{status:429}); }
    const pityRows=await sql`SELECT pity_counter, pity_5star, lost_50_50, pulls FROM magnum_pity WHERE user_id=${user.id} AND banner_type=${banner} LIMIT 1 FOR UPDATE`;
    let pc=0,p5=0,lost=false,pulls=0;
    if(pityRows.length){ const r=pityRows[0] as {pity_counter:number; pity_5star:number; lost_50_50:boolean; pulls:number}; pc=Number(r.pity_counter); p5=Number(r.pity_5star); lost=Boolean(r.lost_50_50); pulls=Number(r.pulls); }
    let curPc=pc, curP5=p5, curLost=lost, curPulls=pulls;
    const results:{id:string; rarity:GachaRarity; isNew:boolean; dust:number; isEvent?:boolean}[]=[];
    for(let i=0;i<rolls;i++){
      const roll=rollWithPity(curP5, banner, { pity4: curPc, lost5050: curLost });
      const rarity=roll.rarity as GachaRarity; const id=roll.id;
      let isNew=true; let dust=0;
      const ownedCos=await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${id} LIMIT 1`;
      const ownedInv=await sql`SELECT id FROM magnum_shop_inventory WHERE user_id=${user.id} AND skin_id=${id} LIMIT 1`;
      if(ownedCos.length||ownedInv.length){ isNew=false; dust=DUST_REWARD[rarity]??0; if(dust) await sql`INSERT INTO magnum_dust (user_id,balance) VALUES (${user.id},${dust}) ON CONFLICT (user_id) DO UPDATE SET balance=magnum_dust.balance+${dust}, updated_at=now()`; }
      else { const cos=COSMETICS_CATALOG.find(c=>c.id===id); if(cos) await sql`INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES (${user.id},${id},${cos.slot},false,now())`; else await sql`INSERT INTO magnum_shop_inventory (user_id,skin_id,purchased_at,equipped) VALUES (${user.id},${id},now(),false)`; }
      if(rarity==="legendary"){ curP5=0; curPc=0; } else if(rarity==="epic"){ curPc=0; curP5++; } else { curPc++; curP5++; }
      if(roll.nextLost5050!==null) curLost=Boolean(roll.nextLost5050);
      curPulls++;
      await sql`INSERT INTO magnum_gacha_history (user_id,banner_type,rarity,cosmetic_id,is_new) VALUES (${user.id},${banner},${rarity},${id},${isNew})`;
      results.push({ id, rarity, isNew, dust, isEvent: roll.isEvent });
    }
    await sql`INSERT INTO magnum_pity (user_id,banner_type,pity_counter,pity_5star,lost_50_50,pulls,updated_at) VALUES (${user.id},${banner},${curPc},${curP5},${curLost},${curPulls},now()) ON CONFLICT (user_id,banner_type) DO UPDATE SET pity_counter=${curPc}, pity_5star=${curP5}, lost_50_50=${curLost}, pulls=${curPulls}, updated_at=now()`;
    // coins +42
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`UPDATE magnum_coins SET balance = balance + ${COMEBACK_COINS} WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${COMEBACK_COINS},'gacha_comeback',${JSON.stringify({ rolls, coins:COMEBACK_COINS })}::jsonb)`;
    await sql`INSERT INTO magnum_comeback_claims (user_id,last_claim,claims) VALUES (${user.id}, now(), 1) ON CONFLICT (user_id) DO UPDATE SET last_claim=now(), claims=magnum_comeback_claims.claims+1`;
    const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const balance=balRows.length? Number((balRows[0] as {balance:number}).balance):0;
    const dustRows=await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
    const dustBal=dustRows.length? Number((dustRows[0] as {balance:number}).balance):0;
    const pity={ counter:curPc, pityCounter:curPc, pity5star:curP5, pity_5star:curP5, lost_50_50:curLost, lost5050:curLost, pulls:curPulls, banner };
    const guaranteeIn={ epic: Math.max(0,90-(curPc+1)), legendary: Math.max(0,180-(curP5+1)) };
    await sql`COMMIT`;
    return Response.json({ ok:true, results, pity, guaranteeIn, balance, coins:COMEBACK_COINS, dust: dustBal, dustBalance: dustBal, rolls, banner });
  }catch(e){ try{ await sql`ROLLBACK`; }catch{} console.error("[gacha comeback] tx failed",e); return Response.json({ error:"db error" },{status:500}); }
}

// ---- Daily Spin Wheel 42 — 8 секторов, стрик ×2/×3, QR +1 спин обоих ----
async function ensureSpinTable(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_daily_spin (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, last_spin timestamptz, streak integer NOT NULL DEFAULT 0, free_spins integer NOT NULL DEFAULT 0, total_spins integer NOT NULL DEFAULT 0, updated_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_spin_referrals (id serial PRIMARY KEY, inviter_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, invited_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, code text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, UNIQUE(inviter_id, invited_id))`;
}
void ensureSpinTable().then(()=> console.log("[startup] magnum_daily_spin ensured")).catch(e=> console.error("[startup] spin failed", e));

function spinDayKey(d=new Date()): string { return d.toISOString().slice(0,10); }

async function handleSpinStatus(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  await ensureSpinTable();
  const sql = getSql();
  const rows = await sql`SELECT last_spin, streak, free_spins, total_spins FROM magnum_daily_spin WHERE user_id=${user.id} LIMIT 1`;
  let streak = 0, freeSpins = 0, totalSpins = 0;
  let lastSpin: string | null = null;
  if (rows.length) {
    const r = rows[0] as { last_spin: string | null; streak: number; free_spins: number; total_spins: number };
    lastSpin = r.last_spin ? String(r.last_spin) : null;
    streak = Number(r.streak || 0);
    freeSpins = Number(r.free_spins || 0);
    totalSpins = Number(r.total_spins || 0);
    // break streak if >44h gap
    if (lastSpin) {
      const diffH = (Date.now() - new Date(lastSpin).getTime())/3600000;
      if (diffH > 44) streak = 0;
    }
  }
  const now = Date.now();
  let canSpin = true;
  let waitMs = 0;
  if (lastSpin) {
    const diffMs = now - new Date(lastSpin).getTime();
    if (diffMs < 20*3600000 && freeSpins <= 0) { canSpin = false; waitMs = Math.ceil(20*3600000 - diffMs); }
    else if (diffMs < 20*3600000 && freeSpins > 0) { canSpin = true; waitMs = 0; }
  }
  // still require freeSpins check: if freeSpins>0 always can spin even if wait not done
  if (freeSpins > 0) canSpin = true;
  const mult = getStreakMultiplier(streak);
  const code = referralCodeFor(user);
  return Response.json({ canSpin, canSpinFree: freeSpins>0, streak, nextRewardMult: mult, lastSpin, waitMs, freeSpins, totalSpins, code, sectors: SPIN_SECTORS.length });
}

async function handleSpin(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "magnum:need-auth": "1" } });
  const ip = getClientIp(req);
  if (!checkRateLimit(`spin:${user.id}:${ip}`, 6, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  await ensureSpinTable();
  await ensureDustTable();
  const sql = getSql();
  // fetch or init spin row
  const rows = await sql`SELECT last_spin, streak, free_spins, total_spins FROM magnum_daily_spin WHERE user_id=${user.id} LIMIT 1`;
  let streak = 0, freeSpins = 0, lastSpin: string | null = null, totalSpins = 0;
  if (rows.length) {
    const r = rows[0] as { last_spin: string | null; streak: number; free_spins: number; total_spins: number };
    lastSpin = r.last_spin ? String(r.last_spin) : null;
    streak = Number(r.streak || 0);
    freeSpins = Number(r.free_spins || 0);
    totalSpins = Number(r.total_spins || 0);
    if (lastSpin) {
      const diffH = (Date.now() - new Date(lastSpin).getTime())/3600000;
      if (diffH > 44) streak = 0;
    }
  } else {
    await sql`INSERT INTO magnum_daily_spin (user_id, last_spin, streak, free_spins, total_spins) VALUES (${user.id}, null, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING`;
  }
  // check 20h cooldown unless freeSpins>0
  const nowMs = Date.now();
  let canSpin = true;
  let waitMs = 0;
  if (lastSpin) {
    const diffMs = nowMs - new Date(lastSpin).getTime();
    if (diffMs < 20*3600000 && freeSpins <= 0) { canSpin = false; waitMs = Math.ceil(20*3600000 - diffMs); }
  }
  if (freeSpins > 0) canSpin = true;
  if (!canSpin) return Response.json({ error: "already spun — wait 24h", waitMs, waitH: (waitMs/3600000).toFixed(1) }, { status: 429 });

  // pick sector
  const idx = Math.floor(Math.random()*SPIN_SECTORS.length);
  const sector = SPIN_SECTORS[idx]!;
  let dust = 0, epicRolled = false, skinId: string | null = null, isEmpty = false, extraSpin = false;
  if (sector.kind === "dust") {
    const base = sector.dust ?? 42;
    if (sector.epicChance != null) {
      const hit = Math.random() < sector.epicChance;
      epicRolled = hit;
      dust = hit ? base : 42;
    } else dust = base;
  } else if (sector.kind === "skin") skinId = sector.skinId ?? null;
  else if (sector.kind === "empty") isEmpty = true;
  else if (sector.kind === "spin") extraSpin = true;

  // streak calc: if lastSpin was yesterday (20-44h) then +1, if >44h reset to 1, else if first ever 1
  let nextStreak = 1;
  if (lastSpin) {
    const diffH = (Date.now() - new Date(lastSpin).getTime())/3600000;
    if (diffH >= 20 && diffH <= 44) nextStreak = Math.min(7+5, streak + 1);
    else if (diffH > 44) nextStreak = 1;
    else if (freeSpins > 0) { // free spin does not advance streak? keep same? spec says free +1 spin via QR — not daily streak? we keep same streak
      nextStreak = streak;
    }
    else nextStreak = streak; // should not happen due to cooldown
  } else nextStreak = 1;
  // cap display 7 but store actual? spec 7 = x3, so cap at 7 for multiplier
  const storedStreak = Math.min(nextStreak, 20);
  const multiplier = getStreakMultiplier(nextStreak);
  const appliedDust = dust * multiplier;

  // apply rewards
  if (appliedDust > 0) {
    await sql`INSERT INTO magnum_dust (user_id, balance) VALUES (${user.id}, ${appliedDust}) ON CONFLICT (user_id) DO UPDATE SET balance = magnum_dust.balance + ${appliedDust}, updated_at = now()`;
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`UPDATE magnum_coins SET balance = balance + ${Math.floor(appliedDust/3)} WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${appliedDust}, 'spin_dust', ${JSON.stringify({ sector: sector.id, dust, appliedDust, multiplier, streak: nextStreak, epicRolled })}::jsonb)`;
  }
  if (skinId) {
    const ex = await sql`SELECT id FROM magnum_cosmetics WHERE user_id=${user.id} AND cosmetic_id=${skinId} LIMIT 1`;
    if (ex.length === 0) {
      const cat = COSMETICS_CATALOG.find(c=>c.id===skinId);
      const slot = cat ? cat.slot : "frame";
      await sql`INSERT INTO magnum_cosmetics (user_id, cosmetic_id, slot, equipped, purchased_at) VALUES (${user.id}, ${skinId}, ${slot}, false, now())`;
      await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, 0, 'spin_skin', ${JSON.stringify({ sector: sector.id, skinId })}::jsonb)`;
    } else {
      // duplicate -> convert to dust 42
      const dupDust = 42 * multiplier;
      await sql`INSERT INTO magnum_dust (user_id, balance) VALUES (${user.id}, ${dupDust}) ON CONFLICT (user_id) DO UPDATE SET balance = magnum_dust.balance + ${dupDust}, updated_at = now()`;
      await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${dupDust}, 'spin_skin_dup_dust', ${JSON.stringify({ sector: sector.id, skinId, dupDust })}::jsonb)`;
    }
  }
  if (extraSpin) {
    // give +1 free spin for next
    await sql`UPDATE magnum_daily_spin SET free_spins = free_spins + 1 WHERE user_id=${user.id}`;
    freeSpins += 1;
  }

  // consume freeSpins if used instead of cooldown
  const usedFree = lastSpin && (Date.now() - new Date(lastSpin).getTime() < 20*3600000) && freeSpins > 0;
  let newFree = freeSpins;
  if (usedFree) newFree = Math.max(0, freeSpins - 1);
  // update row with new lastSpin only if this was a daily spin (not free extra? but spec says daily free 1/day, extra from sector is +1 spin — we already gave. For this spin, we always update last_spin to now unless it was freeSpins consumption? Requirement: 1/24h for daily, free spins bypass. So if usedFree, don't move last_spin? Keep original last_spin cooldown. Let's keep last_spin update only when not usedFree.
  if (!usedFree) {
    await sql`UPDATE magnum_daily_spin SET last_spin = now(), streak=${storedStreak}, free_spins=${newFree}, total_spins = total_spins + 1, updated_at = now() WHERE user_id=${user.id}`;
  } else {
    await sql`UPDATE magnum_daily_spin SET free_spins=${newFree}, total_spins = total_spins + 1, updated_at = now() WHERE user_id=${user.id}`;
  }

  const balRows = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const balance = balRows.length ? Number((balRows[0] as { balance: number }).balance) : 0;
  const dustRows = await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
  const dustBal = dustRows.length ? Number((dustRows[0] as { balance: number }).balance) : 0;

  return Response.json({ ok: true, sector: sector.id, reward: { sectorIndex: idx, sectorId: sector.id, label: sector.label, dust, appliedDust, skinId, isEmpty, extraSpin, epicRolled, multiplier }, streak: nextStreak, multiplier, balance, dust: dustBal, freeSpins: newFree, totalSpins: totalSpins+1 });
}

async function handleSpinReferral(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`spin:referral:${user.id}:${ip}`, 10, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { code?: unknown; spinCode?: unknown; ref?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const raw = String(body.code ?? body.spinCode ?? body.ref ?? "").trim().toUpperCase().slice(0,32);
  if (!/^42-[A-Z0-9]{4}$/.test(raw)) return Response.json({ error: "invalid brat code 42-XXXX" }, { status: 400 });
  const inviterId = bratCodeToUserId(raw);
  if (inviterId === null) return Response.json({ error: "code not found" }, { status: 404 });
  if (inviterId === user.id) return Response.json({ error: "own code" }, { status: 400 });
  await ensureSpinTable();
  const sql = getSql();
  const invExists = await sql`SELECT id FROM magnum_users WHERE id=${inviterId} LIMIT 1`;
  if (invExists.length === 0) return Response.json({ error: "inviter not found" }, { status: 404 });
  // prevent duplicate pair
  const dup = await sql`SELECT id FROM magnum_spin_referrals WHERE inviter_id=${inviterId} AND invited_id=${user.id} LIMIT 1`;
  if (dup.length) return Response.json({ ok: true, already: true, freeSpins: 0 });
  await sql`INSERT INTO magnum_spin_referrals (inviter_id, invited_id, code) VALUES (${inviterId}, ${user.id}, ${raw})`;
  // give +1 free spin to both via magnum_daily_spin
  await sql`INSERT INTO magnum_daily_spin (user_id, last_spin, streak, free_spins, total_spins) VALUES (${inviterId}, null, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING`;
  await sql`INSERT INTO magnum_daily_spin (user_id, last_spin, streak, free_spins, total_spins) VALUES (${user.id}, null, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_daily_spin SET free_spins = free_spins + 1, updated_at = now() WHERE user_id=${inviterId}`;
  await sql`UPDATE magnum_daily_spin SET free_spins = free_spins + 1, updated_at = now() WHERE user_id=${user.id}`;
  // also classic referral reward for economy closed loop
  try {
    await sql`INSERT INTO magnum_referrals (inviter_id, invited_id, code) VALUES (${inviterId}, ${user.id}, ${raw}) ON CONFLICT DO NOTHING`;
    // small dust bonus via referrals already handled in classic flow, skip double
  } catch {}
  const myRow = await sql`SELECT free_spins FROM magnum_daily_spin WHERE user_id=${user.id} LIMIT 1`;
  const freeSpins = myRow.length ? Number((myRow[0] as { free_spins: number }).free_spins) : 1;
  try { await ensureNotification(inviterId, "Колесо 42 — QR!", "Братуха "+user.username+" сканировал твой спин-QR +1 спин обоим", "referral"); } catch {}
  return Response.json({ ok: true, rewardSpins: 1, freeSpins, inviterId, code: raw });
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
  // основной путь — транзакция с FOR UPDATE: двойной клик не спишет цену набора дважды
  const txRes = await withCoinsLock(user.id, async (client, bal) => {
    if(bal<bundle.price) return { ok:false, response: Response.json({error:"not enough coins",price:bundle.price,balance:bal,required:bundle.price},{status:402}) };
    await client.query("UPDATE magnum_coins SET balance=balance-$1 WHERE user_id=$2", [bundle.price, user.id]);
    const granted: string[]=[]; const skipped: string[]=[];
    for(let i=0;i<bundle.items.length;i++){
      const itemId=bundle.items[i]!; const slot=bundle.slots[i]!;
      if(slot==="skin"){
        const ex=await client.query("SELECT id FROM magnum_shop_inventory WHERE user_id=$1 AND skin_id=$2 LIMIT 1", [user.id, itemId]);
        if(ex.rows.length>0){ skipped.push(itemId); continue; }
        await client.query("INSERT INTO magnum_shop_inventory (user_id,skin_id,purchased_at,equipped) VALUES ($1,$2,now(),false)", [user.id, itemId]);
        granted.push(itemId);
      } else {
        const ex=await client.query("SELECT id FROM magnum_cosmetics WHERE user_id=$1 AND cosmetic_id=$2 LIMIT 1", [user.id, itemId]);
        if(ex.rows.length>0){ skipped.push(itemId); continue; }
        await client.query("INSERT INTO magnum_cosmetics (user_id,cosmetic_id,slot,equipped,purchased_at) VALUES ($1,$2,$3,false,now())", [user.id, itemId, slot]);
        granted.push(itemId);
      }
    }
    await client.query("INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES ($1,$2,'shop_bundle',$3::jsonb)", [user.id, -bundle.price, JSON.stringify({bundleId:bundle.id,price:bundle.price,granted,skipped})]);
    const tier = await grantTierFromCosmeticsTx(client, user.id, granted);
    const newBal = await txBalance(client, user.id);
    return { ok:true, response: Response.json({ok:true,bundleId:bundle.id,price:bundle.price,balance:newBal,granted,skipped,alreadyOwned:skipped,tier}) };
  });
  if (txRes) return txRes;
  // fallback — окружение без DATABASE_URL_UNPOOLED
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
    const tier = await grantTierFromCosmetics(user.id, granted);
    return Response.json({ok:true,bundleId:bundle.id,price:bundle.price,balance:newBal,granted,skipped,alreadyOwned:skipped,tier});
  }catch(e){ console.error("[bundle buy] failed",e); return Response.json({error:"db error"},{status:500}); }
}

// ---- Frame handlers (magnum_frames) ---- FRAME MAGMA GOLD: mimo-v2.5 + conic-magma #ff4500 + cross -42 glacier/duel
async function ensureFrameTable(): Promise<void> {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_frames (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, verified boolean NOT NULL DEFAULT false, frame_date timestamp, created_at timestamp DEFAULT now() NOT NULL)`;
  try { await sql`ALTER TABLE magnum_frames ADD COLUMN IF NOT EXISTS frame_date timestamp`; } catch {}
}
async function handleFrameVerify(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`frame:verify:${user.id}:${ip}`, 8, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  let body: { verified?: boolean; frame_date?: string; frameDate?: string; frame_date_iso?: string };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  // FRAME MAGMA GOLD — бесплатно verified cross -42 glacier/duel — любой authed может verified=true (mimo-v2.5 heuristic на клиенте)
  const verified = Boolean(body.verified);
  let frameDateIso: string | null = (body.frame_date as string) ?? (body.frameDate as string) ?? (body.frame_date_iso as string) ?? null;
  if (frameDateIso) { const d = new Date(frameDateIso); frameDateIso = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); } else frameDateIso = new Date().toISOString();
  try {
    await ensureFrameTable();
    const sql = getSql();
    let rows: unknown[];
    try { rows = await sql`INSERT INTO magnum_frames (user_id, verified, frame_date, created_at) VALUES (${user.id}, ${verified}, ${frameDateIso}::timestamp, now()) RETURNING *`; } catch { rows = await sql`INSERT INTO magnum_frames (user_id, verified, created_at) VALUES (${user.id}, ${verified}, now()) RETURNING *`; }
    return Response.json({ ok: true, frame: rows[0], verified, frame_date: frameDateIso, frameDate: frameDateIso });
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
    let rows: unknown[];
    try { rows = await sql`SELECT f.id, u.username, f.verified, f.frame_date, f.created_at, s.skin_id as avatar FROM magnum_frames f LEFT JOIN magnum_users u ON u.hidden=false AND u.id = f.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id = f.user_id AND s.equipped = true WHERE f.user_id = ${user.id} ORDER BY f.created_at DESC LIMIT 50`; } catch { rows = await sql`SELECT f.id, u.username, f.verified, f.created_at, s.skin_id as avatar FROM magnum_frames f LEFT JOIN magnum_users u ON u.hidden=false AND u.id = f.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id = f.user_id AND s.equipped = true WHERE f.user_id = ${user.id} ORDER BY f.created_at DESC LIMIT 50`; }
    const frames = rows.map((r: unknown) => {
      const x = r as { id: number; username: string; verified: boolean | null; frame_date?: string; created_at: string; avatar: string | null };
      return { id: Number(x.id), username: String(x.username || user!.username), verified: Boolean(x.verified), status: x.verified ? "verified" : "pending", created_at: x.created_at, frame_date: (x as unknown as {frame_date:string}).frame_date ?? x.created_at, frameDate: (x as unknown as {frame_date:string}).frame_date ?? x.created_at, avatar: x.avatar || null };
    });
    const verified = frames.filter(f => f.verified).length;
    // tier for FRAME MAGMA GOLD — magma-gold when verified, else none — conic-magma #ff4500 spin 3s + shadow 0 0 16 magma
    const tier = verified > 0 ? "magma-gold" : "none";
    const tierLabel = verified > 0 ? "MAGMA GOLD" : "NONE";
    const magmaStyle = "conic-gradient(from 0deg,#ff4500,#ff8c00,#ffd700,#ff4500)";
    const magmaShadow = "0 0 16px #ff4500";
    const magmaSpin = "magmaSpin 3s linear infinite";
    return Response.json({ frames, total: frames.length, verified, pending: frames.length - verified, user: user.username, tier, tierLabel, style: magmaStyle, shadow: magmaShadow, spin: magmaSpin });
  } catch (e) {
    console.error("[frame status] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Eco handlers (magnum_eco_results) ----
async function handleEcoLeaderboard(): Promise<Response> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT COALESCE(u.username, r.player, 'Братуха') as player, r.score, r.rank, r.created_at, s.skin_id as avatar, COALESCE(f.verified,false) as verified FROM magnum_eco_results r LEFT JOIN magnum_users u ON u.hidden=false AND u.id = r.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id = r.user_id AND s.equipped = true LEFT JOIN magnum_frames f ON f.user_id = r.user_id ORDER BY r.score DESC, r.created_at ASC LIMIT 50`;
    const mapped = rows.map((r: unknown) => {
      const x = r as { player: string; score: number; rank: string; created_at: string; avatar: string | null; verified: boolean | null };
      return { player: String(x.player), username: String(x.player), score: Number(x.score), rank: String(x.rank), status: String(x.rank || "pending"), created_at: x.created_at, avatar: x.avatar || null, verified: Boolean(x.verified) };
    });
    const leaderboard = await decorateWithCosmetics(mapped);
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
    try { await addPassXp(authedUser.id, 20, 'eco'); } catch {}
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
  // Публичный рейтинг = рейтинг аккаунтов. Аноним не пишет в общий топ: иначе имя
  // ничем не подтверждено и рейтинг смешивает аккаунты с кем угодно.
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized — войди, братуха"},{status:401});
  let user:{id:number;username:string}|null=null; try{user=await getUserByToken(token);}catch(e){ console.warn("[eco rating] getUserByToken failed", e instanceof Error ? e.message : String(e)); }
  if(!user) return Response.json({error:"unauthorized — войди, братуха"},{status:401});
  let body:{score?:unknown;answers?:unknown;player?:unknown}; try{body=(await req.json()) as typeof body;}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const score=validateEcoScore(body.score); if(score===null) return Response.json({error:"score -1000..1000"},{status:400});
  const answers=body.answers!==undefined?validateEcoAnswers(body.answers):[]; if(body.answers!==undefined&&answers===null) return Response.json({error:"answers 0..10 max20"},{status:400});
  const tier=calcEcoRating(score); const player=user.username;
  if(!checkRateLimit(`eco:rating:${user.id}`,10,60_000)) return Response.json({error:"rate limited"},{status:429});
  try{ const sql=getSql();
    await sql`CREATE TABLE IF NOT EXISTS magnum_eco_ratings (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE SET NULL, player text, score integer NOT NULL, rating integer NOT NULL, tier text NOT NULL, answers jsonb DEFAULT '[]'::jsonb NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
    const rows=await sql`INSERT INTO magnum_eco_ratings (user_id,player,score,rating,tier,answers) VALUES (${user.id},${player},${score},${tier.rating},${tier.tier},${JSON.stringify(answers??[])}::jsonb) RETURNING id,score,rating,tier,created_at`;
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
    // только аккаунты: старые анонимные записи (user_id IS NULL) в публичный топ не попадают
    const rows=await sql`SELECT u.username as player,r.score,r.rating,r.tier,r.created_at,s.skin_id as avatar FROM magnum_eco_ratings r JOIN magnum_users u ON u.hidden=false AND u.id=r.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=r.user_id AND s.equipped=true ORDER BY r.rating DESC,r.score DESC,r.created_at ASC LIMIT 30`;
    const mapped=rows.map((x:unknown)=>{const r=x as {player:string;score:number;rating:number;tier:string;created_at:string;avatar:string|null}; return {player:String(r.player),username:String(r.player),score:Number(r.score),rating:Number(r.rating),tier:String(r.tier),created_at:r.created_at,avatar:r.avatar};});
    const top=await decorateWithCosmetics(mapped);
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

// ---- TOUR 42 — 12 городов 2024-2026 (xp + map share) ----
const TOUR_XP_COST_CANON = 42;
const TOUR_SHARE_REWARD_CANON = 42;
async function ensureTourTables(): Promise<void> {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_tour_progress (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, visited jsonb NOT NULL DEFAULT '[]'::jsonb, xp_spent integer NOT NULL DEFAULT 0, shares integer NOT NULL DEFAULT 0, updated_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_tour_shares (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES magnum_users(id) ON DELETE CASCADE, city_id text NOT NULL, day_id text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, UNIQUE(user_id, city_id, day_id))`;
}
void ensureTourTables().catch(e=>console.error("[tour tables] failed", String(e).slice(0,120)));
async function handleTourProgress(req: Request): Promise<Response> {
  const token = extractToken(req);
  let user: { id:number; username:string }|null = null;
  if (token) { try { user = await getUserByToken(token); } catch {} }
  try {
    await ensureTourTables();
    const sql = getSql();
    const rows = user ? await sql`SELECT visited, xp_spent, shares FROM magnum_tour_progress WHERE user_id=${user.id} LIMIT 1` : [];
    const visited: string[] = rows.length ? (Array.isArray((rows[0] as {visited:unknown}).visited) ? (rows[0] as {visited:string[]}).visited : []) : [];
    const xp_spent = rows.length ? Number((rows[0] as {xp_spent:number}).xp_spent) : 0;
    const shares = rows.length ? Number((rows[0] as {shares:number}).shares) : 0;
    return Response.json({ stops: TOUR_STOPS_CANON, visited, xpSpent: xp_spent, shares, xpCost: TOUR_XP_COST_CANON, shareReward: TOUR_SHARE_REWARD_CANON, authed: Boolean(user) });
  } catch(e){ console.error("[tour progress] failed", e); return Response.json({ error:"db error" },{status:500}); }
}
async function handleTourVisit(req: Request): Promise<Response> {
  const auth = await requireAuth(req); if (auth instanceof Response) return auth; const { user } = auth;
  const ip = getClientIp(req);
  if (!checkRateLimit(`tour:visit:${user.id}:${ip}`, 20, 60_000)) return Response.json({ error:"rate limited" },{status:429});
  let body: { cityId?: string; id?: string };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error:"Invalid JSON" },{status:400}); }
  const cityId = String(body.cityId ?? body.id ?? "").trim();
  if (!isTourCityIdCanon(cityId as TourStopCanon["id"])) return Response.json({ error:"unknown cityId", valid: TOUR_STOPS_CANON.map(s=>s.id) },{status:400});
  try {
    await ensureTourTables();
    const sql = getSql();
    const rows = await sql`SELECT visited, xp_spent FROM magnum_tour_progress WHERE user_id=${user.id} LIMIT 1`;
    let visited: string[] = rows.length && Array.isArray((rows[0] as {visited:unknown}).visited) ? (rows[0] as {visited:string[]}).visited : [];
    if (visited.includes(cityId)) return Response.json({ error:"already visited", cityId },{status:409});
    // check pass xp
    await ensurePassSeasonRow();
    const passRow = await getPassRow(user.id);
    if (passRow.xp < TOUR_XP_COST_CANON) return Response.json({ error:"not enough xp", need: TOUR_XP_COST_CANON, have: passRow.xp },{status:402});
    // deduct xp: update magnum_pass_progress xp -42
    const newXp = Math.max(0, passRow.xp - TOUR_XP_COST_CANON);
    const newLevel = Math.min(MAX_LEVEL, Math.floor(newXp / XP_PER_LEVEL));
    await sql`UPDATE magnum_pass_progress SET xp=${newXp}, level=${newLevel}, updated_at=now() WHERE user_id=${user.id}`;
    visited = [...visited, cityId];
    const xpSpent = (rows.length ? Number((rows[0] as {xp_spent:number}).xp_spent) : 0) + TOUR_XP_COST_CANON;
    await sql`INSERT INTO magnum_tour_progress (user_id, visited, xp_spent, shares) VALUES (${user.id}, ${JSON.stringify(visited)}::jsonb, ${xpSpent}, 0) ON CONFLICT (user_id) DO UPDATE SET visited=${JSON.stringify(visited)}::jsonb, xp_spent=${xpSpent}, updated_at=now()`;
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${-TOUR_XP_COST_CANON}, 'tour_visit', ${JSON.stringify({ cityId })}::jsonb)`;
    const city = TOUR_STOPS_CANON.find(s=>s.id===cityId);
    return Response.json({ ok:true, cityId, city, visited, xp: newXp, level: newLevel, xpSpent });
  } catch(e){ console.error("[tour visit] failed", e); return Response.json({ error:"db error" },{status:500}); }
}
async function handleTourShare(req: Request): Promise<Response> {
  const auth = await requireAuth(req); if (auth instanceof Response) return auth; const { user } = auth;
  const ip = getClientIp(req);
  if (!checkRateLimit(`tour:share:${user.id}:${ip}`, 10, 60_000)) return Response.json({ error:"rate limited" },{status:429});
  let body: { cityId?: string; id?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  const cityId = String(body.cityId ?? body.id ?? "").trim();
  if (cityId && !isTourCityIdCanon(cityId as TourStopCanon["id"])) return Response.json({ error:"unknown cityId" },{status:400});
  try {
    await ensureTourTables();
    const sql = getSql();
    const today = new Date().toISOString().slice(0,10);
    const keyCity = cityId || "tour";
    const dup = await sql`SELECT id FROM magnum_tour_shares WHERE user_id=${user.id} AND city_id=${keyCity} AND day_id=${today} LIMIT 1`;
    if (dup.length > 0) return Response.json({ error:"already shared today", cityId: keyCity, dayId: today },{status:429});
    await sql`INSERT INTO magnum_tour_shares (user_id, city_id, day_id) VALUES (${user.id}, ${keyCity}, ${today})`;
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    const upd = await sql`UPDATE magnum_coins SET balance = balance + ${TOUR_SHARE_REWARD_CANON} WHERE user_id=${user.id} RETURNING balance`;
    const balance = Number((upd[0] as {balance:number}).balance);
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${TOUR_SHARE_REWARD_CANON}, 'tour_share', ${JSON.stringify({ cityId: keyCity, dayId: today })}::jsonb)`;
    await sql`INSERT INTO magnum_tour_progress (user_id, visited, xp_spent, shares) VALUES (${user.id}, '[]'::jsonb, 0, 1) ON CONFLICT (user_id) DO UPDATE SET shares = magnum_tour_progress.shares + 1, updated_at=now()`;
    try { await addPassXp(user.id, 5, 'tour_share'); } catch {}
    return Response.json({ ok:true, reward: TOUR_SHARE_REWARD_CANON, balance, cityId: keyCity, dayId: today });
  } catch(e){
    const msg = String(e);
    if (msg.includes("duplicate") || msg.includes("23505")) return Response.json({ error:"already shared today" },{status:429});
    console.error("[tour share] failed", e); return Response.json({ error:"db error" },{status:500});
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
    try { await bumpQuest(user.id, "daily_mining30", 1); } catch {}
    try { await addPassXp(user.id, 5, 'mining'); } catch {}
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
    // Топ — только аккаунты: анонимные клики (user_id IS NULL) не смешиваются с юзерами,
    // их суммарное число отдаётся отдельным полем anonClicks.
    const rows=await sql`SELECT u.username, count(*)::int as clicks, max(c.created_at) as last_click FROM magnum_presave_clicks c JOIN magnum_users u ON u.hidden=false AND u.id=c.user_id GROUP BY u.username ORDER BY clicks DESC, last_click ASC LIMIT 20`;
    const anonRows=await sql`SELECT count(*)::int as clicks FROM magnum_presave_clicks WHERE user_id IS NULL`;
    const anonClicks=anonRows.length? Number((anonRows[0] as {clicks:number}).clicks) : 0;
    const mapped=rows.map((r:unknown)=>{ const x=r as {username:string;clicks:number;last_click:string}; return {username:String(x.username),clicks:Number(x.clicks),lastClick:x.last_click}; });
    const leaderboard=await decorateWithCosmetics(mapped);
    return Response.json({ leaderboard, count: leaderboard.length, anonClicks });
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
  let body: { url?: string; variant?: string; ts?: number; ref?: string; referralCode?: string };
  try { body = (await req.json().catch(() => ({}))) as typeof body; } catch { body = {}; }
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 500) : "/magnum";
  if (url.length > 500 || url.includes("<") || url.includes("\"")) return Response.json({ error: "invalid url" }, { status: 400 });
  const allowedVariants = new Set(["a", "b", "return-popup"]);
  const rawVariant = typeof body.variant === "string" ? body.variant.trim().slice(0, 32) : "";
  const variant = allowedVariants.has(rawVariant) ? rawVariant : null;
  // UTM ref forwarding: body.ref or url ?ref= or cookie magnum_ref — capture for presave row meta
  let refCode: string | null = null;
  try {
    const rawRef = typeof body.ref === "string" ? body.ref.trim() : typeof body.referralCode === "string" ? body.referralCode.trim() : "";
    if (rawRef && /^42-[A-Z0-9]{4}$/i.test(rawRef)) refCode = rawRef.toUpperCase();
    else {
      // parse ?ref= from url field
      const u = new URL(url, "https://5opka.ru");
      const qref = u.searchParams.get("ref")?.trim() ?? "";
      if (qref && /^42-[A-Z0-9]{4}$/i.test(qref)) refCode = qref.toUpperCase();
      else {
        // also query of request URL itself may carry ?ref
        const rq = new URL(req.url).searchParams.get("ref")?.trim() ?? "";
        if (rq && /^42-[A-Z0-9]{4}$/i.test(rq)) refCode = rq.toUpperCase();
        else {
          const cookieRef = getCookie(req, "magnum_ref")?.trim() ?? "";
          if (cookieRef && /^42-[A-Z0-9]{4}$/i.test(cookieRef)) refCode = cookieRef.toUpperCase();
        }
      }
    }
  } catch {}
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
        // UTM ref auto-redeem on presave (if ?ref=CODE present and user hasn't redeemed)
        if (refCode) {
          try {
            const selfCodeRows = await sql`SELECT id FROM magnum_users WHERE id=${userId} LIMIT 1`;
            // selfCode via deterministic function using userId
            const selfCode = `42-${userId.toString(36).toUpperCase().padStart(4, "0").slice(-4)}`;
            if (refCode !== selfCode) {
              const already = await sql`SELECT id FROM magnum_referrals WHERE invited_id=${userId} LIMIT 1`;
              if (already.length === 0) {
                let inviterId: number | null = null;
                const n = parseInt(refCode.slice(3), 36);
                if (Number.isFinite(n) && n > 0) {
                  const uu = await sql`SELECT id FROM magnum_users WHERE id=${n} LIMIT 1`;
                  if (uu.length) inviterId = Number((uu[0] as { id: number }).id);
                }
                if (inviterId && inviterId !== userId) {
                  try {
                    await sql`INSERT INTO magnum_referrals (inviter_id, invited_id, code) VALUES (${inviterId}, ${userId}, ${refCode})`;
                    const reward = 42;
                    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${userId}, 1000) ON CONFLICT (user_id) DO NOTHING`;
                    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${inviterId}, 1000) ON CONFLICT (user_id) DO NOTHING`;
                    await sql`UPDATE magnum_coins SET balance = balance + ${reward} WHERE user_id=${userId}`;
                    await sql`UPDATE magnum_coins SET balance = balance + ${reward} WHERE user_id=${inviterId}`;
                    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${userId}, ${reward}, 'referral_in', ${JSON.stringify({ code: refCode, inviter: inviterId, via: "presave_ref" })}::jsonb)`;
                    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${inviterId}, ${reward}, 'referral_bonus', ${JSON.stringify({ invited: userId, code: refCode, via: "presave_ref" })}::jsonb)`;
                    try {
                      const meRows = await sql`SELECT username FROM magnum_users WHERE id=${userId} LIMIT 1`;
                      const meName = meRows.length ? String((meRows[0] as { username: string }).username) : `user#${userId}`;
                      await ensureNotification(inviterId, "Реферал 42! (presave)", `Братуха ${meName} поставил пресейв по твоему коду ${refCode} +${reward}`, "referral");
                    } catch {}
                  } catch {}
                }
              }
            }
          } catch {}
        }
        if (cnt === 1) {
          await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${userId}, 1000) ON CONFLICT (user_id) DO NOTHING`;
          const upd = await sql`UPDATE magnum_coins SET balance = balance + 42 WHERE user_id=${userId} RETURNING balance`;
          const bal = upd.length ? Number((upd[0] as { balance: number }).balance) : 0;
          await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${userId}, 42, 'presave_bonus', '{"bonus":42}'::jsonb)`;
          try { await ensureNotification(userId, "Пресейв MAGNUM", "+42 монеты за пресейв — спасибо! 🔥", "presave"); } catch {}
          try { await maybeValidateReferral(userId); } catch {}
          return Response.json({ ok: true, bonus: 42, balance: bal, firstPresave: true, refApplied: Boolean(refCode) });
        }
        try { await maybeValidateReferral(userId); } catch {}
      } catch (e) { console.error("[presave bonus] failed", e); }
    }
    return Response.json({ ok: true, refApplied: Boolean(refCode && userId) });
  } catch (e) {
    console.error("[presave click] failed", e);
    return Response.json({ ok: true });
  }
}

async function ensurePresaveRecoveryTable(): Promise<void> {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_presave_recovery (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, claimed_at timestamp DEFAULT now() NOT NULL)`;
}
async function handlePresaveRecoverBonus(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`presave:recover:${user.id}:${ip}`, 5, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  try {
    const sql = getSql();
    await ensurePresaveRecoveryTable();
    await ensureDustTable();
    const ex = await sql`SELECT user_id FROM magnum_presave_recovery WHERE user_id=${user.id} LIMIT 1`;
    if (ex.length > 0) return Response.json({ ok: false, already: true, error: "already claimed" }, { status: 409 });
    const dust = 142;
    await sql`INSERT INTO magnum_presave_recovery (user_id, claimed_at) VALUES (${user.id}, now())`;
    await sql`INSERT INTO magnum_dust (user_id, balance) VALUES (${user.id}, ${dust}) ON CONFLICT (user_id) DO UPDATE SET balance=magnum_dust.balance+${dust}, updated_at=now()`;
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    // also add presave click as recovery so myClicks becomes 1
    try { await sql`INSERT INTO magnum_presave_clicks (user_id, url, ip, variant, created_at) VALUES (${user.id}, 'https://music.thefence.me/psmagnum', ${ip}, 'recovery', now())`; } catch {}
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${dust}, 'presave_recover', ${JSON.stringify({ dust, origin: "recovery" })}::jsonb)`;
    const dustRow = await sql`SELECT balance FROM magnum_dust WHERE user_id=${user.id} LIMIT 1`;
    const dustBal = dustRow.length ? Number((dustRow[0] as { balance: number }).balance) : dust;
    const coinRow = await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const coinBal = coinRow.length ? Number((coinRow[0] as { balance: number }).balance) : 0;
    try { await ensureNotification(user.id, "Пресейв восстановлен", `+${dust} dust за возврат — золотая рамка ближе!`, "presave"); } catch {}
    return Response.json({ ok: true, dust, dustBalance: dustBal, balance: coinBal });
  } catch (e) {
    console.error("[presave recover] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}
async function handlePresaveStreakBonus(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ip = getClientIp(req);
  if (!checkRateLimit(`presave:streak:${user.id}:${ip}`, 5, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  try {
    const sql = getSql();
    const dailyRows = await sql`SELECT streak FROM magnum_daily_claims WHERE user_id=${user.id} ORDER BY claimed_at DESC LIMIT 1`;
    const streak = dailyRows.length ? Number((dailyRows[0] as { streak: number }).streak) : 0;
    if (streak < 3) return Response.json({ error: "need streak >=3", streak }, { status: 400 });
    const presRows = await sql`SELECT count(*)::int as c FROM magnum_presave_clicks WHERE user_id=${user.id}`;
    const hasPresave = Number((presRows[0] as { c: number }).c) > 0;
    if (!hasPresave) return Response.json({ error: "need presave first", streak, needPresave: true }, { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    try { await sql`CREATE TABLE IF NOT EXISTS magnum_presave_streak_bonus (user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, day_id text, created_at timestamp DEFAULT now(), PRIMARY KEY (user_id, day_id))`; } catch {}
    const dup = await sql`SELECT user_id FROM magnum_presave_streak_bonus WHERE user_id=${user.id} AND day_id=${today} LIMIT 1`;
    if (dup.length) return Response.json({ ok: false, already: true, error: "already claimed today" }, { status: 409 });
    await sql`INSERT INTO magnum_presave_streak_bonus (user_id, day_id) VALUES (${user.id}, ${today})`;
    await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
    const upd = await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id} RETURNING balance`;
    const bal = Number((upd[0] as { balance: number }).balance);
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, 42, 'presave_streak', ${JSON.stringify({ streak, dayId: today })}::jsonb)`;
    return Response.json({ ok: true, reward: 42, balance: bal, streak });
  } catch (e) {
    console.error("[presave streak] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
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
    const rows = await sql`SELECT u.username, m.balance, m.upgrades, s.skin_id as avatar FROM magnum_mining m JOIN magnum_users u ON u.hidden=false AND u.id=m.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=m.user_id AND s.equipped=true ORDER BY m.balance DESC LIMIT 20`;
    const mapped = rows.map((r: unknown) => {
      const x = r as { username: string; balance: number; upgrades: unknown; avatar: string | null };
      const ups = parseUpgrades(x.upgrades);
      const perSec = ups.reduce((sum, u) => sum + (UPGRADES_DEF[u.id]?.auto ?? 0) * u.count, 0);
      return { username: String(x.username), balance: Number(x.balance), perSec, upgrades: ups, avatar: x.avatar || null };
    });
    const top = await decorateWithCosmetics(mapped);
    return Response.json({ top, count: top.length });
  } catch (e) {
    console.error("[mining top] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

// ---- Game scores + referrals + duel history (magnum_game_scores / referrals / duel_history) ----
const GAME_WHITELIST = new Set(["runner","match3","knife","memory","clicker","clicker42","rhythm","stack","blackjack","roulette","2042","flappy","typing","snake","dodge","quiz","timeline","duel","duel42","duel-magma","duel-volcano","mining","nitro"]);
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
    try { await bumpQuest(user.id, "daily_win5", 1); } catch {}
    try { await maybeValidateReferral(user.id); } catch {}
    try { await addPassXp(user.id, 10, 'game'); } catch {}
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
      ? await sql`SELECT g.game, g.score, g.created_at, u.username, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.hidden=false AND u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true WHERE g.game=${game} ORDER BY g.score DESC, g.created_at ASC LIMIT ${limit}`
      : await sql`SELECT g.game, g.score, g.created_at, u.username, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.hidden=false AND u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true ORDER BY g.score DESC LIMIT ${limit}`;
    const mapped = rows.map((r: unknown) => { const x=r as {game:string;score:number;created_at:string;username:string;avatar:string|null}; return { game:String(x.game), score:Number(x.score), username:String(x.username), avatar:x.avatar||null, created_at:x.created_at }; });
    return Response.json({ top: await decorateWithCosmetics(mapped), count: rows.length, game: game || "all" });
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
async function handleReferralTrack(req: Request): Promise<Response> {
  const ip = getClientIp(req);
  if (!checkRateLimit(`referral:track:${ip}`, 30, 60_000)) return Response.json({ error: "rate limited" }, { status: 429 });
  const url = new URL(req.url);
  let raw = url.searchParams.get("ref")?.trim().toUpperCase() ?? "";
  if (!raw) {
    try { const b = (await req.json()) as { ref?: unknown; code?: unknown }; raw = String(b.ref ?? b.code ?? "").trim().toUpperCase(); } catch {}
  }
  raw = raw.slice(0, 32);
  if (!raw) return Response.json({ error: "ref required 42-XXXX" }, { status: 400 });
  if (raw.startsWith("42-") && raw.length !== 7) return Response.json({ error: "invalid brat code 42-XXXX" }, { status: 400 });
  if (!/^42-[A-Z0-9]{4}$/.test(raw)) return Response.json({ error: "invalid code format 42-XXXX" }, { status: 400 });
  const inviterId = bratCodeToUserId(raw);
  if (inviterId === null) return Response.json({ error: "code not found" }, { status: 404 });
  try {
    const sql = getSql();
    const u = await sql`SELECT id, username FROM magnum_users WHERE id=${inviterId} LIMIT 1`;
    if (u.length === 0) return Response.json({ error: "code not found" }, { status: 404 });
    const headers: Record<string, string> = {};
    // set referral cookie for 30 days (presave + register will consume)
    headers["Set-Cookie"] = `magnum_ref=${encodeURIComponent(raw)}; Path=/; Max-Age=${30*86400}; SameSite=Lax`;
    return Response.json({ ok: true, code: raw, inviterId, inviter: String((u[0] as { username: string }).username) }, { headers });
  } catch (e) { console.error("[referral track] failed", e); return Response.json({ error: "db error" }, { status: 500 }); }
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
    const ordered = await decorateWithCosmetics(since ? list : list.reverse());
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
    const feedRows = rows.map((r: unknown) => { const x = r as { id: number; body: string; created_at: string; username: string; avatar: string | null }; return { id: Number(x.id), body: String(x.body), username: String(x.username), avatar: x.avatar || null, created_at: x.created_at }; });
    return Response.json({ feed: await decorateWithCosmetics(feedRows), count: rows.length });
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
  try{ const sql=getSql(); const u=await sql`SELECT id,username FROM magnum_users WHERE username=${name} LIMIT 1`; if(u.length===0) return Response.json({error:"not found"},{status:404});
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
    return Response.json({user:{username:name},coins,balance:coins,mining,avatar,cosmetics,verified:frameR.length?Boolean((frameR[0] as {verified:boolean}).verified):false,counts:{achievements:Number(((achR[0] as {c:number}).c)),transactions:Number(((txR[0] as {c:number}).c))}});
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
    const enriched=await sql`SELECT h.winner, count(*)::int as wins, s.skin_id as avatar FROM magnum_duel_history h LEFT JOIN magnum_users u ON u.hidden=false AND u.username=h.winner LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE h.winner IS NOT NULL GROUP BY h.winner, s.skin_id ORDER BY wins DESC LIMIT 20`;
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
    const top=await sql`SELECT h.winner, count(*)::int as wins, s2.skin_id as avatar FROM magnum_duel_history h LEFT JOIN magnum_users u ON u.hidden=false AND u.username=h.winner LEFT JOIN magnum_shop_inventory s2 ON s2.user_id=u.id AND s2.equipped=true WHERE h.winner IS NOT NULL AND h.created_at >= ${since} GROUP BY h.winner,s2.skin_id ORDER BY wins DESC LIMIT 20`;
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
// Реальные wins/streak дуэлянта из magnum_duel_history — вместо локальной накрутки в ArenaPage.
async function handleDuel42Stats(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT winner, created_at FROM magnum_duel_history WHERE scores @> ${JSON.stringify([{ name: user.username }])}::jsonb ORDER BY created_at DESC LIMIT 100`;
    const list = rows as Array<{ winner: string | null; created_at: string }>;
    const plays = list.length;
    const wins = list.filter((r) => r.winner === user.username).length;
    let streak = 0;
    for (const r of list) {
      if (r.winner === user.username) streak++;
      else break;
    }
    return Response.json({ plays, wins, streak, maxStreak: 7, username: user.username });
  } catch (e) {
    console.error("[duel42 stats] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
}

async function handleDuel42Leaderboard(req: Request): Promise<Response> {
  try {
    const sql=getSql();
    const url=new URL(req.url);
    const limit=Math.min(30,Math.max(1,Number(url.searchParams.get("limit")||20)));
    // season 7d: game=duel42 + created_at > now-7d
    const rows=await sql`SELECT u.username as player, l.score, l.created_at, s.skin_id as avatar FROM magnum_leaderboard l JOIN magnum_users u ON u.hidden=false AND u.id=l.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE l.game='duel42' AND l.created_at > now() - interval '7 days' ORDER BY l.score DESC, l.created_at ASC LIMIT ${limit}`;
    const mapped=rows.map((r:unknown)=>{const x=r as {player:string;score:number;created_at:string;avatar:string|null}; return {player:String(x.player),username:String(x.player),score:Number(x.score),created_at:x.created_at,avatar:x.avatar||null};});
    const board=await decorateWithCosmetics(mapped);
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
    const rows=await sql`SELECT u.username as player, l.score, l.created_at, s.skin_id as avatar FROM magnum_leaderboard l JOIN magnum_users u ON u.hidden=false AND u.id=l.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE l.game=${game} AND l.created_at > now() - interval '7 days' ORDER BY l.score DESC, l.created_at ASC LIMIT ${limit}`;
    const mapped=rows.map((r:unknown)=>{const x=r as {player:string;score:number;created_at:string;avatar:string|null}; return {player:String(x.player),username:String(x.player),score:Number(x.score),created_at:x.created_at,avatar:x.avatar||null};});
    const board=await decorateWithCosmetics(mapped);
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
    const top=await sql`SELECT u.username, e.elo FROM magnum_duel42_elo e JOIN magnum_users u ON u.hidden=false AND u.id=e.user_id ORDER BY e.elo DESC LIMIT 20`;
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
    try{
      const r=await sql`SELECT u.username as player, l.score, l.created_at, s.skin_id as avatar FROM magnum_leaderboard l JOIN magnum_users u ON u.hidden=false AND u.id=l.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE l.game='conveyor' ORDER BY l.score DESC LIMIT 10`;
      const m=r.map((x0:unknown)=>{const x=x0 as {player:string;score:number;created_at:string;avatar:string|null}; return {player:String(x.player),username:String(x.player),score:Number(x.score),created_at:x.created_at,avatar:x.avatar||null};});
      top=await decorateWithCosmetics(m);
    }catch{}
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
    try{ await sql`INSERT INTO magnum_leaderboard (player,score,game,created_at,user_id) VALUES (${user.username},${newDust},'conveyor',now(),${user.id})`; }catch{}
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
    try{ await sql`INSERT INTO magnum_leaderboard (player,score,game,created_at,user_id) VALUES (${user.username},${newDust},'conveyor',now(),${user.id})`; }catch{}
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
      try{ await sql`INSERT INTO magnum_leaderboard (player,score,game,user_id) VALUES (${user.username},${newXp},'pet42',${user.id})`; }catch{}
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
    if(evolved){ try{ await sql`INSERT INTO magnum_leaderboard (player,score,game,user_id) VALUES (${user.username},${newXp},'pet42',${user.id})`; }catch{} }
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
    const rows=await sql`SELECT u.username as player, l.score, l.created_at, s.skin_id as avatar FROM magnum_leaderboard l JOIN magnum_users u ON u.hidden=false AND u.id=l.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE l.game='pet42' ORDER BY l.score DESC, l.created_at ASC LIMIT 20`;
    const mapped=rows.map((r:unknown)=>{ const x=r as {player:string;score:number;created_at:string;avatar:string|null}; return {player:String(x.player), username:String(x.player), score:Number(x.score), created_at:x.created_at, avatar:x.avatar||null}; });
    const board=await decorateWithCosmetics(mapped);
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
    const rows = await sql`SELECT s.id, s.user_id, s.track_slug, s.preset, s.scenes, s.created_at, u.username, COALESCE(l.cnt,0)::int as likes FROM magnum_studio_saves s JOIN magnum_users u ON u.hidden=false AND u.id=s.user_id LEFT JOIN (SELECT save_id, count(*) as cnt FROM magnum_studio_likes GROUP BY save_id) l ON l.save_id=s.id ORDER BY s.created_at DESC LIMIT 50`;
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
    const rows=await sql`SELECT s.id, s.user_id, s.track_slug, s.preset, s.scenes, s.created_at, u.username, COALESCE(l.cnt,0)::int as likes FROM magnum_studio_saves s JOIN magnum_users u ON u.hidden=false AND u.id=s.user_id LEFT JOIN (SELECT save_id, count(*) as cnt FROM magnum_studio_likes WHERE created_at > now() - interval '7 days' GROUP BY save_id) l ON l.save_id=s.id WHERE s.created_at > now() - interval '7 days' ORDER BY likes DESC, s.created_at ASC LIMIT 20`;
    const top=rows.map((r: unknown)=>{
      const x=r as {id:number; user_id:number; track_slug:string; preset:string; scenes:unknown; created_at:string; username:string|null; likes:number};
      let reward=0; // placeholder: 142/420/1420 for top3 could be claimed via share? leaderboard itself is read-only
      return { id:Number(x.id), userId:Number(x.user_id), username:x.username?String(x.username):"Братуха", trackSlug:String(x.track_slug), preset:String(x.preset), scenes:x.scenes, likes:Number(x.likes), created_at:x.created_at };
    });
    // weekly rewards mapping for display: top1 1420 top2 420 top3 142
    const rewards=[1420,420,142];
    top.forEach((t,idx)=>{ (t as unknown as {reward:number}).reward = idx<3?rewards[idx]!:0; });
    const decorated=await decorateWithCosmetics(top as unknown as Array<Record<string, unknown>>);
    return Response.json({ leaderboard:decorated, top:decorated, count:decorated.length, weekRewards:rewards });
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

// ---- ЧАРТЫ 42 — live-стримы/просмотры MAGNUM 5 треков (seeded, +42 share/guess) ----
async function ensureChartsTables(): Promise<void>{
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_charts_snapshots (id serial PRIMARY KEY, track_slug text NOT NULL, plays integer NOT NULL, views integer NOT NULL, delta integer NOT NULL DEFAULT 0, delta_views integer NOT NULL DEFAULT 0, period text NOT NULL DEFAULT 'week', updated_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_chart_shares (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, day text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, UNIQUE(user_id, day))`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_chart_guesses (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, period text NOT NULL, track_slug text NOT NULL, hit boolean NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_charts_period ON magnum_charts_snapshots(period)`;
}
void ensureChartsTables().then(()=> console.log("[startup] magnum_charts_* ensured")).catch(e=> console.error("[startup] charts ensure failed",e));

async function handleChartsGet(req: Request): Promise<Response>{
  const url=new URL(req.url);
  const periodRaw=(url.searchParams.get("period")||"week").toLowerCase();
  const period=isPeriod(periodRaw)? periodRaw as "week"|"month"|"all" : "week";
  try{
    await ensureChartsTables();
    const sql=getSql();
    const rows=await sql`SELECT track_slug, plays, views, delta, delta_views, period, updated_at FROM magnum_charts_snapshots WHERE period=${period} ORDER BY plays DESC LIMIT 5`;
    if(rows.length===5){
      return Response.json({ ok:true, period, snapshots: rows.map((r:unknown)=>{ const x=r as {track_slug:string;plays:number;views:number;delta:number;delta_views:number;period:string;updated_at:string}; return { track_slug:String(x.track_slug), plays:Number(x.plays), views:Number(x.views), delta:Number(x.delta), delta_views:Number(x.delta_views), period:String(x.period), updated_at:x.updated_at }; }) });
    }
    // seed deterministically per day
    const day=new Date().toISOString().slice(0,10);
    const seeded=seededSnapshots(period, day);
    // upsert seed for future gets
    try{ for(const s of seeded){ await sql`INSERT INTO magnum_charts_snapshots (track_slug, plays, views, delta, delta_views, period, updated_at) VALUES (${s.track_slug}, ${s.plays}, ${s.views}, ${s.delta}, ${s.delta_views}, ${s.period}, now())`; } }catch{}
    // return seeded sorted by plays
    return Response.json({ ok:true, period, snapshots: seeded, seeded:true });
  }catch(e){ console.error("[charts get] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleChartsShare(req: Request): Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const day=new Date().toISOString().slice(0,10);
  await ensureChartsTables();
  const sql=getSql();
  const dup=await sql`SELECT id FROM magnum_chart_shares WHERE user_id=${user.id} AND day=${day} LIMIT 1`;
  if(dup.length>0) return Response.json({error:"already shared today", day, coins:0},{status:409});
  await sql`INSERT INTO magnum_chart_shares (user_id, day) VALUES (${user.id}, ${day})`;
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'charts-share',${JSON.stringify({day})}::jsonb)`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, coins:42, day, balance:Number((upd[0] as {balance:number}).balance) });
}
async function handleChartsGuess(req: Request): Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`charts:guess:${user.id}:${ip}`, 8, 60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{track?:string; track_slug?:string; period?:string}; try{ body=await req.json() as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const trackRaw=String(body.track ?? body.track_slug ?? "").toLowerCase().trim();
  const periodRaw=String(body.period ?? "week").toLowerCase().trim();
  const period=isPeriod(periodRaw)? periodRaw as "week"|"month"|"all" : "week";
  const allowed=["vpn","clay","nova","magnum","meduza"];
  if(!allowed.includes(trackRaw)) return Response.json({error:"track must be vpn|clay|nova|magnum|meduza"},{status:400});
  await ensureChartsTables();
  const sql=getSql();
  // guard 1 per day per period? simple: check if already guessed today
  const day=new Date().toISOString().slice(0,10);
  const dup=await sql`SELECT id FROM magnum_chart_guesses WHERE user_id=${user.id} AND period=${period} AND created_at::date = ${day}::date LIMIT 1`;
  if(dup.length>0) return Response.json({error:"already guessed today", period},{status:409});
  // determine current #1
  const rows=await sql`SELECT track_slug FROM magnum_charts_snapshots WHERE period=${period} ORDER BY plays DESC LIMIT 1`;
  let top: string;
  if(rows.length>0) top=String((rows[0] as {track_slug:string}).track_slug);
  else {
    const seeded=seededSnapshots(period, day);
    top=seeded[0]!.track_slug;
    // ensure table seeded for next
    try{ for(const s of seeded){ await sql`INSERT INTO magnum_charts_snapshots (track_slug, plays, views, delta, delta_views, period) VALUES (${s.track_slug}, ${s.plays}, ${s.views}, ${s.delta}, ${s.delta_views}, ${s.period})`; } }catch{}
  }
  const hit = trackRaw===top;
  await sql`INSERT INTO magnum_chart_guesses (user_id, period, track_slug, hit) VALUES (${user.id}, ${period}, ${trackRaw}, ${hit})`;
  if(hit){
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'charts-guess',${JSON.stringify({period, track:trackRaw, top, hit})}::jsonb)`;
  }
  const upd=hit ? await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1` : null;
  return Response.json({ ok:true, hit, top, period, track:trackRaw, reward: hit?42:0, balance: upd? Number((upd[0] as {balance:number}).balance): undefined });
}

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

// ---- ФЛЕШМОБ 42 — ежедневный общий челлендж + шаринг-вирус ----
async function ensureFlashmobTables(): Promise<void>{
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_flashmob_days (day text PRIMARY KEY, type text NOT NULL, title text NOT NULL, seed integer NOT NULL, created_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_flashmob_scores (user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, day text NOT NULL, score integer NOT NULL, created_at timestamp DEFAULT now() NOT NULL, PRIMARY KEY(user_id, day))`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_flashmob_shares (user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, day text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, PRIMARY KEY(user_id, day))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_flashmob_scores_day_score ON magnum_flashmob_scores(day, score DESC)`;
}
void ensureFlashmobTables().then(()=> console.log("[startup] magnum_flashmob_* ensured")).catch(e=> console.error("[startup] flashmob ensure failed",e));

function flashmobDayInfo(day:string){
  const info=getFlashmobForDay(day);
  return { day, type: info.id, title: info.title, shortTitle: info.shortTitle, desc: info.desc, seed: info.seed, durationSec: info.durationSec, target: info.target, icon: info.icon };
}
async function ensureFlashmobDay(day:string){
  await ensureFlashmobTables();
  const sql=getSql();
  const info=flashmobDayInfo(day);
  await sql`INSERT INTO magnum_flashmob_days (day, type, title, seed) VALUES (${day}, ${info.type}, ${info.title}, ${info.seed}) ON CONFLICT (day) DO NOTHING`;
  return info;
}
async function handleFlashmobToday(req:Request):Promise<Response>{
  const day=new Date().toISOString().slice(0,10);
  const info=await ensureFlashmobDay(day);
  const token=extractToken(req);
  let myScore:number|null=null; let myRank:number|null=null; let count=0;
  try{
    const sql=getSql();
    const cntRows=await sql`SELECT count(*)::int as c FROM magnum_flashmob_scores WHERE day=${day}`;
    count = Number((cntRows[0] as {c:number}).c);
    if(token){
      let user:{id:number;username:string}|null=null;
      try{ user=await getUserByToken(token);}catch{}
      if(user){
        const rows=await sql`SELECT score FROM magnum_flashmob_scores WHERE user_id=${user.id} AND day=${day} LIMIT 1`;
        if(rows.length) myScore=Number((rows[0] as {score:number}).score);
        if(myScore!==null){
          const rRows=await sql`SELECT count(*)::int as better FROM magnum_flashmob_scores WHERE day=${day} AND score > ${myScore}`;
          myRank = Number((rRows[0] as {better:number}).better)+1;
        }
      }
    }
  }catch(e){ console.error("[flashmob today] count failed",e); }
  return Response.json({ ok:true, ...info, myScore, myRank, count });
}
async function handleFlashmobLeaderboard(req:Request):Promise<Response>{
  const url=new URL(req.url);
  const day=(url.searchParams.get("day")||new Date().toISOString().slice(0,10)).slice(0,10);
  const limit=Math.min(50, Math.max(1, Number(url.searchParams.get("limit")||10)));
  await ensureFlashmobTables();
  const sql=getSql();
  const token=extractToken(req);
  let myScore:number|null=null; let myRank:number|null=null; let count=0;
  try{ await ensureFlashmobDay(day); }catch{}
  try{
    const cntRows=await sql`SELECT count(*)::int as c FROM magnum_flashmob_scores WHERE day=${day}`;
    count=Number((cntRows[0] as {c:number}).c);
    if(token){
      try{
        const u=await getUserByToken(token);
        if(u){
          const r=await sql`SELECT score FROM magnum_flashmob_scores WHERE user_id=${u.id} AND day=${day} LIMIT 1`;
          if(r.length) myScore=Number((r[0] as {score:number}).score);
          if(myScore!==null){
            const rr=await sql`SELECT count(*)::int as better FROM magnum_flashmob_scores WHERE day=${day} AND score > ${myScore}`;
            myRank=Number((rr[0] as {better:number}).better)+1;
          }
        }
      }catch{}
    }
    const rows=await sql`SELECT s.user_id, s.score, s.created_at, u.username, inv.skin_id as avatar FROM magnum_flashmob_scores s JOIN magnum_users u ON u.hidden=false AND u.id=s.user_id LEFT JOIN magnum_shop_inventory inv ON inv.user_id=s.user_id AND inv.equipped=true WHERE s.day=${day} ORDER BY s.score DESC, s.created_at ASC LIMIT ${limit}`;
    const items=rows.map((r:unknown, i:number)=>{ const x=r as {user_id:number;score:number;created_at:string;username:string;avatar:string|null}; return { userId:Number(x.user_id), username:String(x.username), score:Number(x.score), rank:i+1, avatar:x.avatar||null, created_at: x.created_at }; });
    const decorated=await decorateWithCosmetics(items as unknown as Array<Record<string, unknown>>);
    return Response.json({ ok:true, day, items:decorated, count, myRank, myScore, limit });
  }catch(e){ console.error("[flashmob lb] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleFlashmobSubmit(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`flashmob:submit:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{score?:unknown; day?:unknown}; try{ body=await req.json() as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const score=Number(body.score); if(!Number.isInteger(score)||score<0||score>999999) return Response.json({error:"score 0..999999"},{status:400});
  const dayRaw=typeof body.day==="string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day.trim()) ? body.day.trim() : new Date().toISOString().slice(0,10);
  const day=dayRaw;
  await ensureFlashmobTables(); await ensureFlashmobDay(day);
  const sql=getSql();
  try{
    const existing=await sql`SELECT score FROM magnum_flashmob_scores WHERE user_id=${user.id} AND day=${day} LIMIT 1`;
    let bestScore=score;
    if(existing.length>0){
      const prev=Number((existing[0] as {score:number}).score);
      if(score <= prev){
        bestScore=prev;
      } else {
        await sql`UPDATE magnum_flashmob_scores SET score=${score}, created_at=now() WHERE user_id=${user.id} AND day=${day}`;
      }
    } else {
      await sql`INSERT INTO magnum_flashmob_scores (user_id, day, score) VALUES (${user.id}, ${day}, ${score})`;
    }
    if(existing.length>0 && Number((existing[0] as {score:number}).score) >= score){
      bestScore=Number((existing[0] as {score:number}).score);
    }
    // rank + count
    const cntRows=await sql`SELECT count(*)::int as c FROM magnum_flashmob_scores WHERE day=${day}`;
    const count=Number((cntRows[0] as {c:number}).c);
    const betterRows=await sql`SELECT count(*)::int as better FROM magnum_flashmob_scores WHERE day=${day} AND score > ${bestScore}`;
    const rank=Number((betterRows[0] as {better:number}).better)+1;
    const pct=Math.max(1, Math.round((rank/count)*100));
    // streak: count consecutive days ending at day with score
    let streak=1;
    try{
      const rows=await sql`SELECT day FROM magnum_flashmob_scores WHERE user_id=${user.id} ORDER BY day DESC LIMIT 10`;
      const days=(rows as {day:string}[]).map(r=> String(r.day)).sort().reverse();
      // build set
      const set=new Set(days);
      let cur=new Date(day+"T12:00:00Z");
      streak=0;
      for(let i=0;i<10;i++){
        const d=cur.toISOString().slice(0,10);
        if(set.has(d)) streak++;
        else break;
        cur.setUTCDate(cur.getUTCDate()-1);
      }
    }catch{}
    let coinsEarned=0; let topReward=0;
    // top-3 reward once per day
    if(rank===1) topReward=1420;
    else if(rank===2) topReward=420;
    else if(rank===3) topReward=142;
    if(topReward>0){
      // idempotent: check transaction for today top reward exists
      const chk=await sql`SELECT id FROM magnum_transactions WHERE user_id=${user.id} AND reason='flashmob-top' AND meta->>'day' = ${day} LIMIT 1`;
      if(chk.length===0){
        await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
        await sql`UPDATE magnum_coins SET balance=balance+${topReward} WHERE user_id=${user.id}`;
        await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${topReward},'flashmob-top',${JSON.stringify({day, rank, score:bestScore})}::jsonb)`;
        coinsEarned+=topReward;
      } else {
        topReward=0;
      }
    }
    // streak 3 bonus +142 once per streak day
    if(streak>=3){
      const chk2=await sql`SELECT id FROM magnum_transactions WHERE user_id=${user.id} AND reason='flashmob-streak' AND meta->>'day' = ${day} LIMIT 1`;
      if(chk2.length===0){
        await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
        await sql`UPDATE magnum_coins SET balance=balance+142 WHERE user_id=${user.id}`;
        await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},142,'flashmob-streak',${JSON.stringify({day, streak})}::jsonb)`;
        coinsEarned+=142;
      }
    }
    const balRows= coinsEarned>0 ? await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1` : null;
    const balance = balRows && balRows.length ? Number((balRows[0] as {balance:number}).balance) : undefined;
    return Response.json({ ok:true, day, score:bestScore, rank, count, pct, streak, topReward, coins: coinsEarned, balance });
  }catch(e){ console.error("[flashmob submit] failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleFlashmobShare(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`flashmob:share:${user.id}:${ip}`,12,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{day?:unknown}; try{ body=await req.json() as typeof body;}catch{ body={}; }
  const dayRaw=typeof body.day==="string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day.trim()) ? body.day.trim() : new Date().toISOString().slice(0,10);
  const day=dayRaw;
  await ensureFlashmobTables();
  const sql=getSql();
  const dup=await sql`SELECT 1 FROM magnum_flashmob_shares WHERE user_id=${user.id} AND day=${day} LIMIT 1`;
  if(dup.length>0) return Response.json({error:"already shared today", day, coins:0},{status:409});
  await sql`INSERT INTO magnum_flashmob_shares (user_id, day) VALUES (${user.id}, ${day})`;
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'flashmob-share',${JSON.stringify({day})}::jsonb)`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, day, coins:42, balance:Number((upd[0] as {balance:number}).balance) });
}

// ---- ЦЕПЬ 42 — челлендж-цепочка 42ч + лента топ-цепей + OG 1080x1920 ----
async function ensureChainTables(): Promise<void> {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_chains (id serial PRIMARY KEY, root_user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, code text UNIQUE NOT NULL, length integer NOT NULL DEFAULT 1, created_at timestamp DEFAULT now() NOT NULL, expires_at timestamp NOT NULL, broken boolean NOT NULL DEFAULT false)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chains_root ON magnum_chains(root_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chains_code ON magnum_chains(code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chains_length ON magnum_chains(length DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_chain_links (id serial PRIMARY KEY, chain_id integer REFERENCES magnum_chains(id) ON DELETE CASCADE NOT NULL, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, joined_at timestamp DEFAULT now() NOT NULL, challenge_type text NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chain_links_chain ON magnum_chain_links(chain_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chain_links_user ON magnum_chain_links(user_id, joined_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_chain_shares (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE NOT NULL, day_id text NOT NULL, created_at timestamp DEFAULT now() NOT NULL, UNIQUE(user_id, day_id))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chain_shares_day ON magnum_chain_shares(day_id)`;
}
void ensureChainTables().then(()=> console.log("[startup] magnum_chains ensured")).catch(e=> console.error("[startup] chain ensure failed",e));

async function expireStaleChains(): Promise<void> {
  try { const sql=getSql(); await sql`UPDATE magnum_chains SET broken=true WHERE broken=false AND expires_at < now()`; } catch {}
}

async function getActiveChainForUser(userId: number): Promise<null | { id:number; root_user_id:number; code:string; length:number; created_at:string; expires_at:string; broken:boolean }> {
  await ensureChainTables();
  await expireStaleChains();
  const sql=getSql();
  const rows=await sql`SELECT id, root_user_id, code, length, created_at, expires_at, broken FROM magnum_chains WHERE root_user_id=${userId} AND broken=false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`;
  if(rows.length===0) return null;
  const r=rows[0] as { id:number; root_user_id:number; code:string; length:number; created_at:string; expires_at:string; broken:boolean };
  return { id:Number(r.id), root_user_id:Number(r.root_user_id), code:String(r.code), length:Number(r.length), created_at:String(r.created_at), expires_at:String(r.expires_at), broken:Boolean(r.broken) };
}

async function getChainByCode(code: string){
  await ensureChainTables();
  await expireStaleChains();
  const sql=getSql();
  const rows=await sql`SELECT c.id, c.root_user_id, c.code, c.length, c.created_at, c.expires_at, c.broken, u.username as root_username FROM magnum_chains c LEFT JOIN magnum_users u ON u.id=c.root_user_id WHERE c.code=${code} LIMIT 1`;
  if(rows.length===0) return null;
  const r=rows[0] as { id:number; root_user_id:number; code:string; length:number; created_at:string; expires_at:string; broken:boolean; root_username:string|null };
  return { id:Number(r.id), root_user_id:Number(r.root_user_id), code:String(r.code), length:Number(r.length), created_at:String(r.created_at), expires_at:String(r.expires_at), broken:Boolean(r.broken), root_username: r.root_username? String(r.root_username): `user#${r.root_user_id}` };
}

async function handleChainMe(req: Request): Promise<Response> {
  const auth = await requireAuth(req); if (auth instanceof Response) return auth; const { user } = auth;
  const chain = await getActiveChainForUser(user.id);
  if(!chain) return Response.json({ chain: null, length: 0, broken: false });
  const sql=getSql();
  let links: unknown[] = [];
  try { links = await sql`SELECT l.id, l.user_id, l.joined_at, l.challenge_type, u.username FROM magnum_chain_links l LEFT JOIN magnum_users u ON u.id=l.user_id WHERE l.chain_id=${chain.id} ORDER BY l.joined_at ASC LIMIT 42`; } catch {}
  const remainMs = Math.max(0, new Date(chain.expires_at).getTime() - Date.now());
  const mult = chainMult(chain.length);
  const items = (links as {id:number; user_id:number; joined_at:string; challenge_type:string; username:string|null}[]).map(r=> ({ id:Number(r.id), userId:Number(r.user_id), username: r.username? String(r.username): `user#${r.user_id}`, joined_at:String(r.joined_at), challenge_type:String(r.challenge_type) }));
  return Response.json({ chain: { ...chain, remainMs, mult, broken: chain.broken || remainMs===0 }, links: items, length: chain.length, mult, remainMs, broken: chain.broken || remainMs===0, code: chain.code, link: `/magnum/chain/join/${chain.code}` });
}

async function handleChainCreate(req: Request): Promise<Response> {
  const auth = await requireAuth(req); if (auth instanceof Response) return auth; const { user } = auth;
  const ip=getClientIp(req);
  if(!checkRateLimit(`chain:create:${user.id}:${ip}`, 5, 60_000)) return Response.json({ error:"rate limited 5/мин"},{status:429});
  if(!checkRateLimit(`chain:create:ip:${ip}`, 5, 60_000)) return Response.json({ error:"rate limited ip 5/мин"},{status:429});
  let body:{challenge_type?:unknown; challengeType?:unknown}; try{ body=await req.json() as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const ctRaw=String(body.challenge_type ?? body.challengeType ?? "").trim().toLowerCase();
  if(!LINK_TYPES.some(t=> t.id===ctRaw)) return Response.json({ error:"challenge_type must be click-10s|quiz-1q|mem-like"},{status:400});
  const challenge_type=ctRaw as typeof LINK_TYPES[number]["id"];
  await ensureChainTables();
  const sql=getSql();
  try{
    const recent=await sql`SELECT id FROM magnum_chain_links WHERE user_id=${user.id} AND joined_at > now() - interval '1 hour' LIMIT 1`;
    if(recent.length>0) return Response.json({ error:"1 звено/час — попробуй через час"},{status:429});
  }catch{}
  await expireStaleChains();
  let chain = await getActiveChainForUser(user.id);
  if(!chain){
    let code=genChainCode();
    for(let attempt=0; attempt<3; attempt++){
      try{
        const expires=new Date(Date.now()+ CHAIN_RULES.TTL_MS).toISOString();
        const rows=await sql`INSERT INTO magnum_chains (root_user_id, code, length, expires_at, broken) VALUES (${user.id}, ${code}, 1, ${expires}, false) RETURNING id, code, length, expires_at, created_at`;
        const r=rows[0] as {id:number; code:string; length:number; expires_at:string; created_at:string};
        const nid=Number(r.id);
        await sql`INSERT INTO magnum_chain_links (chain_id, user_id, challenge_type) VALUES (${nid}, ${user.id}, ${challenge_type})`;
        const newChain={ id:nid, root_user_id:user.id, code:String(r.code), length:1, created_at:String(r.created_at), expires_at:String(r.expires_at), broken:false };
        const remainMs=Math.max(0, new Date(newChain.expires_at).getTime()-Date.now());
        return Response.json({ ok:true, chain: { ...newChain, remainMs, mult: chainMult(1) }, code: newChain.code, link:`/magnum/chain/join/${newChain.code}`, length:1, created:true, reward:0 }, {status:201});
      }catch(e){
        const msg=String(e);
        if(msg.includes("duplicate")||msg.includes("23505")){ code=genChainCode(); continue; }
        console.error("[chain create] failed",e);
        return Response.json({error:"db error"},{status:500});
      }
    }
    return Response.json({error:"code collision retry failed"},{status:500});
  } else {
    try{
      const expires=new Date(Date.now()+ CHAIN_RULES.TTL_MS).toISOString();
      await sql`UPDATE magnum_chains SET length = length + 1, expires_at=${expires} WHERE id=${chain.id}`;
      await sql`INSERT INTO magnum_chain_links (chain_id, user_id, challenge_type) VALUES (${chain.id}, ${user.id}, ${challenge_type})`;
      const upd=await sql`SELECT length, expires_at FROM magnum_chains WHERE id=${chain.id} LIMIT 1`;
      const nl=Number((upd[0] as {length:number}).length);
      const ne=String((upd[0] as {expires_at:string}).expires_at);
      const remainMs=Math.max(0, new Date(ne).getTime()-Date.now());
      const mult=chainMult(nl);
      return Response.json({ ok:true, chain: { ...chain, length:nl, expires_at:ne, remainMs, mult }, code: chain.code, link:`/magnum/chain/join/${chain.code}`, length:nl, mult, remainMs, created:false, reward:0 });
    }catch(e){ console.error("[chain create extend] failed",e); return Response.json({error:"db error"},{status:500}); }
  }
}

async function handleChainJoin(req: Request): Promise<Response> {
  const auth = await requireAuth(req); if (auth instanceof Response) return auth; const { user } = auth;
  const ip=getClientIp(req);
  if(!checkRateLimit(`chain:join:${user.id}:${ip}`, 5, 60_000)) return Response.json({ error:"rate limited 5/мин"},{status:429});
  if(!checkRateLimit(`chain:join:ip:${ip}`, 5, 60_000)) return Response.json({ error:"rate limited ip 5/мин"},{status:429});
  let body:{code?:unknown; challenge_type?:unknown; challengeType?:unknown}; try{ body=await req.json() as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const rawCode=String(body.code??"").trim();
  const norm=normalizeCode(rawCode);
  if(!norm) return Response.json({error:"code 4 символа A-Z2-9"},{status:400});
  const ctRaw=String(body.challenge_type ?? body.challengeType ?? "quiz-1q").trim().toLowerCase();
  const challenge_type = LINK_TYPES.some(t=> t.id===ctRaw) ? ctRaw as typeof LINK_TYPES[number]["id"] : "quiz-1q" as const;
  try{
    const sql=getSql();
    const recent=await sql`SELECT id FROM magnum_chain_links WHERE user_id=${user.id} AND joined_at > now() - interval '1 day' LIMIT 1`;
    if(recent.length>0) return Response.json({ error:"1 приём/день — завтра, братуха"},{status:429});
  }catch{}
  const chain=await getChainByCode(norm);
  if(!chain) return Response.json({error:"цепь не найдена по коду"},{status:404});
  if(chain.broken) return Response.json({error:"цепь оборвана — 42ч истекли"},{status:410});
  if(new Date(chain.expires_at).getTime() <= Date.now()) return Response.json({error:"цепь истекла — 42ч истекли"},{status:410});
  if(chain.root_user_id===user.id) return Response.json({error:"нельзя вступить в свою цепь"},{status:400});
  const sql=getSql();
  try{
    const mem=await sql`SELECT id FROM magnum_chain_links WHERE chain_id=${chain.id} AND user_id=${user.id} LIMIT 1`;
    if(mem.length>0) return Response.json({error:"уже в цепи"},{status:409});
  }catch{}
  try{
    const expires=new Date(Date.now()+ CHAIN_RULES.TTL_MS).toISOString();
    await sql`UPDATE magnum_chains SET length = length + 1, expires_at=${expires} WHERE id=${chain.id}`;
    await sql`INSERT INTO magnum_chain_links (chain_id, user_id, challenge_type) VALUES (${chain.id}, ${user.id}, ${challenge_type})`;
    const upd=await sql`SELECT length, expires_at FROM magnum_chains WHERE id=${chain.id} LIMIT 1`;
    const nl=Number((upd[0] as {length:number}).length);
    const ne=String((upd[0] as {expires_at:string}).expires_at);
    const remainMs=Math.max(0, new Date(ne).getTime()-Date.now());
    const mult=chainMult(nl);
    const rewardBase=CHAIN_RULES.REWARD_JOIN;
    const reward=Math.round(rewardBase * mult);
    const bankBonus=Math.floor(reward * 0.1);
    const totalReward=reward + bankBonus;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${chain.root_user_id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`UPDATE magnum_coins SET balance = balance + ${totalReward} WHERE user_id=${user.id}`;
    await sql`UPDATE magnum_coins SET balance = balance + ${totalReward} WHERE user_id=${chain.root_user_id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${totalReward},'chain-join',${JSON.stringify({chainId: chain.id, code: chain.code, mult, bankBonus, base: rewardBase})}::jsonb)`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${chain.root_user_id},${totalReward},'chain-join-root',${JSON.stringify({chainId: chain.id, code: chain.code, joiner: user.id, mult, bankBonus})}::jsonb)`;
    try{ await sql`INSERT INTO magnum_notifications (user_id,title,body,kind) VALUES (${chain.root_user_id},'Цепь +1 звено! 🔗','Братуха ${user.username} вступил в твою цепь — длина ${nl} • +${totalReward} каждому • mult x${mult}','social')`; }catch{}
    const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const balance=Number((balRows[0] as {balance:number}).balance);
    return Response.json({ ok:true, chain:{ ...chain, length:nl, expires_at:ne, remainMs, mult }, length:nl, mult, remainMs, reward: totalReward, bankBonus, base:rewardBase, balance, joiner:user.username });
  }catch(e){ console.error("[chain join] failed",e); return Response.json({error:"db error"},{status:500}); }
}

async function handleChainFeed(): Promise<Response> {
  try{
    await ensureChainTables();
    await expireStaleChains();
    const sql=getSql();
    const rows=await sql`SELECT c.id, c.root_user_id, c.code, c.length, c.created_at, c.expires_at, c.broken, u.username as root_username FROM magnum_chains c LEFT JOIN magnum_users u ON u.id=c.root_user_id WHERE c.broken=false AND c.expires_at > now() ORDER BY c.length DESC, c.created_at ASC LIMIT 10`;
    const items=(rows as {id:number; root_user_id:number; code:string; length:number; created_at:string; expires_at:string; broken:boolean; root_username:string|null}[]).map((r,i)=> {
      const remainMs=Math.max(0, new Date(r.expires_at).getTime()-Date.now());
      const mult=chainMult(Number(r.length));
      return { id:Number(r.id), root_user_id:Number(r.root_user_id), code:String(r.code), length:Number(r.length), created_at:String(r.created_at), expires_at:String(r.expires_at), broken:Boolean(r.broken), root_username: r.root_username? String(r.root_username): `user#${r.root_user_id}`, username: r.root_username? String(r.root_username): `user#${r.root_user_id}`, mult, remainMs, rank:i+1, crown: i===0, isTop3: i<3 };
    });
    return Response.json({ ok:true, feed: items, top: items, count: items.length });
  }catch(e){ console.error("[chain feed] failed",e); return Response.json({error:"db error"},{status:500}); }
}

async function handleChainCode(req: Request, codeParam: string): Promise<Response> {
  const norm=normalizeCode(codeParam);
  if(!norm) return Response.json({error:"code 4 символа"},{status:400});
  const chain=await getChainByCode(norm);
  if(!chain) return Response.json({error:"цепь не найдена"},{status:404});
  const remainMs=Math.max(0, new Date(chain.expires_at).getTime()-Date.now());
  const mult=chainMult(chain.length);
  const sql=getSql();
  let links: unknown[]=[];
  try{ links=await sql`SELECT l.user_id, l.joined_at, l.challenge_type, u.username FROM magnum_chain_links l LEFT JOIN magnum_users u ON u.id=l.user_id WHERE l.chain_id=${chain.id} ORDER BY l.joined_at ASC LIMIT 42`; }catch{}
  const linkRows=(links as {user_id:number; joined_at:string; challenge_type:string; username:string|null}[]).map(r=> ({ userId:Number(r.user_id), username: r.username? String(r.username): `user#${r.user_id}`, joined_at:String(r.joined_at), challenge_type:String(r.challenge_type) }));
  const broken=chain.broken || remainMs===0;
  return Response.json({ ok:true, chain:{ ...chain, remainMs, mult, broken }, links: linkRows, length:chain.length, mult, remainMs, broken, code: chain.code, link:`/magnum/chain/join/${chain.code}` });
}

async function handleChainShare(req: Request): Promise<Response> {
  const auth = await requireAuth(req); if (auth instanceof Response) return auth; const { user } = auth;
  const dayId=new Date().toISOString().slice(0,10);
  await ensureChainTables();
  const sql=getSql();
  const dup=await sql`SELECT id FROM magnum_chain_shares WHERE user_id=${user.id} AND day_id=${dayId} LIMIT 1`;
  if(dup.length>0) return Response.json({error:"already shared today", dayId, coins:0},{status:409});
  await sql`INSERT INTO magnum_chain_shares (user_id, day_id) VALUES (${user.id}, ${dayId})`;
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'chain-share',${JSON.stringify({dayId})}::jsonb)`;
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, coins:42, dayId, balance:Number((upd[0] as {balance:number}).balance) });
}

async function handleChainOg(req: Request): Promise<Response> {
  const url=new URL(req.url);
  const codeParam=(url.searchParams.get("code")|| url.searchParams.get("chain")|| "").trim().toUpperCase();
  let chain: { id:number; root_user_id:number; code:string; length:number; created_at:string; expires_at:string; broken:boolean; root_username:string } | null = null;
  let length=1; let mult=1; let remainMs=CHAIN_RULES.TTL_MS; let username="Братуха";
  if(codeParam){
    const norm=normalizeCode(codeParam);
    if(norm) chain=await getChainByCode(norm) as unknown as typeof chain;
    if(chain){ length=chain.length; mult=chainMult(length); remainMs=Math.max(0, new Date(chain.expires_at).getTime()-Date.now()); username=chain.root_username; }
  } else {
    const token=extractToken(req);
    if(token){ try{ const u=await getUserByToken(token); if(u){ const c=await getActiveChainForUser(u.id); if(c){ length=c.length; mult=chainMult(length); remainMs=Math.max(0, new Date(c.expires_at).getTime()-Date.now()); username=u.username; chain={ id:c.id, root_user_id:c.root_user_id, code:c.code, length:c.length, created_at:c.created_at, expires_at:c.expires_at, broken:c.broken, root_username:u.username } as unknown as typeof chain; } } }catch{} }
  }
  const codeDisp=chain? chain.code : (codeParam || "42CE");
  const crown = length>=10 ? "👑" : length>=5 ? "🔥" : "🔗";
  const bg=`<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0a0a0a"/><stop offset="55%" stop-color="#1a1020"/><stop offset="100%" stop-color="#ff2d55"/></linearGradient>`;
  const remainClock = remainMs>0 ? `${String(Math.floor(remainMs/3600000)).padStart(2,"0")}:${String(Math.floor((remainMs%3600000)/60000)).padStart(2,"0")}:${String(Math.floor((remainMs%60000)/1000)).padStart(2,"0")}` : "00:00:00 ОБРЫВ";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs>${bg}<linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ffcc00"/><stop offset="100%" stop-color="#ff2d55"/></linearGradient></defs><rect width="1080" height="1920" rx="0" fill="url(#g)"/><text x="48" y="120" font-family="Inter,sans-serif" font-size="84" font-weight="900" fill="#fff">ЦЕПЬ 42 ${crown}</text><text x="48" y="190" font-family="Inter,sans-serif" font-size="36" font-weight="700" fill="rgba(255,255,255,.92)">братуха ${username} • длина ${length} • x${mult}</text><text x="48" y="250" font-family="Inter,sans-serif" font-size="28" font-weight="600" fill="#ffcc00">42ч до обрыва • ${remainClock}</text><rect x="48" y="320" width="984" height="220" rx="18" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.12)"/><text x="78" y="380" font-family="Inter,sans-serif" font-size="26" font-weight="700" fill="#fff">Код цепи</text><text x="78" y="470" font-family="monospace" font-size="96" font-weight="900" fill="url(#gold)" letter-spacing="8">${codeDisp}</text><text x="78" y="520" font-family="Inter,sans-serif" font-size="22" fill="rgba(255,255,255,.7)">/magnum/chain/join/${codeDisp} • кинь звено другу</text><rect x="340" y="680" width="400" height="400" rx="18" fill="#fff" stroke="rgba(255,204,0,.4)" stroke-width="4"/><text x="540" y="880" text-anchor="middle" font-family="monospace" font-size="48" font-weight="900" fill="#111">QR</text><text x="540" y="930" text-anchor="middle" font-family="monospace" font-size="18" fill="#555">magnum/chain/join/${codeDisp}</text><rect x="48" y="1180" width="984" height="280" rx="18" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)"/><text x="78" y="1240" font-family="Inter,sans-serif" font-size="22" font-weight="700" fill="#fff">Лента топ-цепей • mult x1.05 кап x2.0 • топ-1 👑 +1420 epic</text><text x="78" y="1280" font-family="Inter,sans-serif" font-size="18" fill="rgba(255,255,255,.7)">1 звено/час • 1 приём/день • шаринг +42/день • приём +42 обоим</text><text x="78" y="1340" font-family="monospace" font-size="20" fill="#ffcc00">chain 1080×1920 • MAGNUM 42 • 5opka.ru/magnum/chain</text><text x="48" y="1860" font-family="Inter,sans-serif" font-size="22" fill="rgba(255,255,255,.8)">MAGNUM • ЦЕПЬ 42 • кидай звенья, держи 42 часа</text><text x="48" y="1890" font-family="Inter,sans-serif" font-size="18" fill="rgba(255,255,255,.55)">5opka.ru/magnum/chain • цепь ${codeDisp} • ${new Date().toISOString().slice(0,10)}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type":"image/svg+xml; charset=utf-8", "Cache-Control":"public, max-age=60", "Content-Length": String(Buffer.byteLength(svg)) } });
}


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
    await sql`BEGIN`;
    try{
      await sql`UPDATE magnum_challenges SET status='expired' WHERE status='pending' AND expires_at < now()`;
      const rows=await sql`SELECT id, challenger_id, challenged_id, game, score, status, expires_at FROM magnum_challenges WHERE id=${cid} LIMIT 1 FOR UPDATE`;
      if(rows.length===0){ await sql`ROLLBACK`; return Response.json({error:"not found"},{status:404}); }
      const ch=rows[0] as {id:number; challenger_id:number; challenged_id:number; game:string; score:number; status:string; expires_at:string};
      if(Number(ch.challenged_id)!==user.id){ await sql`ROLLBACK`; return Response.json({error:"not your challenge"},{status:403}); }
      if(String(ch.status)!=="pending"){ await sql`ROLLBACK`; return Response.json({error:`already ${ch.status}`},{status:409}); }
      if(new Date(ch.expires_at).getTime() < Date.now()){ await sql`UPDATE magnum_challenges SET status='expired' WHERE id=${cid}`; await sql`COMMIT`; return Response.json({error:"expired"},{status:410});}
      const upd=await sql`UPDATE magnum_challenges SET status='accepted' WHERE id=${cid} AND status='pending' RETURNING id`;
      if(upd.length===0){ await sql`ROLLBACK`; return Response.json({error:"already accepted"},{status:409}); }
      await sql`COMMIT`;
      const gameMap:Record<string,string>={ duel:"/magnum/games/duel-volcano", mining:"/magnum/mining", conveyor:"/magnum/conveyor", pet:"/magnum/map", studio:"/magnum/shop" };
      const redirect=gameMap[String(ch.game)] || "/magnum/games/duel-volcano";
      return Response.json({ ok:true, challenge:{ id:cid, status:"accepted" }, redirect, game:String(ch.game), score:Number(ch.score) });
    }catch(e){ try{ await sql`ROLLBACK`; }catch{} throw e; }
  }catch(e){ console.error("[board accept] failed",e); return Response.json({error:"db error"},{status:500});}
}
async function handleBoardShare(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  const user=await getUserByToken(token); if(!user) return Response.json({error:"unauthorized"},{status:401});
  const dayId=new Date().toISOString().slice(0,10);
  await ensureBoardTables();
  const sql=getSql();
  await sql`BEGIN`;
  try{
    const ins=await sql`INSERT INTO magnum_board_shares (user_id, day_id) VALUES (${user.id}, ${dayId}) ON CONFLICT (user_id, day_id) DO NOTHING RETURNING id`;
    if(ins.length===0){ await sql`ROLLBACK`; return Response.json({error:"already shared today", dayId, coins:0},{status:429}); }
    await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} FOR UPDATE`;
    await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'board-share',${JSON.stringify({dayId})}::jsonb)`;
    const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const balance=Number((upd[0] as {balance:number}).balance);
    const cntRes=await sql`SELECT count(*)::int as c FROM magnum_board_shares`;
    const globalCount=Number((cntRes[0] as {c:number}).c);
    await sql`COMMIT`;
    return Response.json({ ok:true, coins:42, dayId, balance, globalCount });
  }catch(e){ try{ await sql`ROLLBACK`; }catch{} console.error("[board share] tx failed",e); return Response.json({error:"db error"},{status:500}); }
}
async function handleBoardLeaderboard():Promise<Response>{
  try{
    await ensureBoardTables();
    const sql=getSql();
    const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-7);
    const rows=await sql`SELECT g.user_id, u.username, max(g.score)::int as best, count(*)::int as plays, s.skin_id as avatar FROM magnum_game_scores g JOIN magnum_users u ON u.id=g.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=g.user_id AND s.equipped=true WHERE g.created_at > ${weekStart.toISOString()} GROUP BY g.user_id, u.username, s.skin_id ORDER BY best DESC LIMIT 20`;
    const boardRows=rows.map((r:unknown,i:number)=>{ const x=r as {user_id:number; username:string; best:number; plays:number; avatar:string|null}; const idx=i; const reward= idx===0?1420: idx===1?420: idx===2?142:0; return { rank:idx+1, userId:Number(x.user_id), username:String(x.username), score:Number(x.best), plays:Number(x.plays), avatar:x.avatar||null, reward, crown: idx<3?"conic-gold":"", isTop3: idx<3 };});
    const top=await decorateWithCosmetics(boardRows);
    const globalRes=await sql`SELECT count(*)::int as c FROM magnum_board_shares`;
    const globalCount=Number((globalRes[0] as {c:number}).c);
    return Response.json({ leaderboard:top, top, count:top.length, globalCount, weekRewards:[1420,420,142], crown:"conic-gold", weekStart: weekStart.toISOString() });
  }catch(e){ console.error("[board leaderboard] failed",e); return Response.json({error:"db error"},{status:500});}
}

// ---- PASS 42 — Battle Pass 42 lvl + XP из всех игр ----
async function ensurePassTables(): Promise<void> {
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_pass_progress (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, season_id text NOT NULL DEFAULT 's42-2026', level integer NOT NULL DEFAULT 0, xp integer NOT NULL DEFAULT 0, claimed_levels integer[] NOT NULL DEFAULT '{}', premium boolean NOT NULL DEFAULT false, updated_at timestamp DEFAULT now() NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_pass_seasons (id text PRIMARY KEY, starts_at timestamp NOT NULL, ends_at timestamp NOT NULL, rewards jsonb NOT NULL DEFAULT '[]'::jsonb)`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_subscriptions (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, tier text NOT NULL, started_at timestamp DEFAULT now(), ends_at timestamp, created_at timestamp DEFAULT now())`;
}
async function ensurePassSeasonRow(): Promise<void> {
  const sql=getSql();
  await ensurePassTables();
  const pr=PASS_REWARDS as unknown as object;
  await sql`INSERT INTO magnum_pass_seasons (id, starts_at, ends_at, rewards) VALUES (${SEASON_ID}, ${new Date(Date.now()-30*24*3600*1000).toISOString()}::timestamp, ${new Date(Date.now()+30*24*3600*1000).toISOString()}::timestamp, ${JSON.stringify(PASS_REWARDS)}::jsonb) ON CONFLICT (id) DO NOTHING`;
}
function passLevelFromXp(xp:number):number{ return Math.min(MAX_LEVEL, Math.floor(Math.max(0,xp)/XP_PER_LEVEL)); }
function passProgressFromRow(row:{level:number;xp:number;claimed_levels:unknown;premium:boolean;season_id:string}):{level:number;xp:number;claimed:number[];premium:boolean;seasonId:string;xpInLevel:number;xpNeed:number;pct:number;progress:number}{
  const xp=Math.max(0, Number(row.xp||0));
  const lvl=passLevelFromXp(xp);
  const xpIn=xp - lvl*XP_PER_LEVEL;
  const pct=(xpIn / XP_PER_LEVEL)*100;
  const claimed=Array.isArray(row.claimed_levels)? (row.claimed_levels as number[]).map(Number).filter(n=>Number.isFinite(n)) : [];
  return { level:lvl, xp, claimed, premium:Boolean(row.premium), seasonId:String(row.season_id||SEASON_ID), xpInLevel: xpIn, xpNeed: XP_PER_LEVEL, pct, progress: lvl };
}
async function getPassRow(userId:number){
  await ensurePassTables();
  const sql=getSql();
  const rows=await sql`SELECT season_id, level, xp, claimed_levels, premium FROM magnum_pass_progress WHERE user_id=${userId} LIMIT 1`;
  if(rows.length===0){
    const xp=0; const lvl=0;
    await sql`INSERT INTO magnum_pass_progress (user_id, season_id, level, xp, claimed_levels, premium) VALUES (${userId}, ${SEASON_ID}, ${lvl}, ${xp}, '{}', false) ON CONFLICT (user_id) DO NOTHING`;
    return { season_id: SEASON_ID, level:lvl, xp, claimed_levels: [] as number[], premium:false };
  }
  const r=rows[0] as {season_id:string; level:number; xp:number; claimed_levels:unknown; premium:boolean};
  return { season_id:String(r.season_id||SEASON_ID), level:Number(r.level||0), xp:Number(r.xp||0), claimed_levels:r.claimed_levels, premium:Boolean(r.premium) };
}
async function addPassXp(userId:number, amount:number, source:string):Promise<{xp:number;level:number;leveled:boolean}>{
  if(!Number.isFinite(amount) || amount<=0) return { xp:0, level:0, leveled:false };
  const amt=Math.max(1, Math.min(1420, Math.floor(amount)));
  await ensurePassTables();
  const sql=getSql();
  const row=await getPassRow(userId);
  const beforeXp=Number(row.xp||0);
  const beforeLv=passLevelFromXp(beforeXp);
  const newXp=Math.min(MAX_LEVEL*XP_PER_LEVEL, beforeXp + amt);
  const newLv=passLevelFromXp(newXp);
  await sql`UPDATE magnum_pass_progress SET xp=${newXp}, level=${newLv}, updated_at=now() WHERE user_id=${userId}`;
  try{ await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${userId}, 0, 'pass_xp', ${JSON.stringify({source, amount:amt, beforeXp, newXp, beforeLv, newLv})}::jsonb)`; }catch{}
  return { xp:newXp, level:newLv, leveled: newLv>beforeLv };
}
async function isPremiumByTier(userId:number):Promise<boolean>{
  try{
    const sql=getSql();
    await ensurePassTables();
    const rows=await sql`SELECT tier, ends_at FROM magnum_subscriptions WHERE user_id=${userId} ORDER BY id DESC LIMIT 1`;
    if(rows.length===0) return false;
    const r=rows[0] as {tier:string; ends_at:string|null};
    const tier=String(r.tier||"").toLowerCase();
    if(!["vip","vip+","vip_plus","pro","premium"].includes(tier)) return false;
    if(r.ends_at){ const e=new Date(String(r.ends_at)).getTime(); if(Number.isFinite(e) && e < Date.now()) return false; }
    return true;
  }catch{ return false; }
}
async function handlePassProgress(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pass:progress:${user.id}:${ip}`,20,60_000)) return Response.json({error:"rate limited"},{status:429});
  await ensurePassSeasonRow();
  const row=await getPassRow(user.id);
  const prog=passProgressFromRow(row as unknown as {level:number;xp:number;claimed_levels:unknown;premium:boolean;season_id:string});
  // premium tier auto-upgrade if has vip
  let premium=prog.premium;
  if(!premium){ const hasTier=await isPremiumByTier(user.id); if(hasTier){ const sql=getSql(); await sql`UPDATE magnum_pass_progress SET premium=true, updated_at=now() WHERE user_id=${user.id}`; premium=true; } }
  const sql=getSql(); const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`; const balance=balRows.length? Number((balRows[0] as {balance:number}).balance):1000;
  return Response.json({ progress: { seasonId: prog.seasonId, level: prog.level, xp: prog.xp, xpInLevel: prog.xpInLevel, xpNeed: prog.xpNeed, pct: prog.pct, premium, claimed: prog.claimed, progress: prog.progress }, seasonId: prog.seasonId, level: prog.level, xp: prog.xp, premium, claimed: prog.claimed, balance, xpPerLevel: XP_PER_LEVEL, maxLevel: MAX_LEVEL, rewards: PASS_REWARDS });
}
async function handlePassClaim(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pass:claim:${user.id}:${ip}`,20,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{level?:unknown}; try{ body=await req.json() as typeof body;}catch{ return Response.json({error:"Invalid JSON"},{status:400});}
  const lv=Math.floor(Number(body.level));
  if(!Number.isFinite(lv) || lv<1 || lv>MAX_LEVEL) return Response.json({error:"level 1..42"},{status:400});
  await ensurePassSeasonRow();
  const row=await getPassRow(user.id);
  const prog=passProgressFromRow(row as unknown as {level:number;xp:number;claimed_levels:unknown;premium:boolean;season_id:string});
  if(lv > prog.level) return Response.json({error:"locked — need level", level:lv, have:prog.level},{status:423});
  if(prog.claimed.includes(lv)) return Response.json({error:"already claimed", level:lv},{status:409});
  const reward=PASS_REWARDS[lv-1]; if(!reward) return Response.json({error:"no reward"},{status:404});
  let coinsGive=0;
  let premiumGive=false;
  if(reward.free?.coins) coinsGive+=Number(reward.free.coins);
  // premium part only if premium true
  let hasPremium=prog.premium;
  if(!hasPremium){ hasPremium=await isPremiumByTier(user.id); if(hasPremium){ const s=getSql(); await s`UPDATE magnum_pass_progress SET premium=true, updated_at=now() WHERE user_id=${user.id}`; } }
  if(reward.premium && hasPremium){
    if(reward.premium.coins) coinsGive+=Number(reward.premium.coins);
    premiumGive=true;
  }
  if(!reward.free && !reward.premium) return Response.json({error:"no reward on this level"},{status:400});
  if(reward.premium && !hasPremium && reward.premium.coins){
    // still allow free claim but warn premium locked
  }
  const sql=getSql();
  await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id}, 1000) ON CONFLICT (user_id) DO NOTHING`;
  if(coinsGive>0){
    await sql`UPDATE magnum_coins SET balance=balance+${coinsGive} WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${coinsGive}, 'pass_claim', ${JSON.stringify({level:lv, coins:coinsGive, premium:premiumGive})}::jsonb)`;
  }
  // mark claimed
  const newClaimed=[...prog.claimed, lv].sort((a,b)=>a-b);
  await sql`UPDATE magnum_pass_progress SET claimed_levels=${JSON.stringify(newClaimed)}::jsonb, updated_at=now() WHERE user_id=${user.id}`;
  const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const balance=balRows.length? Number((balRows[0] as {balance:number}).balance):1000;
  const newRow=await getPassRow(user.id);
  const newProg=passProgressFromRow(newRow as unknown as {level:number;xp:number;claimed_levels:unknown;premium:boolean;season_id:string});
  return Response.json({ ok:true, level:lv, coins:coinsGive, balance, claimed:newClaimed, progress:newProg, premium: hasPremium });
}
async function handlePassXpAdd(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pass:xp:${user.id}:${ip}`,30,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{amount?:unknown; source?:unknown; game?:unknown}; try{ body=await req.json() as typeof body;}catch{ body={};}
  let amount=Number(body.amount);
  let source=String(body.source||body.game||"game");
  if(!Number.isFinite(amount) || amount<=0){
    if(source==="duelWin") amount=42;
    else if(source==="eco") amount=20;
    else if(source==="mining") amount=5;
    else amount=10;
  }
  amount=Math.max(1, Math.min(1420, Math.floor(amount)));
  const res=await addPassXp(user.id, amount, source);
  const row=await getPassRow(user.id);
  const prog=passProgressFromRow(row as unknown as {level:number;xp:number;claimed_levels:unknown;premium:boolean;season_id:string});
  return Response.json({ ok:true, xp:prog.xp, level:prog.level, amount, source, leveled:res.leveled });
}
async function handlePassPremium(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pass:premium:${user.id}:${ip}`,5,60_000)) return Response.json({error:"rate limited"},{status:429});
  await ensurePassTables();
  const row=await getPassRow(user.id);
  const prog=passProgressFromRow(row as unknown as {level:number;xp:number;claimed_levels:unknown;premium:boolean;season_id:string});
  if(prog.premium) return Response.json({ ok:true, premium:true, already:true });
  const hasTier=await isPremiumByTier(user.id);
  if(hasTier){
    const sql=getSql(); await sql`UPDATE magnum_pass_progress SET premium=true, updated_at=now() WHERE user_id=${user.id}`;
    return Response.json({ ok:true, premium:true, via:"tier" });
  }
  const price=420;
  const sql=getSql();
  await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const bal=balRows.length? Number((balRows[0] as {balance:number}).balance):0;
  if(bal < price) return Response.json({error:"not enough coins", required:price, balance:bal},{status:402});
  await sql`UPDATE magnum_coins SET balance=balance-${price} WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${-price}, 'pass_premium', ${JSON.stringify({price})}::jsonb)`;
  await sql`UPDATE magnum_pass_progress SET premium=true, updated_at=now() WHERE user_id=${user.id}`;
  // premium track действительно открывает VIP: пишем подписку до конца сезона,
  // чтобы AuthStatus (/api/shop/subscriptions) и isPremiumByTier видели один и тот же тир
  const tier = await grantPassPremiumTier(user.id);
  const upd=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, premium:true, price, tier, balance: Number((upd[0] as {balance:number}).balance) });
}

// premium-pass → magnum_subscriptions.tier='vip' до конца сезона
async function grantPassPremiumTier(userId:number):Promise<string|null>{
  try{
    await ensureSubscriptionTable();
    await ensurePassSeasonRow();
    const sql=getSql();
    const active=await sql`SELECT tier FROM magnum_subscriptions WHERE user_id=${userId} AND (ends_at IS NULL OR ends_at > now()) ORDER BY started_at DESC LIMIT 1`;
    if(active.length){
      const cur=String((active[0] as {tier:string}).tier);
      if((TIER_RANK[cur] ?? 0) >= TIER_RANK.vip!) return cur;
    }
    const seasonRows=await sql`SELECT ends_at FROM magnum_pass_seasons WHERE id=${SEASON_ID} LIMIT 1`;
    const endsAt=seasonRows.length? String((seasonRows[0] as {ends_at:string}).ends_at) : new Date(Date.now()+30*24*3600*1000).toISOString();
    await sql`INSERT INTO magnum_subscriptions (user_id, tier, started_at, ends_at) VALUES (${userId}, 'vip', now(), ${endsAt}::timestamp)`;
    return "vip";
  }catch(e){ console.error("[pass premium tier] failed", e); return null; }
}
async function handlePassBuyLevels(req:Request):Promise<Response>{
  const token=extractToken(req); if(!token) return Response.json({error:"unauthorized"},{status:401});
  let user:{id:number;username:string}|null=null; try{ user=await getUserByToken(token);}catch{} if(!user) return Response.json({error:"unauthorized"},{status:401});
  const ip=getClientIp(req); if(!checkRateLimit(`pass:buylevels:${user.id}:${ip}`,5,60_000)) return Response.json({error:"rate limited"},{status:429});
  let body:{count?:unknown}; try{ body=await req.json() as typeof body;}catch{ body={}; }
  const count=Math.min(10, Math.max(1, Math.floor(Number(body.count)||10)));
  const price=count===10?1420: count*142;
  const xpAdd=count*XP_PER_LEVEL;
  const sql=getSql();
  await ensurePassTables();
  await sql`INSERT INTO magnum_coins (user_id, balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  const bal=balRows.length? Number((balRows[0] as {balance:number}).balance):0;
  if(bal < price) return Response.json({error:"not enough coins", required:price, balance:bal},{status:402});
  await sql`UPDATE magnum_coins SET balance=balance-${price} WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id, amount, reason, meta) VALUES (${user.id}, ${-price}, 'pass_buy_levels', ${JSON.stringify({count, price, xpAdd})}::jsonb)`;
  const res=await addPassXp(user.id, xpAdd, `buy_${count}`);
  const row=await getPassRow(user.id);
  const prog=passProgressFromRow(row as unknown as {level:number;xp:number;claimed_levels:unknown;premium:boolean;season_id:string});
  const upd2=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ ok:true, count, price, xpAdded: xpAdd, xp: prog.xp, level: prog.level, balance: Number((upd2[0] as {balance:number}).balance), leveled: res.leveled });
}


// ---- FLOW 42 — битва флоу: judge + wager + ELO + streak + share
async function ensureFlowTables(){
  const sql=getSql();
  await sql`CREATE TABLE IF NOT EXISTS magnum_flow_battles (id serial PRIMARY KEY, user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, opponent text NOT NULL DEFAULT 'bot', wager integer NOT NULL DEFAULT 0, lines jsonb NOT NULL, scores jsonb NOT NULL, verdict text NOT NULL, wpm integer NOT NULL DEFAULT 0, created_at timestamp DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_flow_season (user_id integer PRIMARY KEY REFERENCES magnum_users(id) ON DELETE CASCADE, rating integer NOT NULL DEFAULT 1000, wins integer NOT NULL DEFAULT 0, losses integer NOT NULL DEFAULT 0, streak integer NOT NULL DEFAULT 0, best_streak integer NOT NULL DEFAULT 0, updated_at timestamp DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS magnum_flow_shares (user_id integer REFERENCES magnum_users(id) ON DELETE CASCADE, day text NOT NULL, created_at timestamp DEFAULT now(), PRIMARY KEY (user_id, day))`;
  try{ await sql`CREATE TABLE IF NOT EXISTS magnum_leaderboard (id serial PRIMARY KEY, player text NOT NULL, score integer NOT NULL, game text NOT NULL, created_at timestamp DEFAULT now())`; }catch{}
}
void ensureFlowTables().catch(()=>{});
async function callMimoJudge(lines: string[]){
  const key=process.env.XIAOMI_API_KEY;
  if(!key) return null;
  try{
    const prompt="Ты — AI-судья рэп-баттла БИТВА ФЛОУ 42. Оцени 4 строки по 3 критериям 0-42 каждый: рифма, панч, флоу. Верни JSON {rhyme:0-42,punch:0-42,flow:0-42} строго. Строки:\n"+lines.map((l,i)=> (i+1)+". "+(l||"(пропуск)")).join("\n");
    const base=process.env.MIMO_BASE_URL||"https://token-plan-sgp.xiaomimimo.com/v1";
    const model=process.env.MIMO_MODEL||"mimo-v2.5";
    const r=await fetch(base+"/chat/completions",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json"},body:JSON.stringify({model,messages:[{role:"user",content:prompt}],max_tokens:200,temperature:0.7})});
    if(!r.ok) return null;
    const j=await r.json() as {choices?:{message?:{content?:string}}[]};
    const txt=j.choices?.[0]?.message?.content||"";
    const m=txt.match(/\{[\s\S]*?\}/);
    if(!m) return null;
    const o=JSON.parse(m[0]) as {rhyme:number;punch:number;flow:number};
    const rv=Math.max(0,Math.min(42,Math.floor(Number(o.rhyme)||0)));
    const pv=Math.max(0,Math.min(42,Math.floor(Number(o.punch)||0)));
    const fv=Math.max(0,Math.min(42,Math.floor(Number(o.flow)||0)));
    return {rhyme:rv,punch:pv,flow:fv};
  }catch{ return null; }
}
async function handleFlowJudge(req: Request): Promise<Response>{
  const auth=await requireAuth(req); if(auth instanceof Response) return auth; const user=(auth as {user:{id:number;username:string}}).user;
  const ip=getClientIp(req); if(!checkRateLimit("flow:judge:"+user.id+":"+ip,12,60000)) return Response.json({error:"rate limited"},{status:429});
  let body: {lines?:unknown;wager?:unknown;wpm?:unknown;beat?:unknown}; try{ body=await req.json() as typeof body; }catch{ return Response.json({error:"Invalid JSON"},{status:400}); }
  const lines=Array.isArray(body.lines)? (body.lines as unknown[]).slice(0,4).map(s=>String(s||"").slice(0,80)) : [];
  while(lines.length<4) lines.push("");
  const wager=[0,42,142,420].includes(Number(body.wager))?Number(body.wager):0;
  const wpmVal=Math.max(0,Math.min(300,Math.floor(Number(body.wpm)||0)));
  const beat=[86,73,142].includes(Number(body.beat))?Number(body.beat):86;
  await ensureFlowTables();
  const sql=getSql();
  if(wager>0){
    const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const bal=balRows.length?Number((balRows[0] as {balance:number}).balance):1000;
    if(balRows.length===0) await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
    const cur=balRows.length?bal:1000;
    if(cur < wager) return Response.json({error:"not enough coins",required:wager,balance:cur},{status:402});
    await sql`UPDATE magnum_coins SET balance=balance-${wager} WHERE user_id=${user.id}`;
    await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${-wager},'flow_wager',${JSON.stringify({wager,beat})}::jsonb)`;
  }
  const heur=flowHeuristic(lines);
  const mimo=await callMimoJudge(lines);
  const rhyme=mimo?mimo.rhyme:heur.rhyme;
  const punch=mimo?mimo.punch:heur.punch;
  const flow=mimo?mimo.flow:heur.flow;
  const total=Math.max(0,Math.min(126,rhyme+punch+flow));
  const bonus=wpmVal>80?1.2:1;
  const final=Math.round(total*bonus);
  const botScore=60+Math.floor(Math.random()*31);
  let verdict="draw"; if(final>botScore) verdict="win"; else if(final<botScore) verdict="lose";
  const scores={rhyme,punch,flow,total,wpm:wpmVal,wpmBonus:bonus,final};
  const botLinesArr=[["брат на бите 86 — качаю как XXL","42 братухи в зале — кричи братуха","мой флоу — лава, твой — вода из крана","проверь свой панч — где твой удар, братан?"],["семьдесят три — медленный джаз на районе","пишу как 5opka — каждый бар в законе","ты пропустил такт — я считаю секунды","финал MAGNUM — пять пуль, не секунды"],["сто сорок два — трэп-скорострел","печатай быстрее — или проиграл","WPM за 80 — бонус летит","БРАТ-БОТ не спит — он тебя глотает"]];
  const bi=[86,73,142].indexOf(beat); const botLines=(botLinesArr[bi>=0?bi:0]||botLinesArr[0])!;
  try{
    await sql`INSERT INTO magnum_flow_battles (user_id,opponent,wager,lines,scores,verdict,wpm) VALUES (${user.id},'bot',${wager},${JSON.stringify(lines)}::jsonb,${JSON.stringify(scores)}::jsonb,${verdict},${wpmVal})`;
    await sql`INSERT INTO magnum_leaderboard (player,score,game,user_id) VALUES (${user.username},${final},'flow42',${user.id})`;
  }catch(e){ console.error("[flow persist] failed",e); }
  let reward: {coins:number;elo:number;streak:number;rating:number;balance:number}|null=null;
  try{
    await sql`INSERT INTO magnum_flow_season (user_id,rating,wins,losses,streak,best_streak) VALUES (${user.id},1000,0,0,0,0) ON CONFLICT (user_id) DO NOTHING`;
    const sRows=await sql`SELECT rating,wins,losses,streak,best_streak FROM magnum_flow_season WHERE user_id=${user.id} LIMIT 1`;
    let rating=Number((sRows[0] as {rating:number}).rating||1000), wins=Number((sRows[0] as {wins:number}).wins||0), losses=Number((sRows[0] as {losses:number}).losses||0), streak=Number((sRows[0] as {streak:number}).streak||0), best=Number((sRows[0] as {best_streak:number}).best_streak||0);
    let elo=0, coinsAdd=0;
    if(verdict==="win"){ elo=42; wins++; streak++; if(streak>best) best=streak; if(wager>0) coinsAdd=Math.round(wager*1.5); if(streak>=3) coinsAdd+=142; }
    else if(verdict==="lose"){ elo=-12; losses++; streak=0; }
    rating=Math.max(0,rating+elo);
    await sql`UPDATE magnum_flow_season SET rating=${rating},wins=${wins},losses=${losses},streak=${streak},best_streak=${best},updated_at=now() WHERE user_id=${user.id}`;
    if(coinsAdd>0){
      await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
      await sql`UPDATE magnum_coins SET balance=balance+${coinsAdd} WHERE user_id=${user.id}`;
      await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},${coinsAdd},'flow_win',${JSON.stringify({verdict,wager,final,botScore,wpm:wpmVal})}::jsonb)`;
    }
    const balRows2=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
    const bal2=balRows2.length?Number((balRows2[0] as {balance:number}).balance):1000;
    reward={coins:coinsAdd,elo,streak,rating,balance:bal2};
  }catch(e){ console.error("[flow reward] failed",e); }
  const balF=reward?reward.balance: await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`.then(r=>r.length?Number((r[0] as {balance:number}).balance):1000).catch(()=>1000);
  return Response.json({ok:true,scores,botScore,verdict,botLines,reward,balance:balF});
}
async function handleFlowShare(req: Request): Promise<Response>{
  const auth=await requireAuth(req); if(auth instanceof Response) return auth; const user=(auth as {user:{id:number}}).user;
  const ip=getClientIp(req); if(!checkRateLimit("flow:share:"+user.id+":"+ip,12,60000)) return Response.json({error:"rate limited"},{status:429});
  let body: {dayId?:string;day?:string}; try{ body=await req.json() as typeof body; }catch{ body={}; }
  const day=String(body.dayId||body.day||new Date().toISOString().slice(0,10)).slice(0,10);
  await ensureFlowTables();
  const sql=getSql();
  try{ await sql`INSERT INTO magnum_flow_shares (user_id,day) VALUES (${user.id},${day})`; }catch(e){
    const m=String(e);
    if(m.includes("23505")||m.includes("duplicate")||m.includes("unique")) return Response.json({error:"already shared today"},{status:409});
    console.error("[flow share] failed",e); return Response.json({error:"db error"},{status:500});
  }
  await sql`INSERT INTO magnum_coins (user_id,balance) VALUES (${user.id},1000) ON CONFLICT (user_id) DO NOTHING`;
  await sql`UPDATE magnum_coins SET balance=balance+42 WHERE user_id=${user.id}`;
  await sql`INSERT INTO magnum_transactions (user_id,amount,reason,meta) VALUES (${user.id},42,'flow_share',${JSON.stringify({day})}::jsonb)`;
  const balRows=await sql`SELECT balance FROM magnum_coins WHERE user_id=${user.id} LIMIT 1`;
  return Response.json({ok:true,coins:42,balance:Number((balRows[0] as {balance:number}).balance),day});
}
async function handleFlowLeaderboard(): Promise<Response>{
  await ensureFlowTables();
  try{
    const sql=getSql();
    const rows=await sql`SELECT u.username as username, max(l.score) as score, max(s.skin_id) as avatar FROM magnum_leaderboard l JOIN magnum_users u ON u.hidden=false AND u.id=l.user_id LEFT JOIN magnum_shop_inventory s ON s.user_id=u.id AND s.equipped=true WHERE l.game='flow42' GROUP BY u.username ORDER BY score DESC LIMIT 5`;
    const mapped=rows.map((r: unknown)=>{ const x=r as {username:string;score:number;avatar:string|null}; return {username:String(x.username),player:String(x.username),score:Number(x.score),avatar:x.avatar||null}; });
    return Response.json({top: await decorateWithCosmetics(mapped)});
  }catch(e){ console.error("[flow lb] failed",e); return Response.json({top:[]}); }
}
async function handleFlowHistory(req: Request): Promise<Response>{
  const auth=await requireAuth(req); if(auth instanceof Response) return auth; const user=(auth as {user:{id:number}}).user;
  await ensureFlowTables();
  const sql=getSql();
  const rows=await sql`SELECT wager,lines,scores,verdict,wpm,created_at FROM magnum_flow_battles WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 20`;
  return Response.json({items:rows});
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

// Один аккаунт — один слот в комнате: два окна одного юзера не должны
// оказаться в одной дуэли и накручивать wins сами себе.
function roomHasUser(room: DuelRoom, userId: string): boolean {
  for (const ws of room.players) {
    if ((ws.data as WSData).id === userId) return true;
  }
  return false;
}

function findOrCreateRoom(userId?: string): DuelRoom {
  for (const r of rooms.values()) {
    if (r.state === "waiting" && r.players.size < 4 && !(userId && roomHasUser(r, userId))) return r;
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
      const duelUid = Number(ws.data.id);
      const duelRated = Number.isFinite(duelUid) && duelUid > 0;
      if (!isSuspect && duelRated) {
        await sql`INSERT INTO magnum_leaderboard (player, score, game, created_at, user_id) VALUES (${name}, ${score}, 'duel', ${now}, ${duelUid})`;
        await sql`INSERT INTO magnum_leaderboard (player, score, game, created_at, user_id) VALUES (${name}, ${score}, 'duel42', ${now}, ${duelUid})`;
        try {
          const uid = duelUid;
          if (Number.isFinite(uid) && uid > 0) {
            const gScore = Math.max(0, Math.min(999999, Math.round(score * 10) || 0));
            const coinsEarned = gScore < 10 ? 0 : Math.min(42, Math.floor(gScore / 200));
            await sql`INSERT INTO magnum_game_scores (user_id, game, score, coins_earned, meta) VALUES (${uid}, 'duel', ${gScore}, ${coinsEarned}, ${JSON.stringify({ src: 'ws-duel', room: room.id, raw: score })}::jsonb)`;
            try { await bumpQuest(uid, "daily_duel3", 1); } catch {}
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
          if (isWin) { try { await addPassXp(uid, 42, 'duelWin'); } catch {} }
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
    if (url.pathname === "/magnum/api/me" && req.method === "GET") return handleMe(req);
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
    if (url.pathname === "/magnum/api/presave/recover-bonus" && req.method === "POST") return handlePresaveRecoverBonus(req);
    if (url.pathname === "/magnum/api/presave/streak-bonus" && req.method === "POST") return handlePresaveStreakBonus(req);
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
    // tour 42
    if (url.pathname === "/magnum/api/tour/progress" && req.method === "GET") return handleTourProgress(req);
    if (url.pathname === "/magnum/api/tour/visit" && req.method === "POST") return handleTourVisit(req);
    if (url.pathname === "/magnum/api/tour/share" && req.method === "POST") return handleTourShare(req);

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

    if (url.pathname === "/magnum/api/gacha/roll" && req.method === "POST") return handleGachaRoll(req);
    if (url.pathname === "/magnum/api/gacha/status" && req.method === "GET") return handleGachaStatus(req);
    if (url.pathname === "/magnum/api/gacha/catalog" && req.method === "GET") return handleGachaCatalog();
    if (url.pathname === "/magnum/api/gacha/banners" && req.method === "GET") return handleGachaBanners();
    if (url.pathname === "/magnum/api/gacha/history" && req.method === "GET") return handleGachaHistory(req);
    if (url.pathname === "/magnum/api/gacha/pity" && req.method === "GET") return handleGachaPity(req);
    if (url.pathname === "/magnum/api/gacha/free-roll" && req.method === "POST") return handleGachaFreeRoll(req);
    if ((url.pathname === "/magnum/api/gacha/quests" || url.pathname === "/magnum/api/gacha/quests/status") && req.method === "GET") return handleGachaQuestsStatus(req);
    if (url.pathname === "/magnum/api/gacha/quests/progress" && req.method === "POST") return handleGachaQuestProgress(req);
    if (url.pathname === "/magnum/api/gacha/quests/claim" && req.method === "POST") return handleGachaQuestClaim(req);
    if ((url.pathname === "/magnum/api/gacha/comeback" || url.pathname === "/magnum/api/gacha/comeback/claim") && req.method === "POST") return handleGachaComebackClaim(req);

    if (url.pathname === "/magnum/api/spin/status" && req.method === "GET") return handleSpinStatus(req);
    if (url.pathname === "/magnum/api/spin" && req.method === "POST") return handleSpin(req);
    if (url.pathname === "/magnum/api/spin" && req.method === "GET") return handleSpinStatus(req);
    if (url.pathname === "/magnum/api/spin/referral" && req.method === "POST") return handleSpinReferral(req);

    // PASS 42
    if (url.pathname === "/magnum/api/pass/progress" && req.method === "GET") return handlePassProgress(req);
    if (url.pathname === "/magnum/api/pass/claim" && req.method === "POST") return handlePassClaim(req);
    if (url.pathname === "/magnum/api/pass/xp/add" && req.method === "POST") return handlePassXpAdd(req);
    if (url.pathname === "/magnum/api/pass/premium" && req.method === "POST") return handlePassPremium(req);
    if (url.pathname === "/magnum/api/pass/buy-levels" && req.method === "POST") return handlePassBuyLevels(req);
    if (url.pathname === "/magnum/api/pass/season" && req.method === "GET") { await ensurePassSeasonRow(); return Response.json({ season: SEASON_ID, rewards: PASS_REWARDS, maxLevel: MAX_LEVEL, xpPerLevel: XP_PER_LEVEL }); }

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
    if ((url.pathname === "/magnum/api/referral/track" || url.pathname === "/magnum/api/referral/track/") && (req.method === "GET" || req.method === "POST")) return handleReferralTrack(req);
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
    if (url.pathname === "/magnum/api/duel42/stats" && req.method === "GET") return handleDuel42Stats(req);
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
    // flashmob 42 — ежедневный челлендж
    if (url.pathname === "/magnum/api/flashmob/today" && req.method === "GET") return handleFlashmobToday(req);
    if (url.pathname === "/magnum/api/flashmob/leaderboard" && req.method === "GET") return handleFlashmobLeaderboard(req);
    if (url.pathname === "/magnum/api/flashmob/submit" && req.method === "POST") return handleFlashmobSubmit(req);
    if (url.pathname === "/magnum/api/flashmob/share" && req.method === "POST") return handleFlashmobShare(req);
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
    // charts 42
    if (url.pathname === "/magnum/api/charts" && req.method === "GET") return handleChartsGet(req);
    if (url.pathname === "/magnum/api/charts/share" && req.method === "POST") return handleChartsShare(req);
    if (url.pathname === "/magnum/api/charts/guess" && req.method === "POST") return handleChartsGuess(req);
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

    if (url.pathname === "/magnum/api/flow/judge" && req.method === "POST") return handleFlowJudge(req);
    if (url.pathname === "/magnum/api/flow/share" && req.method === "POST") return handleFlowShare(req);
    if (url.pathname === "/magnum/api/flow/leaderboard" && req.method === "GET") return handleFlowLeaderboard();
    if (url.pathname === "/magnum/api/flow/history" && req.method === "GET") return handleFlowHistory(req);
    // ЦЕПЬ 42 — цепочка 42ч
    if (url.pathname === "/magnum/api/chain/me" && req.method === "GET") return handleChainMe(req);
    if (url.pathname === "/magnum/api/chain/create" && req.method === "POST") return handleChainCreate(req);
    if (url.pathname === "/magnum/api/chain/join" && req.method === "POST") return handleChainJoin(req);
    if (url.pathname.startsWith("/magnum/api/chain/join/") && req.method === "GET") { const code=url.pathname.replace("/magnum/api/chain/join/","").split("/")[0] ?? ""; return handleChainCode(req, code); }
    if (url.pathname === "/magnum/api/chain/code" && req.method === "GET") { const c=new URL(req.url).searchParams.get("code")||""; return handleChainCode(req, c); }
    if (url.pathname === "/magnum/api/chain/feed" && req.method === "GET") return handleChainFeed();
    if (url.pathname === "/magnum/api/chain/share" && req.method === "POST") return handleChainShare(req);
    if (url.pathname === "/magnum/api/chain/og" && req.method === "GET") return handleChainOg(req);
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
        if(roomHasUser(room, ws.data.id)){
          try{ ws.send(JSON.stringify({ type:"error", error:"duplicate_session", message:"Ты уже в этой комнате в другом окне" })); }catch{}
          try{ ws.close(4009, "duplicate session"); }catch{}
          return;
        }
      } else {
        room = findOrCreateRoom(ws.data.id);
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
        if(target && roomHasUser(target, data.id)){
          try{ ws.send(JSON.stringify({ type:"join_error", error:"duplicate_session", message:"Ты уже в этой комнате в другом окне — дуэль с самим собой не считается" })); }catch{}
          return;
        }
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
