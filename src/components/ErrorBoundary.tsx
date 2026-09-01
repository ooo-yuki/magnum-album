import { Component, createRef, type ErrorInfo, type ReactNode } from "react";
import gsap from "gsap";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  maxRetries?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
  stack: string | null;
  retryCount: number;
}

const gradient = "linear-gradient(135deg, #ff2d55, #ffcc00, #00ff88)";
const MAX_RETRIES_DEFAULT = 3;
const LOG_ENDPOINT = "/magnum/api/log";

/**
 * Global error boundary around routed pages (<Outlet />).
 * Catches render/lifecycle errors so a crashed page never blanks the
 * whole app — shows a 42-style fallback instead.
 *
 * Perf polish:
 * - retryCount with progressive backoff + hard reload after max
 * - GSAP shake on error surface
 * - console.error + fetch(LOG_ENDPOINT) if available
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null, stack: null, retryCount: 0 };

  private cardRef = createRef<HTMLDivElement>();
  private containerRef = createRef<HTMLDivElement>();
  private shakeCtx: gsap.Context | null = null;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, message: error?.message ?? "Unknown error", stack: error?.stack ?? null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const payload = {
      level: "error" as const,
      scope: "ErrorBoundary",
      message: error?.message ?? "Unknown",
      stack: error?.stack ?? null,
      componentStack: info.componentStack ?? null,
      retryCount: this.state.retryCount,
      href: typeof window !== "undefined" ? window.location.href : null,
      ts: new Date().toISOString(),
    };

    // console log — always
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] page crashed:", error, payload);

    // remote log — best-effort, never throw
    try {
      if (typeof fetch !== "undefined") {
        fetch(LOG_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // eslint-disable-next-line no-console
          console.warn("[ErrorBoundary] remote log failed (fetch rejected)");
        });
      }
    } catch {
      // eslint-disable-next-line no-console
      console.warn("[ErrorBoundary] remote log unavailable");
    }
  }

  componentDidUpdate(_prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    if (this.state.hasError && !prevState.hasError) {
      this.shake();
    }
  }

  componentWillUnmount() {
    this.shakeCtx?.revert();
    this.shakeCtx = null;
  }

  private shake() {
    const target = this.cardRef.current;
    if (!target) return;
    // kill previous context to avoid stacking tweens
    this.shakeCtx?.revert();
    this.shakeCtx = gsap.context(() => {
      gsap.killTweensOf(target);
      gsap.fromTo(
        target,
        { x: 0 },
        {
          x: 8,
          duration: 0.06,
          repeat: 7,
          yoyo: true,
          ease: "power1.inOut",
          onComplete: () => gsap.set(target, { x: 0 }),
        },
      );
      // subtle scale pulse on entry
      gsap.fromTo(target, { scale: 0.98, opacity: 0.0 }, { scale: 1, opacity: 1, duration: 0.32, ease: "back.out(1.4)", overwrite: true });
    }, target);
  }

  private handleRetry = () => {
    const max = this.props.maxRetries ?? MAX_RETRIES_DEFAULT;
    const next = this.state.retryCount + 1;

    // eslint-disable-next-line no-console
    console.info(`[ErrorBoundary] retry ${next}/${max}`);

    if (next >= max) {
      // eslint-disable-next-line no-console
      console.warn("[ErrorBoundary] max retries reached — hard reload");
      window.location.reload();
      return;
    }

    this.setState({ hasError: false, message: null, stack: null, retryCount: next });
  };

  private handleReload = () => {
    // eslint-disable-next-line no-console
    console.info("[ErrorBoundary] hard reload requested", { retryCount: this.state.retryCount });
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, message: null, stack: null, retryCount: 0 });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const max = this.props.maxRetries ?? MAX_RETRIES_DEFAULT;
    const remaining = Math.max(0, max - this.state.retryCount);
    const isLastChance = remaining <= 1;

    return (
      <div
        ref={this.containerRef}
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: "62vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
          background: "#0a0a0a",
        }}
      >
        <div
          ref={this.cardRef}
          style={{
            maxWidth: 560,
            width: "100%",
            textAlign: "center",
            padding: "40px 28px",
            borderRadius: 18,
            background: "#141414",
            border: "1px solid rgba(240, 240, 240, 0.12)",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
            willChange: "transform",
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 18 }} aria-hidden>
            🤖💥
          </div>
          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "clamp(26px, 5vw, 36px)",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              background: gradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Ботух, что-то сломалось…
          </h1>
          <p
            style={{
              margin: "0 0 10px",
              color: "rgba(240, 240, 240, 0.58)",
              fontSize: 15,
              lineHeight: 1.55,
            }}
          >
            Страница грохнулась, но братство не бросает своих. Попробуй ещё раз — мы уже логируем ошибку.
          </p>
          <p
            style={{
              margin: "0 0 18px",
              color: this.state.retryCount > 0 ? "rgba(255,204,0,0.85)" : "rgba(240,240,240,0.32)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            Попытка {this.state.retryCount + 1} из {max}
            {remaining > 0 ? ` · осталось ${remaining}` : " · лимит исчерпан"}
          </p>

          {this.state.message ? (
            <details
              style={{
                marginBottom: 24,
                textAlign: "left",
                fontSize: 12,
                color: "rgba(240, 240, 240, 0.34)",
              }}
            >
              <summary style={{ cursor: "pointer", userSelect: "none" }}>Технические детали</summary>
              <pre
                style={{
                  margin: "10px 0 0",
                  padding: 12,
                  borderRadius: 10,
                  background: "#0a0a0a",
                  border: "1px solid rgba(240, 240, 240, 0.08)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {this.state.message}
                {this.state.stack ? `\n\n${this.state.stack.slice(0, 900)}` : ""}
              </pre>
            </details>
          ) : null}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                appearance: "none",
                cursor: "pointer",
                border: "none",
                padding: "14px 28px",
                borderRadius: 999,
                background: isLastChance ? "#222" : gradient,
                color: isLastChance ? "#f0f0f0" : "#0a0a0a",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "0.02em",
                boxShadow: isLastChance ? "none" : "0 10px 30px rgba(255, 45, 85, 0.25)",
                borderWidth: isLastChance ? 1 : 0,
                borderStyle: "solid",
                borderColor: "rgba(240,240,240,0.12)",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
              }}
            >
              {isLastChance ? "↻ Перезагрузить страницу" : `↻ Попробовать снова (${remaining - 1 >= 0 ? remaining : 0})`}
            </button>

            <button
              type="button"
              onClick={this.state.retryCount > 0 ? this.handleReset : this.handleReload}
              style={{
                appearance: "none",
                cursor: "pointer",
                border: "1px solid rgba(240,240,240,0.14)",
                padding: "14px 22px",
                borderRadius: 999,
                background: "transparent",
                color: "rgba(240,240,240,0.82)",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {this.state.retryCount > 0 ? "Сбросить" : "Перезагрузить"}
            </button>
          </div>

          <p style={{ margin: "16px 0 0", fontSize: 11, color: "rgba(240,240,240,0.22)", lineHeight: 1.4 }}>
            Ошибка залогирована в консоль{typeof fetch !== "undefined" ? " и на /magnum/api/log" : ""}. Если повтор не помог — перезагрузи страницу.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
