import styles from "./MountainSunLoader.module.css";

/** Shared, vector-based loading artwork derived from the Oyama mountain logo. */
export default function MountainSunLoader({
  label = "Loading your workspace…",
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  return (
    <div className={`${styles.loader} ${fullScreen ? styles.fullScreen : ""}`} role="status" aria-live="polite">
      <svg className={styles.artwork} viewBox="0 0 76 76" fill="none" aria-hidden="true">
        <svg width="76" height="57" viewBox="0 0 76 57" overflow="hidden">
          <g className={styles.sun}><circle cx="49" cy="22" r="12" fill="#FFC453" /></g>
        </svg>
        <path d="M30 45 42 26q2-3 4 0l17 24q4 9-7 9H27Z" fill="#007BC4" />
        <path d="m8 47 17-25q2-3 4 0l23 32q3 5-5 5H17Q4 59 8 47Z" fill="#009CE8" />
        <path d="m20 32 7-10 8 12-6-3-3 4-2-4Z" fill="#fff" />
        <path d="m38 33 6-8 7 11-6-3-3 3Z" fill="#E8F7FF" />
        <path d="M11 52q11-5 22 0t26 0" stroke="#63CFFF" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
