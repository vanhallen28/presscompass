import { Logo } from '@/components/ds/Logo';
import styles from './page.module.css';

// Holding page until the public site arrives in Plan 4 (its text then comes from the Newsroom).
export default function HomePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.logo}>
        <Logo height={40} />
      </h1>
      <p className={`type-standfirst ${styles.tagline}`}>News with a sense of direction.</p>
      <p className={`type-data ${styles.note}`}>Independent, English-language news about Indonesia. Launching soon.</p>
    </main>
  );
}
