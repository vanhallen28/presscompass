import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/ds/Logo';
import { safeNextPath } from '@/modules/auth/paths';
import { getStaff } from '@/modules/auth/staff';
import { LoginForm } from './LoginForm';
import styles from './login.module.css';

// Newsroom pages read the session on every request, so they block on the server instead of
// prerendering a static shell (Cache Components).
export const instant = false;

export const metadata: Metadata = { title: 'Sign in · Newsroom' };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const destination = safeNextPath(next);
  if (await getStaff()) redirect(destination);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Logo height={26} />
          <p className={styles.label}>NEWSROOM</p>
        </div>
        <h1 className={styles.title}>Sign in</h1>
        <LoginForm next={destination} />
      </div>
    </main>
  );
}
