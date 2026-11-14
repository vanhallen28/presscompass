import type { Metadata } from 'next';
import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { Icon } from '@/components/ds/Icon';
import { ArticleView } from '@/components/site/ArticleView';
import { AdSlot } from '@/components/site/ads/AdSlot';
import { JsonLd } from '@/components/site/JsonLd';
import adStyles from '@/components/site/ads/ads.module.css';
import { ShareButtons } from '@/components/site/ShareButtons';
import { SitePage } from '@/components/site/SitePage';
import { CardStory, TopStory } from '@/components/site/Stories';
import styles from '@/components/site/site.module.css';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { getSiteAds } from '@/modules/ads/queries';
import { INLINE_PLACEMENTS, slotFor } from '@/modules/ads/types';
import { inlinePositions } from '@/modules/ads/validate';
import { metaContext } from '@/modules/seo/context';
import { articleJsonLd, breadcrumbs } from '@/modules/seo/jsonld';
import { articleMetadata } from '@/modules/seo/metadata';
import { articleHref } from '@/modules/site/format';
import { missing } from '@/modules/site/missing';
import { recentArticleParams } from '@/modules/site/params';
import { getArticle } from '@/modules/site/queries';

// Addresses missing from generateStaticParams render on their first visit, then come from the cache.
// The page needs its params to render at all (it is a 404 or a redirect without them), so it may block.
export const instant = false;

type Props = { params: Promise<{ section: string; slug: string }> };

export function generateStaticParams() {
  return recentArticleParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [article, ctx] = await Promise.all([getArticle(slug), metaContext()]);
  return article ? articleMetadata(ctx, article) : {};
}

export default async function ArticlePage({ params }: Props) {
  const { section, slug } = await params;
  const article = await getArticle(slug);
  if (!article) return missing(`/${section}/${slug}`);
  // One address per article: a section in the address that is not the article's own moves to the right one.
  if (article.section?.slug !== section) permanentRedirect(articleHref(article));

  const [ads, ctx] = await Promise.all([getSiteAds(), metaContext()]);
  const body = sanitizeDoc(article.body);
  const links = new Map(article.links.map((link) => [link.id, { title: link.title, href: articleHref(link) }]));
  // In-article ads after the chosen paragraphs (text paragraphs only, and only with two more after them).
  const wanted = INLINE_PLACEMENTS.flatMap((placement) => {
    const slot = slotFor(ads, placement);
    return slot ? [{ placement, paragraph: slot.paragraph }] : [];
  });
  const positions = inlinePositions(
    body.content.map((block) => (block.type === 'paragraph' && !block.content?.length ? 'empty' : block.type)),
    wanted,
  );
  const inserts = new Map(
    [...positions].map(([index, placements]) => [
      index,
      placements.map((placement) => <AdSlot key={placement} ads={ads} placement={placement} className={adStyles.inArticle} />),
    ]),
  );
  const railAd = slotFor(ads, 'article_rail') ? <AdSlot ads={ads} placement="article_rail" className={adStyles.inRail} /> : null;
  const media = new Map(article.media.map((item) => [item.id, item]));
  const page = `article-${article.id}`;

  return (
    <SitePage page={page} active={section}>
      <JsonLd data={articleJsonLd(ctx, article)} />
      {article.section && (
        <JsonLd
          data={breadcrumbs(ctx, [
            { name: 'Home', path: '/' },
            { name: article.section.name, path: `/${article.section.slug}` },
            { name: article.title },
          ])}
        />
      )}
      <div className={styles.wrap}>
        <ArticleView
          id={`article-${article.id}`}
          linked
          article={{ ...article, body, links, media }}
          actions={<ShareButtons title={article.title} />}
          inserts={inserts}
          afterBody={<AdSlot ads={ads} placement="article_end" className={adStyles.inArticle} />}
          rail={
            (article.related.length > 0 || railAd) && (
              <div>
                {article.related.length > 0 && (
                  <>
                    <h2 className={styles.railTitle}>Related</h2>
                    <ul className={styles.toplist}>
                      {article.related.map((card) => (
                        <li key={card.id}>
                          <TopStory card={card} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {railAd}
              </div>
            )
          }
        />
        {article.more.length > 0 && article.section && (
          <section className={styles.sec} aria-label={`More from ${article.section.name}`}>
            <div className={styles.secHead}>
              <h2 className={styles.h2}>More from {article.section.name}</h2>
              <Link className={styles.more} href={`/${article.section.slug}`}>
                More {article.section.name.toLowerCase()} <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <div className={styles.cards3}>
              {article.more.map((card) => (
                <CardStory key={card.id} card={card} standfirst hideSection />
              ))}
            </div>
          </section>
        )}
      </div>
    </SitePage>
  );
}
