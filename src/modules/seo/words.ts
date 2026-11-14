// Word matching for keyphrases: lower case, punctuation removed, plurals and possessives folded, so
// "Indonesia's rice prices" matches the keyphrase "rice price". Small on purpose: it runs on every keystroke.

const STOP_WORDS = new Set(
  'a an the of in on at to for from by with and or but is are was were be been being as its it this that these those how what why when where who which do does did can could will would should into about over under than then so if not no'.split(
    ' ',
  ),
);

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;

/** A word folded to a rough stem: "dragons" → "dragon", "cities" → "city", "Indonesia's" → "indonesia". */
export function stem(word: string): string {
  let w = word
    .toLowerCase()
    .replace(/['’]s$/, '')
    .replace(/['’]/g, '');
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  return w;
}

export function words(text: string): string[] {
  return text.match(WORD) ?? [];
}

/** Stems of every word, in order. */
export function stems(text: string): string[] {
  return words(text).map(stem);
}

/** Stems of the words that carry meaning (stop words dropped; all of them when the phrase is only stop words). */
export function contentStems(phrase: string): string[] {
  const all = stems(phrase);
  const content = all.filter((w) => !STOP_WORDS.has(w));
  return [...new Set(content.length ? content : all)];
}

/** True when every content word of the phrase appears in the text. */
export function containsAll(text: string, phrase: string): boolean {
  const wanted = contentStems(phrase);
  if (!wanted.length) return false;
  const have = new Set(stems(text));
  return wanted.every((w) => have.has(w));
}

/** How many of the phrase's content words appear in the text. */
export function matchedCount(text: string, phrase: string): number {
  const have = new Set(stems(text));
  return contentStems(phrase).filter((w) => have.has(w)).length;
}

/** Index (in words) of the first content word of the phrase in the text, or -1. */
export function firstIndex(text: string, phrase: string): number {
  const wanted = new Set(contentStems(phrase));
  return stems(text).findIndex((w) => wanted.has(w));
}

/** Non-overlapping occurrences of the phrase, with its words in order and adjacent. */
export function phraseCount(text: string, phrase: string): number {
  const hay = stems(text);
  const needle = stems(phrase);
  if (!needle.length) return 0;
  let count = 0;
  for (let i = 0; i + needle.length <= hay.length; i += 1) {
    if (needle.every((w, j) => hay[i + j] === w)) {
      count += 1;
      i += needle.length - 1;
    }
  }
  return count;
}
