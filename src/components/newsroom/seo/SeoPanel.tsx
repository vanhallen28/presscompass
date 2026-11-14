'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ds/Button';
import { CloudImage } from '@/components/media/CloudImage';
import { CheckboxField, TextArea, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import { Panel } from '@/components/newsroom/Panel';
import type { MediaItem } from '@/modules/media/types';
import type { Analysis } from '@/modules/seo/analysis';
import type { SeoLookup } from '@/modules/seo/actions';
import { type ArticleSeo, relatedToText, SEO_MAX, textToRelated } from '@/modules/seo/article';
import { type Device, fitWidth, SERP, textWidth } from '@/modules/seo/snippet';
import { type Assessment, type Check, RATING_LABELS, type Rating } from '@/modules/seo/types';
import styles from './seo.module.css';

// The SEO tab of the article editor, after Yoast: keyphrase, Google preview, SEO title and meta description,
// the SEO and readability checks, the social card, links to add, and the advanced settings.

export type SeoPanelProps = {
  uid: string;
  analysis: Analysis;
  seo: ArticleSeo;
  onChange: (seo: ArticleSeo) => void;
  headline: string;
  standfirst: string;
  kicker: string;
  slug: string;
  section: { name: string; slug: string } | null;
  publishedAt: string | null;
  origin: string;
  siteName: string;
  indexing: boolean;
  lead: MediaItem | undefined;
  social: MediaItem | undefined;
  onPickSocial: () => void;
  lookup: SeoLookup | null;
  readOnly: boolean;
  errors: Record<string, string | undefined>;
};

const SEO_FIELDS = new Set(['seoTitle', 'seoDescription', 'keyphrase', 'canonical']);
export const isSeoField = (field: string) => SEO_FIELDS.has(field);

export function ScoreBadge({ label, assessment, onClick }: { label: string; assessment: Assessment; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.badge} ${styles.lit}`}
      data-rating={assessment.rating}
      onClick={onClick}
      aria-label={`${label} ${assessment.score} out of 100, ${RATING_LABELS[assessment.rating]}. Open the SEO tab.`}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span>{label}</span> <span className={styles.badgeScore}>{assessment.score}</span>
    </button>
  );
}

export function SeoPanel(props: SeoPanelProps) {
  const { uid, analysis, seo, onChange, readOnly, errors } = props;
  const id = (name: string) => `${uid}-seo-${name}`;
  const set = (patch: Partial<ArticleSeo>) => onChange({ ...seo, ...patch });
  const [relatedText, setRelatedText] = useState(relatedToText(seo.related));

  return (
    <div className={styles.stack}>
      {!props.indexing && (
        <p className={styles.siteNote}>
          The whole site is hidden from search engines until you turn on indexing in <Link href="/newsroom/seo">SEO settings</Link>. The checks still
          apply.
        </p>
      )}

      <section className={styles.scores} aria-label="Scores">
        <Score label="SEO" assessment={analysis.seo} />
        <Score label="Readability" assessment={analysis.readability} />
      </section>

      <Panel title="Focus keyphrase" titleId={id('keyphrase-title')} forceOpen={Boolean(errors.keyphrase)}>
        <TextField
          id={id('keyphrase')}
          label="Focus keyphrase"
          value={seo.keyphrase}
          disabled={readOnly}
          maxLength={SEO_MAX.keyphrase}
          error={errors.keyphrase}
          hint="The words readers would type into Google to find this article, for example rice prices."
          onChange={(event) => set({ keyphrase: event.target.value })}
        />
        <TextField
          id={id('related')}
          label="Related keyphrases"
          optional
          value={relatedText}
          disabled={readOnly}
          hint="Up to four, separated by commas: other ways readers search for the topic."
          onChange={(event) => {
            setRelatedText(event.target.value);
            set({ related: textToRelated(event.target.value).slice(0, SEO_MAX.related) });
          }}
        />
        {props.lookup && props.lookup.keyphrase.length > 0 && (
          <div className={styles.warning} role="note">
            <p>Also used as the keyphrase of:</p>
            <ul>
              {props.lookup.keyphrase.map((item) => (
                <li key={item.id}>
                  <Link href={`/newsroom/articles/${item.id}`} target="_blank">
                    {item.title || 'Untitled'}
                  </Link>{' '}
                  <small>({item.status})</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel title="Search appearance" titleId={id('serp-title')} forceOpen={Boolean(errors.seoTitle || errors.seoDescription)}>
        <SerpPreview {...props} />
        <TextField
          id={id('title')}
          label="SEO title"
          optional
          value={seo.title}
          placeholder={props.headline || 'The headline'}
          disabled={readOnly}
          maxLength={SEO_MAX.title + 10}
          error={errors.seoTitle}
          hint={`Shown as the link in Google. Empty uses the headline. ${props.siteName} is added at the end.`}
          onChange={(event) => set({ title: event.target.value })}
        />
        <Meter
          label="Title width"
          value={textWidth(analysis.title, SERP.desktop.titleFont)}
          good={[400, SERP.desktop.titleMax]}
          max={700}
          unit="px"
          text={`${analysis.title.length} characters`}
        />
        <TextArea
          id={id('description')}
          label="Meta description"
          optional
          rows={3}
          value={seo.description}
          placeholder={props.standfirst || 'One or two sentences that sum up the article'}
          disabled={readOnly}
          maxLength={SEO_MAX.description}
          error={errors.seoDescription}
          hint="The text under the link in Google. Empty uses the standfirst."
          onChange={(event) => set({ description: event.target.value })}
        />
        <Meter
          label="Description length"
          value={analysis.description.length}
          good={[120, 160]}
          max={200}
          unit="characters"
          text={`${analysis.description.length} characters${analysis.usesStandfirst ? ', from the standfirst' : ''}`}
        />
      </Panel>

      <Panel title="SEO analysis" titleId={id('analysis-title')} badge={<RatingDot rating={analysis.seo.rating} />}>
        <CheckGroups checks={analysis.seo.checks} />
      </Panel>

      <Panel title="Readability" titleId={id('readability-title')} badge={<RatingDot rating={analysis.readability.rating} />}>
        <CheckGroups checks={analysis.readability.checks} />
      </Panel>

      <Panel title="Internal links" titleId={id('links-title')} defaultOpen={false}>
        <p className={forms.hint}>
          Published articles from the same section or tags that this one does not link to yet. Paste the address into a link, or add a Read more card.
        </p>
        {!props.lookup ? (
          <p className={forms.hint}>Looking…</p>
        ) : props.lookup.suggestions.length === 0 ? (
          <p className={forms.hint}>No suggestions. Add a section or tags first.</p>
        ) : (
          <ul className={styles.suggestions}>
            {props.lookup.suggestions.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                <CopyButton text={`${props.origin}${item.path}`} label={`Copy the address of ${item.title}`} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Social card" titleId={id('social-title')} defaultOpen={false}>
        <SocialPreview {...props} />
        {!readOnly && (
          <div className={styles.row}>
            <Button size="sm" icon="image" onClick={props.onPickSocial}>
              {seo.ogMediaId ? 'Change social image' : 'Choose social image'}
            </Button>
            {seo.ogMediaId && (
              <Button size="sm" variant="quiet" onClick={() => set({ ogMediaId: null })}>
                Use the automatic card
              </Button>
            )}
          </div>
        )}
        <p className={forms.hint}>
          Without a social image, Facebook, X, WhatsApp and LinkedIn show an automatic card: the headline beside the lead image.
        </p>
      </Panel>

      <Panel
        title="Advanced"
        titleId={id('advanced-title')}
        defaultOpen={Boolean(seo.noindex || seo.canonical)}
        forceOpen={Boolean(errors.canonical)}
      >
        <CheckboxField
          id={id('noindex')}
          label="Hide from search engines"
          hint="Adds noindex and leaves the article out of the sitemaps. Readers can still open it."
          checked={seo.noindex}
          disabled={readOnly}
          onChange={(event) => set({ noindex: event.target.checked })}
        />
        <TextField
          id={id('canonical')}
          label="Canonical address"
          optional
          mono
          type="url"
          value={seo.canonical}
          placeholder={`${props.origin}/${props.section?.slug ?? 'section'}/${props.slug}`}
          disabled={readOnly}
          error={errors.canonical}
          hint="Only when this article first appeared elsewhere: the address of the original."
          onChange={(event) => set({ canonical: event.target.value })}
        />
      </Panel>
    </div>
  );
}

function Score({ label, assessment }: { label: string; assessment: Assessment }) {
  return (
    <div className={`${styles.score} ${styles.lit}`} data-rating={assessment.rating}>
      <span className={styles.scoreValue}>{assessment.score}</span>
      <span>
        <span className={styles.scoreLabel}>{label}</span>
        <span className={styles.scoreRating}>{RATING_LABELS[assessment.rating]}</span>
      </span>
    </div>
  );
}

function RatingDot({ rating }: { rating: Rating }) {
  return <span className={`${styles.dot} ${styles.lit}`} data-rating={rating} role="img" aria-label={RATING_LABELS[rating]} />;
}

const GROUPS: { rating: Rating; title: string }[] = [
  { rating: 'bad', title: 'Problems' },
  { rating: 'ok', title: 'Improvements' },
  { rating: 'good', title: 'Good results' },
];

function CheckGroups({ checks }: { checks: Check[] }) {
  return (
    <div className={styles.groups}>
      {GROUPS.map(({ rating, title }) => {
        const list = checks.filter((check) => check.rating === rating);
        if (!list.length) return null;
        const items = (
          <ul className={styles.checks}>
            {list.map((check) => (
              <li key={check.id} className={styles.lit} data-rating={check.rating} data-check={check.id}>
                <span className={styles.dot} aria-hidden="true" />
                <span>
                  {check.text}
                  {check.details && check.details.length > 0 && (
                    <ul className={styles.details}>
                      {check.details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </span>
              </li>
            ))}
          </ul>
        );
        return rating === 'good' ? (
          <details key={rating} className={styles.group}>
            <summary>
              {title} ({list.length})
            </summary>
            {items}
          </details>
        ) : (
          <div key={rating} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {title} ({list.length})
            </h3>
            {items}
          </div>
        );
      })}
    </div>
  );
}

function Meter({
  label,
  value,
  good,
  max,
  unit,
  text,
}: {
  label: string;
  value: number;
  good: [number, number];
  max: number;
  unit: string;
  text: string;
}) {
  const rating: Rating = value === 0 ? 'bad' : value >= good[0] && value <= good[1] ? 'good' : value > good[1] * 1.15 ? 'bad' : 'ok';
  return (
    <div className={`${styles.meter} ${styles.lit}`} data-rating={rating}>
      <span
        className={styles.meterTrack}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} ${unit}`}
      >
        <span className={styles.meterFill} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </span>
      <span className={styles.meterText}>{text}</span>
    </div>
  );
}

function SerpPreview({ analysis, origin, section, slug, publishedAt, siteName }: SeoPanelProps) {
  const [device, setDevice] = useState<Device>('desktop');
  // Drafts show today's date, as Google would on the day they are published.
  const [today] = useState(() => Date.now());
  const size = SERP[device];
  const title = fitWidth(analysis.title || 'Headline', size.titleMax, size.titleFont).text;
  const description = fitWidth(analysis.description || 'The meta description appears here.', size.descriptionMax, size.descriptionFont).text;
  const host = origin.replace(/^https?:\/\//, '');
  const date = new Date(publishedAt ?? today).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
  return (
    <div className={styles.serpBox}>
      <div className={styles.row} role="group" aria-label="Preview size">
        {(['desktop', 'mobile'] as const).map((d) => (
          <button key={d} type="button" className={styles.toggle} aria-pressed={device === d} onClick={() => setDevice(d)}>
            {d === 'desktop' ? 'Desktop' : 'Mobile'}
          </button>
        ))}
      </div>
      <figure className={styles.serp} data-device={device} aria-label="Google preview">
        <div className={styles.serpSite}>
          <span className={styles.serpIcon} aria-hidden="true">
            P
          </span>
          <span>
            <span className={styles.serpName}>{siteName}</span>
            <span className={styles.serpUrl}>
              {host} › {section?.slug ?? 'section'} › {slug}
            </span>
          </span>
        </div>
        <p className={styles.serpTitle}>{title}</p>
        <p className={styles.serpDescription}>
          <span className={styles.serpDate}>{date} — </span>
          {description}
        </p>
      </figure>
    </div>
  );
}

function SocialPreview({ analysis, headline, kicker, section, origin, lead, social, siteName }: SeoPanelProps) {
  const host = origin.replace(/^https?:\/\//, '').toUpperCase();
  const title = analysis.title.replace(/ · [^·]+$/, '') || headline || 'Headline';
  return (
    <figure className={styles.social} aria-label="Social card preview">
      {social ? (
        <CloudImage image={social} alt="" preset="hero" sizes="300px" className={styles.socialImage} />
      ) : (
        <div className={styles.autoCard} aria-label="Automatic card">
          <div className={styles.autoText}>
            <span className={styles.autoBrand}>{siteName}</span>
            <span className={styles.autoKicker}>{kicker || section?.name || 'News'}</span>
            <span className={styles.autoTitle}>{fitWidth(title, 380, 13).text}</span>
          </div>
          {lead && <CloudImage image={lead} alt="" preset="square" sizes="120px" className={styles.autoImage} />}
        </div>
      )}
      <figcaption className={styles.socialText}>
        <span className={styles.socialHost}>{host}</span>
        <span className={styles.socialTitle}>{title}</span>
        <span className={styles.socialDescription}>{fitWidth(analysis.description, 520, 13).text}</span>
      </figcaption>
    </figure>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="quiet"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}
