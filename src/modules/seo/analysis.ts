import type { Doc } from '@/lib/doc/schema';
import { analyseReadability } from './readability';
import { applyTemplate, SERP, textWidth } from './snippet';
import { type BodyStructure, bodyStructure, firstWords, isInternal } from './structure';
import { assess, type Assessment, type Check, type Scores } from './types';
import { containsAll, contentStems, firstIndex, matchedCount, phraseCount, stems, words } from './words';

// The SEO analysis of one article, after Google Search Central's guidance on title links, snippets, links,
// images (Discover), spam (keyword stuffing) and helpful content. Pure: the editor runs it on every change and
// the server runs it on save to store the scores. Every check is advice; publishing rules live elsewhere.

export type SeoInput = {
  title: string;
  /** The SEO title; empty uses the headline. */
  seoTitle: string;
  /** The meta description; empty uses the standfirst. */
  description: string;
  standfirst: string;
  slug: string;
  keyphrase: string;
  related: string[];
  body: Doc;
  noindex: boolean;
  canonical: string;
  lead: { width: number; alt: string } | null;
  /** Alt text of each image in the text (empty string when missing). */
  imageAlts: string[];
  sources: number;
  siteHost: string;
  /** Title template from SEO settings, for example "%s · PressCompass". */
  titleTemplate: string;
  /** Other articles using the same keyphrase or SEO title; null skips those checks (not looked up yet). */
  usage: { keyphrase: number; title: number } | null;
};

export type Analysis = { seo: Assessment; readability: Assessment; title: string; description: string; usesStandfirst: boolean };

const GENERIC_LINK_TEXT = /^(?:click here|here|read more|more|this|this link|link|learn more|find out more|this article|this page|website|source)$/i;

export const LEAD_MIN_WIDTH = 1200;

export function analyseArticle(input: SeoInput): Analysis {
  const body = bodyStructure(input.body);
  const headline = (input.seoTitle.trim() || input.title.trim()).replace(/\s+/g, ' ');
  const title = headline ? applyTemplate(input.titleTemplate, headline) : '';
  const usesStandfirst = !input.description.trim();
  const description = (input.description.trim() || input.standfirst.trim()).replace(/\s+/g, ' ');
  return {
    seo: assess(seoChecks(input, body, headline, title, description, usesStandfirst)),
    readability: analyseReadability(body, { sources: input.sources, siteHost: input.siteHost }),
    title,
    description,
    usesStandfirst,
  };
}

export function scoresOf(analysis: Analysis): Scores {
  return { seo: analysis.seo.score, readability: analysis.readability.score };
}

function seoChecks(input: SeoInput, body: BodyStructure, headline: string, title: string, description: string, usesStandfirst: boolean): Check[] {
  const checks: Check[] = [];
  const keyphrase = input.keyphrase.trim();
  const keyWords = words(keyphrase).length;

  // Keyphrase checks: only once there is a keyphrase.
  if (!keyphrase) {
    checks.push({ id: 'keyphrase', rating: 'bad', text: 'Set a focus keyphrase: the words readers would type into Google to find this article.' });
  } else {
    checks.push(
      keyWords <= 4
        ? { id: 'keyphrase', rating: 'good', text: 'The keyphrase has a good length.' }
        : { id: 'keyphrase', rating: keyWords <= 8 ? 'ok' : 'bad', text: `The keyphrase has ${keyWords} words. Four or fewer work best.` },
    );

    const at = firstIndex(headline, keyphrase);
    checks.push(
      !containsAll(headline, keyphrase)
        ? { id: 'title-keyphrase', rating: 'bad', text: 'Add the keyphrase to the SEO title.' }
        : at <= 2
          ? { id: 'title-keyphrase', rating: 'good', text: 'The SEO title starts with the keyphrase.' }
          : { id: 'title-keyphrase', rating: 'ok', text: 'The SEO title contains the keyphrase. Moving it towards the start helps.' },
    );

    const inDescription = Math.max(phraseCount(description, keyphrase), containsAll(description, keyphrase) ? 1 : 0);
    checks.push(
      inDescription === 0
        ? {
            id: 'description-keyphrase',
            rating: 'bad',
            text: `The ${usesStandfirst ? 'standfirst (used as the meta description)' : 'meta description'} does not mention the keyphrase.`,
          }
        : inDescription <= 2
          ? { id: 'description-keyphrase', rating: 'good', text: 'The meta description mentions the keyphrase.' }
          : {
              id: 'description-keyphrase',
              rating: 'ok',
              text: `The keyphrase appears ${inDescription} times in the meta description. Once or twice reads better.`,
            },
    );

    const slugText = input.slug.replace(/-/g, ' ');
    const inSlug = matchedCount(slugText, keyphrase);
    checks.push(
      inSlug === contentStems(keyphrase).length
        ? { id: 'slug-keyphrase', rating: 'good', text: 'The address contains the keyphrase.' }
        : inSlug > 0
          ? { id: 'slug-keyphrase', rating: 'ok', text: 'The address contains part of the keyphrase.' }
          : { id: 'slug-keyphrase', rating: 'bad', text: 'Add the keyphrase to the address (Details, Address).' },
    );

    checks.push(
      containsAll(input.standfirst, keyphrase)
        ? { id: 'standfirst-keyphrase', rating: 'good', text: 'The standfirst mentions the keyphrase.' }
        : { id: 'standfirst-keyphrase', rating: 'ok', text: 'Mention the keyphrase in the standfirst.' },
    );

    checks.push(
      containsAll(firstWords(body.prose, 100), keyphrase)
        ? { id: 'intro-keyphrase', rating: 'good', text: 'The keyphrase appears in the first 100 words.' }
        : { id: 'intro-keyphrase', rating: 'bad', text: 'Use the keyphrase in the first 100 words of the text.' },
    );

    if (body.words >= 100) {
      const count = keyphraseSentences(body.prose, keyphrase);
      const density = Math.round((count / body.words) * 1000) / 10;
      checks.push(
        density > 3
          ? {
              id: 'density',
              rating: 'bad',
              text: `The keyphrase appears in ${count} sentences of ${body.words} words (${density}%). Google treats keyword stuffing as spam: use it less.`,
            }
          : density < 0.5
            ? {
                id: 'density',
                rating: 'ok',
                text: `The keyphrase appears in ${count} ${count === 1 ? 'sentence' : 'sentences'}. About once every 100 to 200 words is natural.`,
              }
            : { id: 'density', rating: 'good', text: `The keyphrase appears in ${count} sentences (${density}%), a natural amount.` },
      );
    }

    if (body.headings.length) {
      const needed = Math.ceil(contentStems(keyphrase).length / 2);
      const matching = body.headings.filter((h) => matchedCount(h.text, keyphrase) >= needed).length;
      const share = matching / body.headings.length;
      checks.push(
        matching === 0
          ? { id: 'subheadings-keyphrase', rating: 'ok', text: 'No subheading mentions the keyphrase or its words.' }
          : share > 0.75 && body.headings.length > 1
            ? { id: 'subheadings-keyphrase', rating: 'ok', text: 'Most subheadings repeat the keyphrase. Vary them so they read naturally.' }
            : { id: 'subheadings-keyphrase', rating: 'good', text: `${matching} of ${body.headings.length} subheadings mention the keyphrase.` },
      );
    }

    const related = input.related.map((phrase) => phrase.trim()).filter(Boolean);
    if (related.length) {
      const missing = related.filter((phrase) => !containsAll(body.text, phrase));
      checks.push(
        missing.length
          ? { id: 'related', rating: 'ok', text: `Related keyphrases missing from the text: ${missing.map((m) => `“${m}”`).join(', ')}.` }
          : { id: 'related', rating: 'good', text: 'Every related keyphrase appears in the text.' },
      );
    }

    const alts = [input.lead?.alt ?? '', ...input.imageAlts].filter((alt) => alt.trim());
    if (alts.length) {
      checks.push(
        alts.some((alt) => matchedCount(alt, keyphrase) > 0)
          ? { id: 'alt-keyphrase', rating: 'good', text: 'Image alt text mentions the topic of the keyphrase.' }
          : { id: 'alt-keyphrase', rating: 'ok', text: 'No alt text mentions the keyphrase. Add it only where it describes the image.' },
      );
    }

    if (input.usage) {
      checks.push(
        input.usage.keyphrase > 0
          ? {
              id: 'keyphrase-used',
              rating: 'bad',
              text: `${input.usage.keyphrase === 1 ? 'Another article uses' : `${input.usage.keyphrase} other articles use`} this keyphrase. Choose a different one so they do not compete in Google.`,
            }
          : { id: 'keyphrase-used', rating: 'good', text: 'No other article uses this keyphrase.' },
      );
    }
  }

  // Title and description.
  const chars = title.length;
  const width = textWidth(title, SERP.desktop.titleFont);
  checks.push(
    !headline
      ? { id: 'title-width', rating: 'bad', text: 'Write a headline or an SEO title.' }
      : width > SERP.desktop.titleMax
        ? {
            id: 'title-width',
            rating: chars > 75 ? 'bad' : 'ok',
            text: `The SEO title is ${chars} characters. Google cuts it after about 600 pixels (about 60 characters).`,
          }
        : width < 400
          ? { id: 'title-width', rating: 'ok', text: `The SEO title is short (${chars} characters). There is room for more detail.` }
          : { id: 'title-width', rating: 'good', text: `The SEO title fits the search result (${chars} characters).` },
  );

  if (input.usage && headline) {
    checks.push(
      input.usage.title > 0
        ? { id: 'title-unique', rating: 'bad', text: 'Another article has the same SEO title. Each page needs its own.' }
        : { id: 'title-unique', rating: 'good', text: 'No other article has this SEO title.' },
    );
  }

  const length = description.length;
  const source = usesStandfirst ? ' (the standfirst, used while the meta description is empty)' : '';
  checks.push(
    length === 0
      ? {
          id: 'description-length',
          rating: 'bad',
          text: 'Write a meta description: one or two sentences that sum up the article for search results.',
        }
      : length < 120
        ? {
            id: 'description-length',
            rating: 'ok',
            text: `The meta description${source} is short (${length} characters). 120 to 160 fills the snippet.`,
          }
        : length > 160
          ? { id: 'description-length', rating: 'ok', text: `The meta description${source} is ${length} characters. Google cuts it at about 160.` }
          : { id: 'description-length', rating: 'good', text: `The meta description${source} has a good length (${length} characters).` },
  );

  // The text.
  checks.push(
    body.words >= 300
      ? { id: 'length', rating: 'good', text: `The text has ${body.words} words.` }
      : body.words >= 150
        ? { id: 'length', rating: 'ok', text: `The text has ${body.words} words. Explainers and analysis usually need 300 or more.` }
        : { id: 'length', rating: 'bad', text: `The text has ${body.words} words. At least 150 are needed to publish.` },
  );

  if (body.headings.length) {
    const firstH2 = body.headings.findIndex((h) => h.level === 2);
    const h3First = body.headings.findIndex((h) => h.level === 3);
    checks.push(
      h3First !== -1 && (firstH2 === -1 || h3First < firstH2)
        ? {
            id: 'headings-order',
            rating: 'bad',
            text: 'A subheading (H3) comes before the first heading (H2). Use H2 for sections and H3 inside them.',
          }
        : { id: 'headings-order', rating: 'good', text: 'Headings are in order.' },
    );
  }

  const internal = body.links.filter((link) => isInternal(link.href, input.siteHost)).length + body.readMore;
  checks.push(
    internal >= 3
      ? { id: 'internal-links', rating: 'good', text: `${internal} links to other PressCompass articles.` }
      : internal > 0
        ? {
            id: 'internal-links',
            rating: 'ok',
            text: `${internal} ${internal === 1 ? 'link' : 'links'} to other PressCompass articles. Three to five help readers and Google find related stories.`,
          }
        : { id: 'internal-links', rating: 'bad', text: 'Link to at least three other PressCompass articles (in the text or as Read more cards).' },
  );

  const outbound = body.links.filter((link) => /^https?:/i.test(link.href) && !isInternal(link.href, input.siteHost)).length;
  checks.push(
    input.sources + outbound > 0
      ? {
          id: 'sources',
          rating: 'good',
          text: `The article cites ${input.sources} ${input.sources === 1 ? 'source' : 'sources'} and links out ${outbound} ${outbound === 1 ? 'time' : 'times'}.`,
        }
      : { id: 'sources', rating: 'bad', text: 'Cite at least one source: add it under Sources or link to it in the text.' },
  );

  if (body.links.length) {
    const generic = body.links.filter((link) => GENERIC_LINK_TEXT.test(link.text));
    checks.push(
      generic.length
        ? {
            id: 'link-text',
            rating: 'ok',
            text: `${generic.length === 1 ? 'One link says' : `${generic.length} links say`} “${generic[0].text}” or similar. Describe where the link goes.`,
          }
        : { id: 'link-text', rating: 'good', text: 'Link text describes where each link goes.' },
    );
  }

  // Images.
  checks.push(
    !input.lead
      ? { id: 'lead-image', rating: 'bad', text: 'Choose a lead image. Google shows it in results and Discover.' }
      : !input.lead.alt.trim()
        ? { id: 'lead-image', rating: 'bad', text: 'Add alt text to the lead image.' }
        : input.lead.width < LEAD_MIN_WIDTH
          ? {
              id: 'lead-image',
              rating: 'ok',
              text: `The lead image is ${input.lead.width} px wide. Google Discover shows large previews for images at least 1200 px wide.`,
            }
          : { id: 'lead-image', rating: 'good', text: 'The lead image is large enough for Google Discover and has alt text.' },
  );
  if (input.imageAlts.length) {
    const missing = input.imageAlts.filter((alt) => !alt.trim()).length;
    checks.push(
      missing
        ? {
            id: 'image-alt',
            rating: 'bad',
            text: `${missing === 1 ? 'One image' : `${missing} images`} in the text ${missing === 1 ? 'needs' : 'need'} alt text.`,
          }
        : { id: 'image-alt', rating: 'good', text: 'Every image in the text has alt text.' },
    );
  }

  // Indexing.
  if (input.noindex) checks.push({ id: 'noindex', rating: 'bad', text: 'This article asks search engines not to index it (SEO, Advanced).' });
  if (input.canonical.trim())
    checks.push({
      id: 'canonical',
      rating: 'ok',
      text: 'The canonical address points to another page, which search engines will treat as the original.',
    });

  return checks;
}

/** Sentences of the text that contain every content word of the keyphrase. */
function keyphraseSentences(prose: string[], keyphrase: string): number {
  const wanted = contentStems(keyphrase);
  let count = 0;
  for (const line of prose) {
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const have = new Set(stems(sentence));
      if (wanted.every((w) => have.has(w))) count += 1;
    }
  }
  return count;
}
