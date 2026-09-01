// ws.ts — WebSocket helper with ABCD lobby, heartbeat 25s, reconnect + hot-seat fallback
// no localStorage — token via cookie credentials:include handled server-side

export type WSMsg =
  | { type: "lobby:create"; wager: number }
  | { type: "join"; code: string }
  | { type: "ready" }
  | { type: "click"; magma?: number }
  | { type: "tick"; magma: number }
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
  heartbeat: number | null = null;
  reconnectTries = 0;
  code: string | null = null;
  hotSeat = false;
  constructor(onMsg: (m: unknown) => void) {
    this.onMsg = onMsg;
  }
  connect(code?: string) {
    if (code) this.code = code;
    try {
      this.ws = new WebSocket(wsUrl());
    } catch {
      this.hotSeat = true;
      return;
    }
    this.ws.onopen = () => {
      this.reconnectTries = 0;
      this.hotSeat = false;
      // heartbeat 25s
      if (this.heartbeat) window.clearInterval(this.heartbeat);
      this.heartbeat = window.setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          try { this.ws.send(JSON.stringify({ type: "ping" })); } catch {}
        }
      }, 25000);
      // auto join if code
      if (this.code) {
        const c = this.code;
        try { this.ws!.send(JSON.stringify({ type: "join", code: c })); } catch {}
      }
    };
    this.ws.onmessage = (e) => {
      if (e.data === "pong" || e.data === "{\"type\":\"pong\"}") return;
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
        this.hotSeat = true;
      }
    };
    this.ws.onerror = () => { this.hotSeat = true; };
  }
  send(m: WSMsg) {
    if (this.hotSeat) { this.onMsg?.(m); return; }
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
