import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { Icon } from '@/components/ds/Icon';
import { AdSlot } from '@/components/site/ads/AdSlot';
import { JsonLd } from '@/components/site/JsonLd';
import { SitePage } from '@/components/site/SitePage';
import { CardStory, LeadStory, OpinionStory, TopStory } from '@/components/site/Stories';
import styles from '@/components/site/site.module.css';
import { getSiteAds } from '@/modules/ads/queries';
import { metaContext } from '@/modules/seo/context';
import { homeJsonLd } from '@/modules/seo/jsonld';
import { homeMetadata } from '@/modules/seo/metadata';
import { getHome } from '@/modules/site/queries';

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata(await metaContext());
}

// The front page (v0.4.0 fills it automatically; the homepage builder arrives in Plan 5).
export default async function HomePage() {
  const [home, ads, ctx] = await Promise.all([getHome(), getSiteAds(), metaContext()]);
  const [lead, ...top] = home.top;

  return (
    <SitePage page="home">
      <JsonLd data={homeJsonLd(ctx)} />
      <div className={styles.wrap}>
        {lead ? (
          <section className={styles.leadGrid} aria-label="Top stories">
            <LeadStory card={lead} />
            {top.length > 0 && (
              <div className={styles.railTop}>
                <h2 className={styles.railTitle}>Top stories</h2>
                <ul className={styles.toplist}>
                  {top.map((card) => (
                    <li key={card.id}>
                      <TopStory card={card} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : (
          <div className={styles.empty}>
            <h1 className={styles.h1}>News with a sense of direction.</h1>
            <p>Independent, English-language news about Indonesia. The first stories are on their way.</p>
          </div>
        )}

        {home.sections.map((section, index) => (
          <Fragment key={section.slug}>
            {index === 2 && <AdSlot ads={ads} placement="home_middle" />}
            <section className={styles.sec} aria-label={section.name}>
              <div className={styles.secHead}>
                <h2 className={styles.h2}>
                  <Link href={`/${section.slug}`} className={styles.secLink}>
                    {section.name}
                  </Link>
                </h2>
                <Link className={styles.more} href={`/${section.slug}`}>
                  More {section.name.toLowerCase()} <Icon name="arrow-right" size={16} />
                </Link>
              </div>
              <div className={styles.cards4}>
                {section.articles.map((card) => (
                  <CardStory key={card.id} card={card} hideSection />
                ))}
              </div>
            </section>
          </Fragment>
        ))}
        {home.sections.length > 0 && home.sections.length <= 2 && <AdSlot ads={ads} placement="home_middle" />}

        {home.opinion.length > 0 && (
          <section className={styles.sec} aria-label="Opinion">
            <div className={styles.secHead}>
              <h2 className={styles.h2}>Opinion</h2>
            </div>
            <div className={styles.ops}>
              {home.opinion.map((card) => (
                <OpinionStory key={card.id} card={card} />
              ))}
            </div>
          </section>
        )}
      </div>
    </SitePage>
  );
}
