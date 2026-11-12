'use client';

import { type ComponentProps, useId, useRef } from 'react';
import { Button } from '@/components/ds/Button';
import styles from './ui.module.css';

type ConfirmButtonProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'type'> & {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  /** Called when confirmed. Without it, the confirm button submits the surrounding form. */
  onConfirm?: () => void;
};

/** A button that asks first, in a modal `<dialog>`. Inside a form, confirming submits that form. */
export function ConfirmButton({ title, body, confirmLabel, danger, onConfirm, children, ...button }: ConfirmButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <Button type="button" {...button} onClick={() => dialog.current?.showModal()}>
        {children}
      </Button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`}>
        <h2 id={`${id}-title`} className={styles.dialogTitle}>
          {title}
        </h2>
        <p id={`${id}-body`} className={styles.dialogBody}>
          {body}
        </p>
        <div className={styles.dialogActions}>
          <Button type="button" onClick={() => dialog.current?.close()} autoFocus>
            Cancel
          </Button>
          <Button
            type={onConfirm ? 'button' : 'submit'}
            variant="primary"
            className={danger ? styles.dangerButton : undefined}
            onClick={() => {
              if (onConfirm) {
                dialog.current?.close();
                onConfirm();
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
