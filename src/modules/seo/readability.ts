import { type BodyStructure, isInternal } from './structure';
import { assess, type Assessment, type Check } from './types';
import { writingCheck } from './writing';

// Readability of English prose: Flesch Reading Ease, sentence and paragraph length, subheadings, passive
// voice, transition words and repeated sentence openings, plus the house writing check.

const ABBREVIATIONS =
  /\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|No|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Inc|Ltd|Co|vs|etc|e\.g|i\.e|U\.S|U\.K)\./g;

/** Sentences of one line of prose. Common abbreviations and decimals do not end a sentence. */
export function sentences(line: string): string[] {
  const guarded = line.replace(ABBREVIATIONS, (match) => match.replace(/\./g, '\u0000')).replace(/(\d)\.(\d)/g, '$1\u0000$2');
  return guarded
    .split(/(?<=[.!?…]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/u)
    .map((s) => s.replace(/\u0000/g, '.').trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

const WORD = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;
const wordsOf = (text: string) => text.match(WORD) ?? [];

/** Rough English syllable count: vowel groups, minus a silent final e, at least one. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 1;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, trimmed.match(/[aeiouy]{1,2}/g)?.length ?? 1);
}

/** Flesch Reading Ease: 60 to 70 is plain English, higher is easier. */
export function fleschReadingEase(lines: string[]): number | null {
  const all = lines.flatMap(sentences);
  const w = all.flatMap(wordsOf).filter((word) => /\p{L}/u.test(word));
  if (all.length === 0 || w.length < 20) return null;
  const syl = w.reduce((sum, word) => sum + syllables(word), 0);
  return Math.round((206.835 - 1.015 * (w.length / all.length) - 84.6 * (syl / w.length)) * 10) / 10;
}

const IRREGULAR =
  'arisen awoken beaten become begun bent bitten blown born borne bought bound bred brought built burnt caught chosen come cut dealt done drawn driven drunk eaten fallen fed felt fled flown forbidden forgotten forgiven found frozen given gone got gotten grown held hidden hit hung hurt kept known laid led left lent let lost made meant met overcome paid put quit read ridden risen run said seen sent set shaken shed shot shown shut sold sought spent split spoken spread stolen stood struck stuck sung sunk sworn swept taken taught thought thrown told torn understood undertaken upheld withdrawn won worn woven written'.split(
    ' ',
  );
const PASSIVE = new RegExp(
  String.raw`\b(?:am|is|are|was|were|be|been|being|get|gets|got|gotten|getting)\s+(?:(?:not|also|now|still|already|often|being)\s+)?(?:\w+ly\s+)?(?:\w{3,}ed|${IRREGULAR.join('|')})\b`,
  'i',
);

export function isPassive(sentence: string): boolean {
  return PASSIVE.test(sentence);
}

const TRANSITIONS = [
  'above all',
  'accordingly',
  'after all',
  'afterwards',
  'also',
  'although',
  'as a result',
  'as well as',
  'at first',
  'at the same time',
  'because',
  'before',
  'besides',
  'by contrast',
  'consequently',
  'despite',
  'even so',
  'eventually',
  'finally',
  'first',
  'for example',
  'for instance',
  'furthermore',
  'hence',
  'however',
  'in addition',
  'in contrast',
  'in fact',
  'in other words',
  'in particular',
  'in short',
  'indeed',
  'instead',
  'later',
  'likewise',
  'meanwhile',
  'moreover',
  'nevertheless',
  'nonetheless',
  'notably',
  'on the other hand',
  'otherwise',
  'overall',
  'second',
  'similarly',
  'since',
  'so far',
  'still',
  'such as',
  'then',
  'therefore',
  'third',
  'though',
  'thus',
  'unless',
  'until',
  'whereas',
  'while',
  'yet',
];
const TRANSITION = new RegExp(`\\b(?:${TRANSITIONS.map((t) => t.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');

export function hasTransition(sentence: string): boolean {
  return TRANSITION.test(sentence);
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export function analyseReadability(body: BodyStructure, context: { sources: number; siteHost: string }): Assessment {
  const checks: Check[] = [];
  const all = body.prose.flatMap(sentences);

  const flesch = fleschReadingEase(body.prose);
  if (flesch === null) {
    checks.push({ id: 'flesch', rating: 'ok', text: 'Write a few more sentences to get a reading ease score.' });
  } else {
    checks.push({
      id: 'flesch',
      rating: flesch >= 60 ? 'good' : flesch >= 40 ? 'ok' : 'bad',
      text:
        flesch >= 60
          ? `Reading ease is ${flesch}: plain English most readers follow easily.`
          : flesch >= 40
            ? `Reading ease is ${flesch}: fairly difficult. Shorter sentences and simpler words help.`
            : `Reading ease is ${flesch}: hard going. Split long sentences and swap long words for short ones.`,
    });
  }

  if (all.length) {
    const long = all.filter((s) => wordsOf(s).length > 20);
    const share = percent(long.length, all.length);
    checks.push({
      id: 'sentence-length',
      rating: share <= 25 ? 'good' : share <= 35 ? 'ok' : 'bad',
      text:
        share <= 25
          ? `${share}% of sentences have more than 20 words.`
          : `${share}% of sentences have more than 20 words. Keep it to a quarter or less.`,
      details: share > 25 ? long.slice(0, 5) : undefined,
    });
  }

  const longParagraphs = body.paragraphs.filter((p) => wordsOf(p).length > 150);
  checks.push(
    longParagraphs.length === 0
      ? { id: 'paragraph-length', rating: 'good', text: 'No paragraph is longer than 150 words.' }
      : {
          id: 'paragraph-length',
          rating: longParagraphs.some((p) => wordsOf(p).length > 200) ? 'bad' : 'ok',
          text: `${longParagraphs.length === 1 ? 'One paragraph is' : `${longParagraphs.length} paragraphs are`} longer than 150 words. Split ${longParagraphs.length === 1 ? 'it' : 'them'} up.`,
          details: longParagraphs.map((p) => `${p.slice(0, 80)}…`),
        },
  );

  if (body.words > 300) {
    const longest = Math.max(...body.sectionWords);
    checks.push(
      body.headings.length === 0
        ? { id: 'subheadings', rating: 'bad', text: 'The text has no subheadings. Add an H2 every 300 words or so.' }
        : longest > 350
          ? { id: 'subheadings', rating: 'ok', text: `One section runs ${longest} words without a subheading. Add one every 300 words or so.` }
          : { id: 'subheadings', rating: 'good', text: 'Subheadings break the text into sections of a good length.' },
    );
  }

  if (all.length) {
    const passive = all.filter(isPassive);
    const share = percent(passive.length, all.length);
    checks.push({
      id: 'passive',
      rating: share <= 10 ? 'good' : share <= 20 ? 'ok' : 'bad',
      text:
        share <= 10
          ? `${share}% of sentences use the passive voice.`
          : `${share}% of sentences use the passive voice. Say who did what where you can.`,
      details: share > 10 ? passive.slice(0, 5) : undefined,
    });

    const transitions = percent(all.filter(hasTransition).length, all.length);
    checks.push({
      id: 'transitions',
      rating: transitions >= 25 ? 'good' : 'ok',
      text:
        transitions >= 25
          ? `${transitions}% of sentences use linking words such as "however" or "because".`
          : `Only ${transitions}% of sentences use linking words such as "however", "because" or "for example". They help readers follow the argument.`,
    });

    let repeats = 0;
    const repeated: string[] = [];
    for (let i = 2; i < all.length; i += 1) {
      const first = (s: string) => wordsOf(s)[0]?.toLowerCase();
      const word = first(all[i]);
      if (word && word === first(all[i - 1]) && word === first(all[i - 2]) && (i === 2 || first(all[i - 3]) !== word)) {
        repeats += 1;
        repeated.push(word);
      }
    }
    checks.push(
      repeats === 0
        ? { id: 'openings', rating: 'good', text: 'Sentences start in varied ways.' }
        : { id: 'openings', rating: 'ok', text: `Three or more sentences in a row start with the same word (${[...new Set(repeated)].join(', ')}).` },
    );
  }

  const outbound = body.links.filter((link) => /^https?:/i.test(link.href) && !isInternal(link.href, context.siteHost)).length;
  checks.push(writingCheck(all, { hasSources: context.sources + outbound > 0 }));
  return assess(checks);
}
