'use client';

import { useActionState, useId, useState } from 'react';
import { ButtonLink } from '@/components/ds/Button';
import { slugify } from '@/lib/slug';
import type { FormState } from '@/modules/taxonomy/actions';
import { AUTHOR_LINK_ROWS, type AuthorLink } from '@/modules/taxonomy/validate';
import { CheckboxField, TextArea, TextField } from './Field';
import styles from './forms.module.css';
import { SubmitButton } from './SubmitButton';
import { Notice } from './ui';

type Kind = 'section' | 'tag' | 'author';

export type TaxonomyValues = {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  inNav?: boolean;
  role?: string;
  bio?: string;
  links?: AuthorLink[];
};

const PREFIX: Record<Kind, string> = { section: '/', tag: '/tag/', author: '/author/' };

/** Create or edit form for a section, tag or author. The address follows the name until it is edited. */
export function TaxonomyForm({
  kind,
  action,
  initial,
  cancelHref,
}: {
  kind: Kind;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial: TaxonomyValues;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, { errors: {} });
  // Ids must be unique per mount: Next keeps recently visited pages in the DOM (hidden) for instant back navigation.
  const uid = useId();
  const editing = Boolean(initial.id);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(editing);
  const values = { ...initial, ...(state.values as Partial<TaxonomyValues> | undefined) };
  const errors = state.errors;
  const links = [...(values.links ?? [])];
  while (links.length < AUTHOR_LINK_ROWS) links.push({ label: '', url: '' });

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <TextField
        id={`${uid}-name`}
        name="name"
        label="Name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (!slugTouched) setSlug(slugify(event.target.value));
        }}
        error={errors.name}
        required
        maxLength={kind === 'author' ? 80 : 60}
      />
      <TextField
        id={`${uid}-slug`}
        name="slug"
        label="Address"
        mono
        value={slug}
        onChange={(event) => {
          setSlug(event.target.value);
          setSlugTouched(true);
        }}
        onBlur={() => setSlug((current) => slugify(current) || current)}
        error={errors.slug}
        hint={
          editing
            ? `presscompass.site${PREFIX[kind]}${slug || '…'} · Changing it adds a redirect from the old address once readers can see it.`
            : `presscompass.site${PREFIX[kind]}${slug || '…'} · Fills in from the name.`
        }
      />
      {kind === 'author' && (
        <TextField id={`${uid}-role`} name="role" label="Role" optional defaultValue={values.role} error={errors.role} placeholder="Business correspondent" maxLength={80} />
      )}
      {kind === 'author' ? (
        <TextArea id={`${uid}-bio`} name="bio" label="Biography" optional rows={5} defaultValue={values.bio} error={errors.bio} maxLength={1000} />
      ) : (
        <TextArea
          id={`${uid}-description`}
          name="description"
          label="Description"
          optional
          rows={3}
          defaultValue={values.description}
          error={errors.description}
          maxLength={300}
          hint={kind === 'section' ? 'Shown on the section page and in search results.' : 'Shown on the tag page.'}
        />
      )}
      {kind === 'section' && (
        <CheckboxField id={`${uid}-in-nav`} name="in_nav" label="Show in the main navigation" defaultChecked={values.inNav ?? true} />
      )}
      {kind === 'author' && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>
            Profile links <span className={styles.optional}>(optional)</span>
          </legend>
          {errors.links && <Notice tone="error">{errors.links}</Notice>}
          {links.map((link, index) => (
            <div className={styles.row} key={index}>
              <TextField id={`${uid}-link-label-${index}`} name={`link_label_${index}`} label={`Link ${index + 1} label`} defaultValue={link.label} placeholder={index === 0 ? 'Website' : undefined} maxLength={40} />
              <TextField id={`${uid}-link-url-${index}`} name={`link_url_${index}`} label={`Link ${index + 1} address`} type="url" defaultValue={link.url} placeholder="https://" mono />
            </div>
          ))}
        </fieldset>
      )}
      <div className={styles.actions}>
        <SubmitButton pendingLabel="Saving…">{editing ? 'Save changes' : `Create ${kind}`}</SubmitButton>
        <ButtonLink href={cancelHref} variant="quiet">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
