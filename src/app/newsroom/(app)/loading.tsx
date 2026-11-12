import styles from './newsroom.module.css';

// Shown at once while a Newsroom page loads its data, so navigation responds immediately.
export default function NewsroomLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.loadingBar} aria-hidden="true" />
      <span className={styles.loadingBar} aria-hidden="true" />
      <span className={styles.loadingBar} aria-hidden="true" />
      <span className={styles.srOnly}>Loading</span>
    </div>
  );
}
