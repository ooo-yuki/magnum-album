/**
 * Прокси /magnum/api/ai → Xiaomi MiMo v2.5 (vision).
 * Ключ XIAOMI_API_KEY живёт ТОЛЬКО на сервере, в клиентский бандл не попадает.
 * Поддерживает: text + image (dataURL base64) + история сообщений.
 */

const MIMO_BASE = process.env.MIMO_BASE_URL || "https://token-plan-sgp.xiaomimimo.com/v1";
const MIMO_MODEL = process.env.MIMO_MODEL || "mimo-v2.5";

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

  // ограниченная история (без старых картинок — экономим токены)
  for (const h of body.history ?? []) {
    if ((h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
      messages.push({ role: h.role, content: h.content.slice(0, 1000) });
    }
  }

  // финальное сообщение пользователя: текст + опционально картинка
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

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  development: process.env.NODE_ENV !== "production",
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/magnum/api/ai") return handleAi(req);
    if (url.pathname === "/magnum" || url.pathname.startsWith("/magnum/")) {
      const rel = url.pathname.replace(/^\/magnum\/?/, "");
      const clean = rel.replace(/\/$/, "");
      // статика (assets) существует? → отдаём файл; иначе SPA fallback на index.html
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
