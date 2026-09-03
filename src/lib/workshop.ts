// workshop.ts — вайбкодинг-мастерская: оркестрация Daytona-песочниц + pi-агента.
// Пользовательский код никогда не выполняется здесь — только команды на удалённой
// Daytona-песочнице через SDK. server.ts вызывает эти функции и сам пишет в БД/WS.
import { Daytona, type Sandbox } from "@daytona/sdk";

export const WORKSHOP_COST = 199;
// маркетинговая "старая цена" для зачёркнутого ценника — витрина, не влияет на реальный расчёт
export const WORKSHOP_ORIGINAL_PRICE = 999;
export const WORKSHOP_DISCOUNT_PCT = Math.round((1 - WORKSHOP_COST / WORKSHOP_ORIGINAL_PRICE) * 100);
const APP_PORT = 3000;
// server.ts всегда запускается из корня репозитория (WorkingDirectory в systemd unit)
const RUNNER_LOCAL_PATH = `${process.cwd()}/workshop-runner/runner.ts`;

export type WorkshopSkill = { id: string; name: string; desc: string; price: number; icon: string; instruction: string };

// "Магазин скиллов" для агента — постоянные, один раз купленные усиления, применяются
// ко всем последующим генерациям владельца (и созданию, и правкам) как доп. инструкции.
export const WORKSHOP_SKILLS: WorkshopSkill[] = [
  {
    id: "design-pro",
    name: "Дизайнер-профи",
    desc: "Акцент на визуал: градиенты, тени, плавные анимации",
    price: 150,
    icon: "🎨",
    instruction: "Уделяй особое внимание визуальному дизайну: используй градиенты, мягкие тени, плавные CSS-анимации и аккуратную типографику — приложение должно выглядеть как премиальный продукт, а не как учебный пример.",
  },
  {
    id: "turbo",
    name: "Турбо-скорость",
    desc: "Меньше раздумий — сразу финальный код",
    price: 120,
    icon: "⚡",
    instruction: "Не трать шаги на промежуточные черновики — сразу пиши финальный, готовый к использованию код за минимум итераций.",
  },
  {
    id: "brainy",
    name: "Расширенный интеллект",
    desc: "Сложная логика и несколько файлов при необходимости",
    price: 200,
    icon: "🧠",
    instruction: "Не ограничивай себя одним файлом — разбивай логику на несколько файлов и используй более сложные структуры данных, если задача того требует.",
  },
  {
    id: "qa",
    name: "Самопроверка",
    desc: "Агент перечитывает код перед завершением",
    price: 180,
    icon: "🐛",
    instruction: "Перед тем как закончить, перечитай написанный код целиком и проверь его на очевидные баги, опечатки и незакрытые теги/скобки.",
  },
  {
    id: "grill-me",
    name: "Grill me",
    desc: "Агент встраивает шуточный хайп-прогрев с просьбами монет",
    price: 250,
    icon: "🔥",
    instruction: [
      "Дополнительно встрой в приложение шуточную ироничную 'прогревающую' механику в духе агрессивного",
      "хайп-маркетинга (в стиле мема про 'ЦАРЬ ХАЙПА', 'BOSS 42', 'МЫ УЖЕ ПОБЕДИЛИ'): периодические",
      "модалки/баннеры, которые с пафосом требуют 'заплатить монеты' за продолжение или премиум-фичу,",
      "драматичные надписи, поддельный таймер срочности, шкала 'лояльности' до максимума.",
      "ВАЖНО: это чистая комедия и НИКАКОЙ реальной механики монет/платежей/сети тут быть не должно —",
      "кнопка 'заплатить' не должна ничего никуда отправлять, а просто с юмором отвечать (например",
      "'ха, приятно было попробовать — но монеты у тебя все на месте') и закрывать баннер. Не пытайся",
      "обращаться к каким-либо внешним API, платёжным системам или домену Magnum — это отдельная",
      "изолированная песочница без доступа к настоящему балансу пользователя.",
    ].join(" "),
  },
];

// Максималистичный мем-стиль в духе бренда MAGNUM/Tornado: тёмный фон, неоновое золото и
// красно-оранжевое свечение, гигантские жирные цифры "42", "электрические" эффекты через CSS-тени/градиенты,
// игровая эстетика "боссфайта" (значки, короны, кубки, прогресс-бары "MAX"), дерзкие хайп-надписи.
export const ULTRA_MODE_INSTRUCTION = [
  "РЕЖИМ ULTRA: сделай визуальный стиль максимально дерзким и гипертрофированным, в духе агрессивного",
  "мем-флекса и энергетиков — НЕ минимализм. Тёмный/чёрный фон; неоновое золото (#ffcc00/#ffd700) и",
  "красно-оранжевое свечение (#ff2d55/#ff8a00) как основные акценты; текстовые и box-тени с сильным",
  "glow-эффектом, имитирующие молнии/электричество; крупная жирная типографика, местами с наклоном",
  "и обводкой. Где уместно — вплетай число «42» как повторяющийся визуальный мотив (счётчики, бейджи,",
  "фон). Используй игровую 'боссфайт'-эстетику: значки уровня/достижений, корону/трофей-иконки (эмодзи",
  "ок), прогресс-бары с подписью 'MAX', дерзкие хайповые надписи на русском в духе 'МЫ УЖЕ ПОБЕДИЛИ',",
  "'ЛЕГЕНДА', 'БОСС УРОВНЯ'. Никакого сдержанного корпоративного минимализма — только шумный, яркий,",
  "гипер-энергичный максимализм с анимациями (пульс, мерцание, лёгкое дрожание неона).",
].join(" ");

let _daytona: Daytona | null = null;
export function getDaytona(): Daytona {
  if (!_daytona) {
    const apiKey = process.env.DAYTONA_API_KEY;
    if (!apiKey) throw new Error("DAYTONA_API_KEY not configured");
    _daytona = new Daytona({ apiKey });
  }
  return _daytona;
}

function requireZenKey(): string {
  const apiKey = process.env.OPENCODE_ZEN_API_KEY;
  if (!apiKey) throw new Error("OPENCODE_ZEN_API_KEY not configured");
  return apiKey;
}

export async function createProjectSandbox(): Promise<string> {
  const daytona = getDaytona();
  const sandbox = await daytona.create({ language: "typescript", public: true });
  return sandbox.id;
}

async function getStartedSandbox(sandboxId: string): Promise<Sandbox> {
  const daytona = getDaytona();
  const sandbox = await daytona.get(sandboxId);
  if (sandbox.state !== "started") {
    await sandbox.start();
  }
  return sandbox;
}

/** Будит остывшую песочницу (для показа готового проекта / перед правкой). No-op если уже жива. */
export async function resumeSandbox(sandboxId: string): Promise<void> {
  await getStartedSandbox(sandboxId);
}

/**
 * Заливает раннер (первый раз) + промпт правки и запускает генерацию в фоне внутри
 * песочницы. Не ждёт завершения — прогресс вычитывается отдельно через tailNewLogLines.
 */
export async function deployAndStartRun(sandboxId: string, prompt: string, isEdit: boolean, extraInstructions: string[] = []): Promise<void> {
  const sandbox = await getStartedSandbox(sandboxId);
  const input = JSON.stringify({ prompt, apiKey: requireZenKey(), isEdit, extraInstructions });

  await sandbox.process.executeCommand("mkdir -p /home/daytona/app /home/daytona/runner");
  await sandbox.fs.uploadFile(Buffer.from(input), "/home/daytona/runner/input.json");
  if (!isEdit) {
    // раннер и его зависимости грузим только на старте нового проекта — для правок уже на месте
    await sandbox.fs.uploadFile(RUNNER_LOCAL_PATH, "/home/daytona/runner/runner.ts");
    await sandbox.process.executeCommand(
      "cd /home/daytona/runner && (bun init -y >/dev/null 2>&1 || true) && bun add @earendil-works/pi-coding-agent >/dev/null 2>&1",
    );
  }
  await sandbox.process.executeCommand(
    "rm -f /home/daytona/workshop.log && cd /home/daytona/runner && nohup bun run runner.ts > /home/daytona/workshop.log 2>&1 & echo started",
  );
}

/** Читает новые байты лога с прошлого известного смещения — возвращает только полные "EVT:"-строки. */
export async function tailNewLogLines(
  sandboxId: string,
  fromByteOffset: number,
): Promise<{ lines: string[]; newOffset: number }> {
  const daytona = getDaytona();
  const sandbox = await daytona.get(sandboxId);
  const r = await sandbox.process.executeCommand(
    `tail -c +${fromByteOffset + 1} /home/daytona/workshop.log 2>/dev/null || true`,
  );
  const text = r.result ?? "";
  if (!text) return { lines: [], newOffset: fromByteOffset };
  const lastNewline = text.lastIndexOf("\n");
  // режем по последнему \n, чтобы не ловить недописанную строку в момент чтения
  const complete = lastNewline === -1 ? "" : text.slice(0, lastNewline);
  const consumedBytes = lastNewline === -1 ? 0 : Buffer.byteLength(text.slice(0, lastNewline + 1), "utf8");
  const lines = complete
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("EVT:"));
  return { lines, newOffset: fromByteOffset + consumedBytes };
}

/** Запускает (или перезапускает) сгенерированное приложение и возвращает публичную preview-ссылку. */
export async function startApp(sandboxId: string): Promise<{ ok: true; previewUrl: string } | { ok: false; error: string }> {
  const daytona = getDaytona();
  const sandbox = await daytona.get(sandboxId);
  const r = await sandbox.process.executeCommand(
    `pkill -f "serve -l ${APP_PORT}" 2>/dev/null; cd /home/daytona/app && nohup bun run start > /home/daytona/app.log 2>&1 & ` +
      `sleep 2.5 && curl -s -o /dev/null -w '%{http_code}' http://localhost:${APP_PORT}/`,
  );
  const code = (r.result ?? "").trim().slice(-3);
  if (code.startsWith("2") || code.startsWith("3")) {
    const link = await sandbox.getPreviewLink(APP_PORT);
    return { ok: true, previewUrl: link.url };
  }
  const log = await sandbox.process.executeCommand("tail -c 500 /home/daytona/app.log 2>/dev/null || true");
  return { ok: false, error: `приложение не отвечает (HTTP ${code || "?"}). ${(log.result ?? "").slice(0, 300)}` };
}

export type WorkshopLogEvent = { type: "status" | "tool" | "message" | "error"; text: string; meta?: Record<string, unknown> };

/**
 * Сжимает одну сырую "EVT:{...}"-строку раннера в компактное событие для БД/WS —
 * токен-дельты (message_update) намеренно отбрасываются, персистим только
 * начало/итог тула, финальный текст ответа и ошибки. Возвращает null, если строка
 * не несёт ничего показательного (например промежуточная thinking/text-дельта).
 */
export function summarizeRunnerLine(raw: string): WorkshopLogEvent | null {
  let outer: any;
  try {
    outer = JSON.parse(raw.slice(4));
  } catch {
    return null;
  }

  if (outer.type === "runner_error") {
    return { type: "error", text: String(outer.message ?? "неизвестная ошибка раннера") };
  }
  if (outer.type === "agent_done") {
    return { type: "status", text: "Агент закончил работу над кодом" };
  }
  if (outer.type !== "agent_event") return null;

  const event = outer.event ?? {};
  switch (event.type) {
    case "agent_start":
      return { type: "status", text: "Агент начал работу" };
    case "turn_end": {
      const results: any[] = Array.isArray(event.toolResults) ? event.toolResults : [];
      const first = results[0];
      if (!first) return null;
      const text = first.content?.[0]?.text ?? `${first.toolName ?? "инструмент"}: готово`;
      return {
        type: "tool",
        text: results.length > 1 ? `${first.toolName}: ${text} (+ещё ${results.length - 1})` : `${first.toolName}: ${text}`,
        meta: { isError: Boolean(first.isError), count: results.length },
      };
    }
    case "agent_end": {
      const msgs: any[] = Array.isArray(event.messages) ? event.messages : [];
      const last = msgs[msgs.length - 1];
      if (last?.stopReason === "error") {
        return { type: "error", text: String(last.errorMessage ?? "провайдер вернул ошибку") };
      }
      const textBlock = last?.content?.find((c: any) => c.type === "text");
      if (textBlock?.text) return { type: "message", text: String(textBlock.text) };
      return null;
    }
    default:
      return null;
  }
}
