'use client';

import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { formatWib } from '@/lib/time';
import { type BulkState, bulkArticles } from '@/modules/editor/actions';
import type { ArticleListRow } from '@/modules/editor/queries';
import { CONFIRMATIONS } from '@/modules/editor/status';
import { RATING_LABELS, ratingFor } from '@/modules/seo/types';
import styles from './ArticleTable.module.css';
import { ConfirmButton } from './ConfirmButton';
import { StatusBadge } from './StatusBadge';
import { Notice, ui } from './ui';

const ACTIONS = [
  ['publish', 'Publish'],
  ['unpublish', 'Unpublish'],
  ['archive', 'Archive'],
  ['delete', 'Delete'],
] as const;

/** The article list with checkboxes for actions on several articles at once. */
export function ArticleTable({ rows }: { rows: ArticleListRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<BulkState, FormData>(async (previous, form) => {
    const result = await bulkArticles(previous, form);
    setSelected([]);
    return result;
  }, {});
  const [action, setAction] = useState('');
  const uid = useId();
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const visibleSelected = selected.filter((id) => rows.some((row) => row.id === id));

  const confirmText =
    action === 'delete'
      ? 'Published articles are skipped. This cannot be undone.'
      : action === 'unpublish'
        ? CONFIRMATIONS.unpublish?.body
        : action === 'archive'
          ? CONFIRMATIONS.archive?.body
          : undefined;

  return (
    <form action={formAction}>
      {state.message && (
        <Notice tone={state.tone ?? 'info'}>
          <span>{state.message}</span>
          {state.problems && state.problems.length > 0 && (
            <ul>
              {state.problems.map((problem, index) => (
                <li key={index}>
                  <b>{problem.title}</b>: {problem.reasons.join(' ')}
                </li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <div className={styles.bulk} role="group" aria-label="Actions for selected articles">
        <label htmlFor={`${uid}-action`} className={ui.srOnly}>
          Action for selected articles
        </label>
        <select id={`${uid}-action`} name="action" className={styles.select} value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="">With selected…</option>
          {ACTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {confirmText ? (
          <ConfirmButton
            size="sm"
            disabled={pending || visibleSelected.length === 0}
            title={`${ACTIONS.find(([value]) => value === action)?.[1]} ${visibleSelected.length === 1 ? '1 article' : `${visibleSelected.length} articles`}?`}
            body={confirmText}
            confirmLabel={ACTIONS.find(([value]) => value === action)?.[1] ?? 'Apply'}
            danger={action === 'delete'}
          >
            {pending ? 'Working…' : 'Apply'}
          </ConfirmButton>
        ) : (
          <Button type="submit" size="sm" disabled={pending || !action || visibleSelected.length === 0}>
            {pending ? 'Working…' : 'Apply'}
          </Button>
        )}
        <span className={styles.count} aria-live="polite">
          {visibleSelected.length ? `${visibleSelected.length} selected` : ''}
        </span>
      </div>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.check}>
                <input
                  type="checkbox"
                  aria-label="Select all articles on this page"
                  checked={allSelected}
                  onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])}
                />
              </th>
              <th scope="col">Title</th>
              <th scope="col">Section</th>
              <th scope="col">Author</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">SEO</th>
              <th scope="col" className={ui.num}>
                Words
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const title = row.title || 'Untitled';
              return (
                <tr key={row.id}>
                  <td className={styles.check}>
                    <input
                      type="checkbox"
                      name="ids"
                      value={row.id}
                      aria-label={`Select ${title}`}
                      checked={selected.includes(row.id)}
                      onChange={(event) =>
                        setSelected((current) => (event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))
                      }
                    />
                  </td>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/articles/${row.id}`} className={row.title ? undefined : ui.untitled}>
                      {title}
                    </Link>
                    <span className={ui.slug}>
                      /{row.section ? `${row.section.slug}/` : ''}
                      {row.slug}
                    </span>
                  </td>
                  <td>{row.section?.name ?? '—'}</td>
                  <td>{row.authors.length ? row.authors.join(', ') : '—'}</td>
                  <td>
                    <StatusBadge status={row.status} />
                    {row.status === 'scheduled' && row.scheduled_at && <span className={ui.slug}>{formatWib(row.scheduled_at, 'short')}</span>}
                  </td>
                  <td className={ui.mono}>{formatWib(row.updated_at, 'short')}</td>
                  <td>
                    {row.scores ? (
                      <span className={styles.scores}>
                        <span
                          className={styles.score}
                          data-rating={ratingFor(row.scores.seo)}
                          title={`SEO: ${RATING_LABELS[ratingFor(row.scores.seo)]}`}
                        >
                          {row.scores.seo}
                        </span>
                        <span
                          className={styles.score}
                          data-rating={ratingFor(row.scores.readability)}
                          title={`Readability: ${RATING_LABELS[ratingFor(row.scores.readability)]}`}
                        >
                          {row.scores.readability}
                        </span>
                        <span className={ui.srOnly}>
                          SEO {row.scores.seo}, readability {row.scores.readability}
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={ui.num}>{row.word_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
