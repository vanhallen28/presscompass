import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import styles from './ui.module.css';

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        {back && (
          <Link href={back.href} className={styles.back}>
            <Icon name="arrow-left" size={16} />
            {back.label}
          </Link>
        )}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions}
    </header>
  );
}

const NOTICE_ICON: Record<'success' | 'error' | 'info', IconName> = { success: 'check', error: 'alert', info: 'info' };

/** Success and info notices are polite status messages; errors are alerts. */
export function Notice({ tone = 'info', children }: { tone?: 'success' | 'error' | 'info'; children: ReactNode }) {
  return (
    <div className={`${styles.notice} ${styles[`notice-${tone}`]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={NOTICE_ICON[tone]} size={18} />
      <div className={styles.noticeBody}>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={28} />
      <p className={styles.emptyTitle}>{title}</p>
      {children}
    </div>
  );
}

export { styles as ui };
