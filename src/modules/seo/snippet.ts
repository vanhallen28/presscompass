// How a title and description look in Google's results. Google cuts titles to the width of the device, not
// to a number of characters, so widths are estimated from Arial's character widths (in 1/1000 em).

const WIDTHS: Record<string, number> = {
  ' ': 278,
  '!': 278,
  '"': 355,
  '#': 556,
  $: 556,
  '%': 889,
  '&': 667,
  "'": 191,
  '(': 333,
  ')': 333,
  '*': 389,
  '+': 584,
  ',': 278,
  '-': 333,
  '.': 278,
  '/': 278,
  ':': 278,
  ';': 278,
  '<': 584,
  '=': 584,
  '>': 584,
  '?': 556,
  '@': 1015,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
  '·': 278,
  '–': 556,
  '—': 1000,
  '’': 222,
  '‘': 222,
  '“': 333,
  '”': 333,
  '…': 1000,
  '|': 260,
};
const DIGIT = 556;
const DEFAULT = 556;

/** Search result sizes: desktop titles are 20 px Arial up to about 600 px, descriptions 14 px over two lines. */
export const SERP = {
  desktop: { titleFont: 20, titleMax: 600, descriptionFont: 14, descriptionMax: 920 },
  mobile: { titleFont: 18, titleMax: 660, descriptionFont: 14, descriptionMax: 680 },
} as const;

export type Device = keyof typeof SERP;

/** Estimated width in pixels of the text in Arial at the given size. */
export function textWidth(text: string, fontPx: number): number {
  let units = 0;
  for (const char of text) units += WIDTHS[char] ?? (/\d/.test(char) ? DIGIT : DEFAULT);
  return Math.round((units / 1000) * fontPx);
}

/** The text as Google would show it in that width: cut at a word boundary with an ellipsis when too wide. */
export function fitWidth(text: string, maxPx: number, fontPx: number): { text: string; cut: boolean } {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (textWidth(clean, fontPx) <= maxPx) return { text: clean, cut: false };
  const ellipsis = textWidth(' …', fontPx);
  let out = '';
  for (const word of clean.split(' ')) {
    const next = out ? `${out} ${word}` : word;
    if (textWidth(next, fontPx) + ellipsis > maxPx) break;
    out = next;
  }
  return { text: `${out.replace(/[\s,;:.–—-]+$/, '')} …`, cut: true };
}

/** Applies a title template such as "%s · PressCompass". */
export function applyTemplate(template: string, title: string): string {
  return template.includes('%s') ? template.replace('%s', title) : title;
}
