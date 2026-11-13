import Link from 'next/link';
import type { ReactNode } from 'react';
import { CloudImage } from '@/components/media/CloudImage';
import { articleHref, cardMeta, initials, type Kicker, kickerFor } from '@/modules/site/format';
import type { Card, SitePerson } from '@/modules/site/types';
import styles from './site.module.css';

// Story teasers in the shapes of the locked preview: lead, top story, card, opinion and list row.
// Teaser images are decorative (alt=""): the headline already names the link.

type Heading = 'h1' | 'h2' | 'h3';

export function KickerLabel({ kicker }: { kicker: Kicker }) {
  if (!kicker) return null;
  const tone = kicker.tone === 'live' ? styles.kickerLive : kicker.tone === 'plain' ? styles.kickerPlain : '';
  return (
    <span className={`${styles.kicker} ${tone}`}>
      {kicker.tone === 'live' && <span className={styles.dot} aria-hidden="true" />}
      {kicker.text}
    </span>
  );
}

export function Avatar({ person, size }: { person: Pick<SitePerson, 'name' | 'photo'>; size: number }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {person.photo ? <CloudImage image={person.photo} alt="" preset="square" sizes={`${size}px`} /> : initials(person.name)}
    </span>
  );
}

function Headline({ as: Tag, className, children }: { as: Heading; className: string; children: ReactNode }) {
  return <Tag className={`${className} ${styles.hl}`}>{children}</Tag>;
}

/** The front page lead: wide image, display headline, standfirst. Its image is the page's LCP element. */
export function LeadStory({ card }: { card: Card }) {
  return (
    <Link className={`${styles.story} ${styles.lead}`} href={articleHref(card)}>
      {card.lead && (
        <CloudImage
          image={card.lead}
          alt=""
          preset="hero"
          sizes="(max-width: 1024px) 100vw, 800px"
          priority
          className={`${styles.ph} ${styles.phWide}`}
        />
      )}
      <KickerLabel kicker={kickerFor(card)} />
      <Headline as="h1" className={styles.display}>
        {card.title}
      </Headline>
      {card.standfirst && <p className={styles.stand}>{card.standfirst}</p>}
      <p className={styles.meta}>{cardMeta(card, { minutes: true })}</p>
    </Link>
  );
}

/** A headline in a list without an image (Top stories, Related). */
export function TopStory({ card, as = 'h3' }: { card: Card; as?: Heading }) {
  return (
    <Link className={styles.story} href={articleHref(card)}>
      <KickerLabel kicker={kickerFor(card)} />
      <Headline as={as} className={styles.h4}>
        {card.title}
      </Headline>
      <p className={styles.meta}>{cardMeta(card)}</p>
    </Link>
  );
}

/** A card with a 3:2 image; with `standfirst` it also shows the standfirst (More from …). */
export function CardStory({ card, standfirst = false, hideSection = false, as = 'h3' }: { card: Card; standfirst?: boolean; hideSection?: boolean; as?: Heading }) {
  return (
    <Link className={styles.story} href={articleHref(card)}>
      {card.lead ? (
        <CloudImage image={card.lead} alt="" preset="card" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px" className={styles.ph} />
      ) : (
        <span className={styles.ph} aria-hidden="true" />
      )}
      <KickerLabel kicker={kickerFor(card, { hideSection })} />
      <Headline as={as} className={styles.h3}>
        {card.title}
      </Headline>
      {standfirst && card.standfirst && <p className={styles.standSm}>{card.standfirst}</p>}
      <p className={styles.meta}>{cardMeta(card)}</p>
    </Link>
  );
}

/** An opinion piece: the writer first, the headline in italics. */
export function OpinionStory({ card }: { card: Card }) {
  const writer = card.authors[0];
  return (
    <Link className={styles.op} href={articleHref(card)}>
      {writer ? <Avatar person={writer} size={48} /> : <span />}
      <div>
        {writer && (
          <p className={styles.opName}>
            {writer.name}
            {writer.role && <span> · {writer.role}</span>}
          </p>
        )}
        <h3 className={styles.opHl}>{card.title}</h3>
      </div>
    </Link>
  );
}

/** A row in a list page: text first, image on the right. */
export function RowStory({ card, hideSection = false }: { card: Card; hideSection?: boolean }) {
  return (
    <Link className={styles.row} href={articleHref(card)}>
      <div className={styles.rowText}>
        <KickerLabel kicker={kickerFor(card, { hideSection })} />
        <Headline as="h2" className={styles.h3}>
          {card.title}
        </Headline>
        {card.standfirst && <p className={styles.standSm}>{card.standfirst}</p>}
        <p className={styles.meta}>{cardMeta(card, { minutes: true })}</p>
      </div>
      {card.lead ? <CloudImage image={card.lead} alt="" preset="card" sizes="(max-width: 640px) 96px, 240px" className={styles.ph} /> : <span />}
    </Link>
  );
}
