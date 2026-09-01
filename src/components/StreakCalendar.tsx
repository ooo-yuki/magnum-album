// MAGNUM • StreakCalendar 42 — cross для EcoPage + ArenaPage • 7дн bio-вахта / volcano
import styles from "./StreakCalendar.module.css";

export function StreakCalendar({ streak, weekId, variant = "eco" }: { streak: number; weekId: string; variant?: "eco" | "volcano" }) {
  const label = variant === "volcano" ? "VOLCANO 7дн" : "bio-вахта 7дн";
  return (
    <div className={styles.wrap} data-testid="streak-calendar" data-variant={variant}>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={`${styles.dot} ${i < streak ? styles.dotOn : ""}`}>{i < streak ? "✓" : i + 1}</span>
      ))}
      <span className={styles.weekLabel}>{weekId} • стрик {streak}/7 • {label}</span>
    </div>
  );
}
