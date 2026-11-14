import type { Check } from './types';

// The house writing check (spec §9, point 3): stock phrases that make copy read as generic or machine-written
// (after the humanizer skill's list), exclamation marks, and figures with no source anywhere in the article.

const PHRASES = [
  'a testament to',
  'a myriad of',
  'at the end of the day',
  'bustling',
  'cutting-edge',
  'delve',
  'delves',
  'delving',
  'ever-evolving',
  'fast-paced world',
  'first and foremost',
  'foster',
  'fosters',
  'game-changer',
  'game changer',
  'groundbreaking',
  'in conclusion',
  'in today’s world',
  "in today's world",
  'in the realm of',
  'it is important to note',
  'it is worth noting',
  "it's important to note",
  "it's worth noting",
  'needless to say',
  'nestled',
  'only time will tell',
  'paradigm shift',
  'plays a crucial role',
  'plays a pivotal role',
  'pivotal',
  'rich tapestry',
  'seamless',
  'seamlessly',
  'serves as a testament',
  'shed light on',
  'sheds light on',
  'stands as a',
  'tapestry',
  'the fact that',
  'underscores',
  'unlock the potential',
  'very unique',
  'vibrant',
];
// The phrases hold no regular expression syntax (letters, spaces, hyphens, apostrophes), so they join as they are.
const PHRASE = new RegExp(`(?<![\\p{L}])(?:${PHRASES.join('|')})(?![\\p{L}])`, 'giu');

/** Sentences with a figure: a number that is not just a four-digit year. */
const FIGURE =
  /(?:\d[\d,.]*\s?(?:%|per cent|percent|million|billion|trillion|km|kg|tonnes?|rupiah|dollars?)|\b\d{1,3}(?:[,.]\d{3})+\b|\b(?!(?:19|20)\d{2}\b)\d+(?:\.\d+)?\b)/i;

export function writingCheck(sentences: string[], { hasSources }: { hasSources: boolean }): Check {
  const found = new Map<string, number>();
  for (const sentence of sentences) {
    for (const match of sentence.matchAll(PHRASE)) {
      const key = match[0].toLowerCase().replace(/’/g, "'");
      found.set(key, (found.get(key) ?? 0) + 1);
    }
  }
  const exclamations = sentences.filter((s) => /!/.test(s.replace(/[“"][^”"]*[”"]/g, ''))).length;
  const unsourced = hasSources ? 0 : sentences.filter((s) => FIGURE.test(s)).length;

  const details: string[] = [];
  for (const [phrase, count] of found) details.push(`“${phrase}”${count > 1 ? ` (${count} times)` : ''}: stock phrase, say it plainly.`);
  if (exclamations)
    details.push(
      `${exclamations === 1 ? 'One sentence ends' : `${exclamations} sentences end`} with an exclamation mark outside a quote. PressCompass style uses none.`,
    );
  if (unsourced)
    details.push(
      `${unsourced === 1 ? 'One sentence gives' : `${unsourced} sentences give`} a figure, but the article cites no source. Add it under Sources.`,
    );

  return details.length
    ? { id: 'writing', rating: 'ok', text: `Writing check: ${details.length === 1 ? 'one thing' : `${details.length} things`} to look at.`, details }
    : { id: 'writing', rating: 'good', text: 'Writing check: no stock phrases, exclamation marks or unsourced figures.' };
}
