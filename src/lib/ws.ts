// ws.ts — WebSocket helper: ABCD-лобби, heartbeat 25с, реконнект.
// Хот-сита нет: без соединения матча нет, локального счёта не существует.
export type WSMsg =
  | { type: "lobby:create"; wager: number }
  | { type: "join"; code: string }
  | { type: "ready" }
  | { type: "click"; volcano?: number; magma?: number }
  | { type: "tick"; volcano: number; magma?: number }
  | { type: "ping" }
  | { type: "pong" }
  | { type: "chat"; text: string }
  | { type: string; [k: string]: unknown };

export function wsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/magnum/api/ws`;
}

export class DuelSocket {
  ws: WebSocket | null = null;
  onMsg: ((m: unknown) => void) | null = null;
  /** Соединение с сервером потеряно: матч невозможен, UI обязан это показать. */
  onOffline: ((on: boolean) => void) | null = null;
  heartbeat: number | null = null;
  reconnectTries = 0;
  code: string | null = null;
  offline = false;
  constructor(onMsg: (m: unknown) => void, onOffline?: (on: boolean) => void) {
    this.onMsg = onMsg;
    this.onOffline = onOffline ?? null;
  }
  private setOffline(on: boolean) {
    if (this.offline === on) return;
    this.offline = on;
    try { this.onOffline?.(on); } catch { /* слушатель упал — не роняем сокет */ }
  }
  connect(code?: string) {
    if (code) this.code = code;
    try {
      this.ws = new WebSocket(wsUrl());
    } catch {
      this.setOffline(true);
      return;
    }
    this.ws.onopen = () => {
      this.reconnectTries = 0;
      this.setOffline(false);
      if (this.heartbeat) window.clearInterval(this.heartbeat);
      this.heartbeat = window.setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          try { this.ws.send(JSON.stringify({ type: "ping" })); } catch {}
        }
      }, 25000);
      if (this.code) {
        const c = this.code;
        try { this.ws!.send(JSON.stringify({ type: "join", code: c })); } catch {}
      }
    };
    this.ws.onmessage = (e) => {
      if (e.data === "pong" || e.data === '{"type":"pong"}') return;
      try {
        const m = JSON.parse(String(e.data));
        if (m?.type === "ping") { try { this.ws?.send(JSON.stringify({ type: "pong" })); } catch {} return; }
        if (m?.type === "pong") return;
        this.onMsg?.(m);
      } catch { /* ignore */ }
    };
    this.ws.onclose = () => {
      if (this.heartbeat) { window.clearInterval(this.heartbeat); this.heartbeat = null; }
      if (this.reconnectTries < 3) {
        this.reconnectTries++;
        window.setTimeout(() => this.connect(this.code ?? undefined), 800 * this.reconnectTries);
      } else {
        this.setOffline(true);
      }
    };
    this.ws.onerror = () => { this.setOffline(true); };
  }
  send(m: WSMsg) {
    // Без открытого сокета сообщение просто теряется. Эха своих же ходов нет:
    // иначе игрок соревновался бы сам с собой, считая это PvP.
    if (this.ws?.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(m)); } catch {}
    }
  }
  close() {
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }
}

export function genABCD(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += letters[Math.floor(Math.random() * letters.length)]!;
  return s;
}
