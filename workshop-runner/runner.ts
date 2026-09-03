// Раннер вайбкодинг-агента — загружается и выполняется ВНУТРИ Daytona-песочницы.
// Никогда не выполняется на сервере Magnum.
import { createAgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "fs";

const RUNNER_DIR = "/home/daytona/runner";
const INPUT_PATH = `${RUNNER_DIR}/input.json`;
const APP_DIR = "/home/daytona/app";
const APP_PORT = 3000;

type Input = { prompt: string; apiKey: string; isEdit?: boolean };

function emit(type: string, extra: Record<string, unknown> = {}) {
  console.log("EVT:" + JSON.stringify({ type, at: Date.now(), ...extra }));
}

async function main() {
  if (!existsSync(INPUT_PATH)) {
    emit("runner_error", { message: "no input.json" });
    process.exit(1);
  }
  const input = JSON.parse(readFileSync(INPUT_PATH, "utf8")) as Input;

  const runtime = await ModelRuntime.create({ modelsPath: null, authPath: `${RUNNER_DIR}/auth.json` });
  runtime.registerProvider("opencode-zen", {
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    api: "openai-completions",
    authHeader: true,
    models: [
      {
        id: "mimo-v2.5-free",
        name: "Mimo V2.5 Free",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 8192,
      },
    ],
  });
  await runtime.setRuntimeApiKey("opencode-zen", input.apiKey);
  const model = runtime.getModel("opencode-zen", "mimo-v2.5-free");
  if (!model) {
    emit("runner_error", { message: "model not found" });
    process.exit(1);
  }

  const { session } = await createAgentSession({
    cwd: APP_DIR,
    modelRuntime: runtime,
    model,
    tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
  });

  session.subscribe((event: any) => {
    // Раннер сам не решает, что персистить в БД — просто отдаёт сырые события,
    // сервер Magnum (который поллит этот лог) сам фильтрует шум (см. workshop.ts).
    emit("agent_event", { event });
  });

  const systemInstruction = input.isEdit
    ? "Внеси правку в уже существующее приложение в текущей директории по запросу пользователя ниже. Не переписывай всё с нуля без необходимости. Сохрани package.json со скриптом start как есть, если он уже настроен на порт 3000."
    : [
        "Ты пишешь маленькое статическое веб-приложение (plain HTML/CSS/JS, без шага сборки).",
        "Все файлы клади в текущую директорию (index.html обязателен).",
        `В package.json обязательно добавь "scripts": {"start": "bunx serve -l ${APP_PORT} ."} — именно так,`,
        `чтобы приложение запускалось на порту ${APP_PORT} командой \`bun run start\`.`,
        "Не спрашивай уточнений — сделай разумные предположения и сразу пиши код.",
      ].join(" ");

  try {
    await session.prompt(`${systemInstruction}\n\nЗадача пользователя: ${input.prompt}`);
  } catch (e) {
    emit("runner_error", { message: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  }

  // Запуск самого приложения (bun run start) — намеренно НЕ здесь. Фоновый процесс,
  // запущенный изнутри уже-фонового raннера, ненадёжно переживает process.exit() этого
  // же скрипта (проверено на практике — процесс не доживает до проверки). Поэтому
  // Magnum-сервер сам отдельной командой sandbox.process.executeCommand(...) запускает
  // приложение после того, как увидит "agent_done" в логе (см. workshop.ts).
  emit("agent_done");
  process.exit(0);
}

main().catch((e) => {
  emit("runner_error", { message: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  process.exit(1);
});
