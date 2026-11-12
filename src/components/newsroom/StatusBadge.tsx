import { Icon, type IconName } from '@/components/ds/Icon';
import { type ArticleStatus, STATUS_LABELS } from '@/modules/editor/status';
import styles from './ui.module.css';

// Design system: StatusBadge. Every status carries an icon and a word, never colour alone.
const ICONS: Record<ArticleStatus, IconName> = {
  draft: 'edit',
  review: 'eye',
  scheduled: 'clock',
  published: 'check',
  archived: 'archive',
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return (
    <span className={`${styles.status} ${styles[`st-${status}`]}`}>
      <Icon name={ICONS[status]} size={16} />
      {STATUS_LABELS[status]}
    </span>
  );
}
