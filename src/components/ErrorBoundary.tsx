import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

const gradient = "linear-gradient(135deg, #ff2d55, #ffcc00, #00ff88)";

/**
 * Global error boundary around routed pages (<Outlet />).
 * Catches render/lifecycle errors so a crashed page never blanks the
 * whole app — shows a 42-style fallback instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message ?? null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] page crashed:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
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
          style={{
            maxWidth: 520,
            width: "100%",
            textAlign: "center",
            padding: "40px 28px",
            borderRadius: 18,
            background: "#141414",
            border: "1px solid rgba(240, 240, 240, 0.12)",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
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
              margin: "0 0 24px",
              color: "rgba(240, 240, 240, 0.58)",
              fontSize: 15,
              lineHeight: 1.55,
            }}
          >
            Страница грохнулась, но братство не бросает своих. Перезагрузи —
            всё заведём обратно.
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
              <summary style={{ cursor: "pointer", userSelect: "none" }}>
                Технические детали
              </summary>
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
              </pre>
            </details>
          ) : null}
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              appearance: "none",
              cursor: "pointer",
              border: "none",
              padding: "14px 32px",
              borderRadius: 999,
              background: gradient,
              color: "#0a0a0a",
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.02em",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              boxShadow: "0 10px 30px rgba(255, 45, 85, 0.25)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "";
            }}
          >
            ↻ Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
