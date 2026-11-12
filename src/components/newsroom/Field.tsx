import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icon } from '@/components/ds/Icon';
import styles from './forms.module.css';

// Labelled form controls for the Newsroom (design system: TextField). The label is always visible,
// hints and errors sit underneath and are linked with aria-describedby.

type Common = { id: string; label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; mono?: boolean };

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
}

function Notes({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </>
  );
}

function Label({ id, label, optional }: { id: string; label: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={id} className={styles.label}>
      {label}
      {optional && <span className={styles.optional}> (optional)</span>}
    </label>
  );
}

export function TextField({ id, label, hint, error, optional, mono, className, ...input }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label id={id} label={label} optional={optional} />
      <input
        id={id}
        className={[styles.input, mono && styles.mono, error && styles.invalid].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
      <Notes id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({ id, label, hint, error, optional, mono, className, ...input }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label id={id} label={label} optional={optional} />
      <textarea
        id={id}
        className={[styles.textarea, mono && styles.mono, error && styles.invalid].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
      <Notes id={id} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
  ...select
}: Omit<Common, 'mono'> & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label id={id} label={label} optional={optional} />
      <select
        id={id}
        className={[styles.select, error && styles.invalid].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...select}
      >
        {children}
      </select>
      <Notes id={id} hint={hint} error={error} />
    </div>
  );
}

export function CheckboxField({ id, label, hint, className, ...input }: Omit<Common, 'error' | 'optional' | 'mono'> & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={[styles.check, className].filter(Boolean).join(' ')}>
      <input id={id} type="checkbox" aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
