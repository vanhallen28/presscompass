import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ds/Logo';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { signOut } from '@/modules/auth/actions';
import { requireStaff } from '@/modules/auth/staff';
import styles from './newsroom.module.css';

// Newsroom pages read the session on every request, so they block on the server instead of
// prerendering a static shell (Cache Components).
export const instant = false;

export const metadata: Metadata = { title: { default: 'Newsroom', template: '%s · Newsroom' } };

export default async function NewsroomLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className={styles.shell}>
      <aside className={styles.side} aria-label="Newsroom">
        <div className={styles.brand}>
          <Logo height={24} />
          <p className={styles.brandLabel}>NEWSROOM</p>
        </div>
        <nav className={styles.nav} aria-label="Newsroom sections">
          <a href="/newsroom" aria-current="page">
            <Icon name="grid" />
            Dashboard
          </a>
        </nav>
        <div className={styles.user}>
          <p className={styles.userEmail}>{staff.email}</p>
          <form action={signOut}>
            <Button type="submit" variant="quiet" size="sm" icon="log-out">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
