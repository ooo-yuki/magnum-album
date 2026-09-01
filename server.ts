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

async function handleCoinsAdd(req: Request): Promise<Response> {
  const token = extractToken(req);
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { amount?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) return Response.json({ error: "amount must be integer" }, { status: 400 });
  if (amount === 0) return Response.json({ error: "amount cannot be 0" }, { status: 400 });

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

async function handleIdeasVote(req: Request, idStr: string): Promise<Response> {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "invalid id" }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`UPDATE magnum_ideas SET votes = COALESCE(votes,0) + 1 WHERE id = ${id} RETURNING *`;
    if (rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ idea: rows[0] });
  } catch (e) {
    console.error("[ideas vote] failed", e);
    return Response.json({ error: "db error" }, { status: 500 });
  }
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
  if (!skinId) return Response.json({ error: "skinId required" }, { status: 400 });
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
    return Response.json({ inventory, items: inventory });
  } catch (e) {
    console.error("[shop inventory] failed", e);
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
    if (url.pathname === "/magnum/api/coins" && req.method === "GET") return handleCoinsGet(req);
    if (url.pathname === "/magnum/api/coins/add" && req.method === "POST") return handleCoinsAdd(req);
    if (url.pathname === "/magnum/api/presave/click" && req.method === "POST") {
      try {
        const sql = neon(process.env.DATABASE_URL!);
        const user = await getUserByToken(req).catch(() => null);
        const body = await req.json().catch(() => ({} as any));
        await sql`INSERT INTO magnum_presave_clicks (user_id, url, created_at) VALUES (${user?.id ?? null}, ${String((body as any).url || "/magnum")}, now())`;
      } catch {}
      return Response.json({ ok: true });
    }

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
    if (url.pathname === "/magnum/api/shop/inventory" && req.method === "GET") return handleShopInventory(req);
    if (url.pathname === "/magnum/api/shop/catalog" && req.method === "GET") return handleCosmeticCatalog();
    if (url.pathname === "/magnum/api/shop/cosmetic/buy" && req.method === "POST") return handleCosmeticBuy(req);
    if (url.pathname === "/magnum/api/shop/cosmetic/equip" && req.method === "POST") return handleCosmeticEquip(req);
    if (url.pathname === "/magnum/api/shop/cosmetic/inventory" && req.method === "GET") return handleCosmeticInventory(req);

    // mining
    if (url.pathname === "/magnum/api/mining" && req.method === "GET") return handleMiningGet(req);
    if (url.pathname === "/magnum/api/mining/click" && req.method === "POST") return handleMiningClick(req);
    if (url.pathname === "/magnum/api/mining/upgrade" && req.method === "POST") return handleMiningUpgrade(req);

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
