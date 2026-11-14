'use client';

import { useActionState, useId } from 'react';
import { saveSeoSettings, type SeoSettingsState } from '@/modules/seo/actions';
import type { SeoSettings } from '@/modules/seo/settings';
import styles from '../ads/ads.module.css';
import { CheckboxField, TextArea, TextField } from '../Field';
import { SubmitButton } from '../SubmitButton';
import { Notice } from '../ui';

/** Site-wide SEO: indexing, titles, the description, Google News, the organisation and robots.txt. */
export function SeoSettingsForm({ initial, production }: { initial: SeoSettings; production: boolean }) {
  const [state, action] = useActionState<SeoSettingsState, FormData>(saveSeoSettings, { errors: {} });
  const uid = useId();
  const values = { ...initial, ...state.values };
  const errors = state.errors;

  return (
    <form action={action} className={styles.page} noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}

      <fieldset className={styles.card}>
        <legend>Search engines</legend>
        <div className={styles.warning} role="note">
          <p>
            <b>Turn this on when the site is ready for readers.</b> Until then every page tells search engines not to index it, and Google keeps the
            site out of its results.
          </p>
          {!production && (
            <p>This copy of the site is not the live one (Vercel Preview or your computer): it always stays hidden, whatever this says.</p>
          )}
        </div>
        <CheckboxField
          id={`${uid}-indexing`}
          name="indexing"
          label="Let search engines index the site"
          defaultChecked={values.indexing}
          hint="Turns off noindex on every public page. The sitemaps, the news sitemap and robots.txt work either way."
        />
      </fieldset>

      <fieldset className={styles.card}>
        <legend>Titles and description</legend>
        <TextField id={`${uid}-siteName`} name="siteName" label="Site name" defaultValue={values.siteName} error={errors.siteName} maxLength={60} />
        <TextField
          id={`${uid}-titleTemplate`}
          name="titleTemplate"
          label="Title pattern"
          defaultValue={values.titleTemplate}
          error={errors.titleTemplate}
          hint="%s is replaced by the page's own title, for example %s · PressCompass. Google shows about 60 characters."
          maxLength={80}
        />
        <TextField
          id={`${uid}-homeTitle`}
          name="homeTitle"
          label="Front page title"
          defaultValue={values.homeTitle}
          error={errors.homeTitle}
          maxLength={120}
        />
        <TextArea
          id={`${uid}-description`}
          name="description"
          label="Site description"
          rows={3}
          defaultValue={values.description}
          error={errors.description}
          hint="For the front page and for any page without its own description. 120 to 160 characters fills Google's snippet."
          maxLength={320}
        />
      </fieldset>

      <fieldset className={styles.card}>
        <legend>Google News and the publisher</legend>
        <TextField
          id={`${uid}-newsName`}
          name="newsName"
          label="Publication name"
          defaultValue={values.newsName}
          error={errors.newsName}
          hint="Used in the Google News sitemap. It must match the name Google News shows for the site."
          maxLength={100}
        />
        <TextArea
          id={`${uid}-sameAs`}
          name="sameAs"
          label="Profiles elsewhere"
          optional
          mono
          rows={3}
          defaultValue={values.sameAs.join('\n')}
          error={errors.sameAs}
          hint="Full addresses of the publication's own accounts (X, Facebook, Instagram, LinkedIn, Wikipedia), one per line. Search engines use them to recognise the publisher."
        />
        <TextField
          id={`${uid}-publishingPrinciples`}
          name="publishingPrinciples"
          label="Editorial standards page"
          optional
          mono
          defaultValue={values.publishingPrinciples}
          error={errors.publishingPrinciples}
          hint="For example /editorial-standards once that page exists in Pages."
        />
        <TextField
          id={`${uid}-correctionsPolicy`}
          name="correctionsPolicy"
          label="Corrections policy page"
          optional
          mono
          defaultValue={values.correctionsPolicy}
          error={errors.correctionsPolicy}
          hint="For example /corrections."
        />
      </fieldset>

      <fieldset className={styles.card}>
        <legend>robots.txt</legend>
        <p className={styles.intro}>
          Built in: crawl everything except /newsroom, /api/ and /search, plus links to the sitemap index and the news sitemap. Add rules here only
          when you need them.
        </p>
        <TextArea
          id={`${uid}-robots`}
          name="robots"
          label="Extra rules"
          optional
          mono
          rows={4}
          defaultValue={values.robots}
          error={errors.robots}
          placeholder={'User-agent: GPTBot\nDisallow: /'}
          hint="User-agent, Allow, Disallow, Crawl-delay or Sitemap lines."
        />
      </fieldset>

      <div>
        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}
