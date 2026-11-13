// Reads the starter articles in content/starter/articles: a small front matter block and a body in a
// narrow Markdown dialect, turned into the editor's JSON document (src/lib/doc/schema.ts).
//
// Body syntax: `## ` and `### ` headings, paragraphs (lines joined until a blank line), `- ` bullet lists,
// **bold**, *italic*, [links](https://…), and fenced blocks with JSON attributes: ```figures (a key figures
// block) and ```chart (a chart block, src/lib/doc/chart.ts). tests/unit/starter.test.ts checks the output
// against the sanitizer and the word counts against src/lib/doc/text.ts.

/** @typedef {{ type: 'text', text: string, marks?: { type: string, attrs?: { href: string } }[] }} TextNode */
/** @typedef {{ title: string, url: string, publisher: string, accessed: string }} Source */
/**
 * @typedef {{
 *   file: string, title: string, slug: string, section: string, type: string, kicker: string, standfirst: string,
 *   image: string, alt: string, caption: string, tags: string[], related: string[], hoursAgo: number,
 *   sources: Source[], body: { type: 'doc', content: any[] }
 * }} StarterArticle
 */

export const SECTIONS = [
  { slug: 'news', name: 'News', description: 'The latest from across Indonesia.' },
  { slug: 'politics', name: 'Politics', description: 'Government, parliament, elections and policy.' },
  { slug: 'business', name: 'Business', description: 'Companies, markets, trade and the economy.' },
  { slug: 'world', name: 'World', description: "Indonesia's place in the region and the world." },
  { slug: 'science', name: 'Science', description: 'Science, the environment, health and technology.' },
  { slug: 'data', name: 'Data', description: 'Numbers and charts that explain Indonesia.' },
];

export const AUTHOR = {
  slug: 'presscompass-desk',
  name: 'PressCompass Desk',
  role: 'Staff',
  bio: 'Explainers and data stories from the PressCompass newsroom.',
};

export const IMAGE_CREDIT = 'Illustration: PressCompass';
export const IMAGE_FOLDER = 'presscompass/images';

const TYPES = ['news', 'analysis', 'explainer', 'opinion', 'feature'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HTTP = /^https?:\/\/\S+$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WORD = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;
const WORDS_PER_MINUTE = 230;

/** Same rules as src/lib/slug.ts. */
export function slugify(text, max = 80) {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const hyphen = cut.lastIndexOf('-');
  return (hyphen > max / 2 ? cut.slice(0, hyphen) : cut).replace(/-+$/, '');
}

export const imagePublicId = (name) => `${IMAGE_FOLDER}/starter-${name}`;

const unquote = (value) => (/^".*"$/.test(value) ? value.slice(1, -1).replace(/\\"/g, '"') : value);
const list = (value) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []);

/** Splits `---` front matter from the body. Keys are `key: value`; `sources:` takes `- title | url | publisher | date` lines. */
export function splitFrontMatter(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== '---') throw new Error('The file must start with a --- line.');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error('The front matter has no closing --- line.');
  const meta = { sources: [] };
  let key = '';
  for (const line of lines.slice(1, end)) {
    if (line.startsWith('- ') && key === 'sources') {
      const [title = '', url = '', publisher = '', accessed = ''] = line.slice(2).split(' | ').map((part) => part.trim());
      meta.sources.push({ title, url, publisher, accessed });
      continue;
    }
    const match = /^([A-Za-z]+):\s?(.*)$/.exec(line);
    if (!match) throw new Error(`Cannot read the front matter line: ${line}`);
    key = match[1];
    if (key !== 'sources') meta[key] = unquote(match[2].trim());
  }
  return { meta, body: lines.slice(end + 1).join('\n') };
}

/** **bold**, *italic* and [text](url) into text nodes with marks. */
export function inline(text) {
  /** @type {TextNode[]} */
  const out = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((\S+?)\)/g;
  let last = 0;
  const push = (value, marks) => {
    if (!value) return;
    const previous = out[out.length - 1];
    if (!marks && previous && !previous.marks) previous.text += value;
    else out.push(marks ? { type: 'text', text: value, marks } : { type: 'text', text: value });
  };
  for (const match of text.matchAll(pattern)) {
    push(text.slice(last, match.index));
    if (match[1] !== undefined) push(match[1], [{ type: 'bold' }]);
    else if (match[2] !== undefined) push(match[2], [{ type: 'italic' }]);
    else push(match[3], [{ type: 'link', attrs: { href: match[4] } }]);
    last = match.index + match[0].length;
  }
  push(text.slice(last));
  return out;
}

const paragraph = (text) => ({ type: 'paragraph', content: inline(text) });

function special(kind, json, where) {
  let attrs;
  try {
    attrs = JSON.parse(json);
  } catch {
    throw new Error(`The ${kind} block ${where} is not valid JSON.`);
  }
  if (kind === 'figures') {
    return { type: 'keyFigures', attrs: { title: attrs.title ?? '', items: attrs.items ?? [], source: attrs.source ?? '' } };
  }
  if (kind === 'chart') {
    const { kind: chartKind, title, subtitle = '', source = '', axis = '', labels, series } = attrs;
    return { type: 'chart', attrs: { kind: chartKind, title, subtitle, source, axis, labels, series } };
  }
  throw new Error(`Unknown block \`\`\`${kind} ${where}.`);
}

/**
 * The body Markdown as an editor document.
 * @returns {{ type: 'doc', content: any[] }}
 */
export function markdownToDoc(markdown) {
  const content = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let text = [];
  let items = [];
  const flush = () => {
    if (text.length) content.push(paragraph(text.join(' ')));
    if (items.length) content.push({ type: 'bulletList', content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })) });
    text = [];
    items = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const fence = /^```(\w+)$/.exec(line);
    if (fence) {
      flush();
      const end = lines.indexOf('```', i + 1);
      if (end < 0) throw new Error(`The \`\`\`${fence[1]} block on line ${i + 1} is not closed.`);
      content.push(special(fence[1], lines.slice(i + 1, end).join('\n'), `on line ${i + 1}`));
      i = end;
    } else if (line === '') {
      flush();
    } else if (/^#{2,3} /.test(line)) {
      flush();
      const level = line.startsWith('### ') ? 3 : 2;
      content.push({ type: 'heading', attrs: { level }, content: inline(line.replace(/^#+ /, '')) });
    } else if (line.startsWith('- ')) {
      if (text.length) flush();
      items.push(line.slice(2));
    } else if (items.length) {
      items[items.length - 1] += ` ${line}`;
    } else {
      text.push(line);
    }
  }
  flush();
  return { type: 'doc', content };
}

function collect(blocks, lines) {
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'heading') {
      lines.push((block.content ?? []).map((node) => (node.type === 'text' ? node.text : ' ')).join('').replace(/\s+/g, ' ').trim());
    } else if (block.type === 'bulletList' || block.type === 'listItem') {
      collect(block.content, lines);
    } else if (block.type === 'keyFigures') {
      lines.push(block.attrs.title, ...block.attrs.items.map((item) => `${item.value} ${item.label}`.trim()));
    } else if (block.type === 'chart') {
      lines.push(block.attrs.title, block.attrs.subtitle);
    }
  }
}

/** Same as docText in src/lib/doc/text.ts for the blocks this format produces. */
export function bodyText(doc) {
  const lines = [];
  collect(doc.content, lines);
  return lines.filter(Boolean).join('\n');
}

export const wordCount = (text) => text.match(WORD)?.length ?? 0;
export const readingMinutes = (words) => (words > 0 ? Math.ceil(words / WORDS_PER_MINUTE) : 0);

/**
 * One starter article from its file. Throws with the file name and every problem found.
 * @returns {StarterArticle}
 */
export function parseArticle(text, file) {
  const { meta, body } = splitFrontMatter(text);
  const problems = [];
  for (const key of ['title', 'slug', 'section', 'type', 'standfirst', 'image', 'alt', 'caption']) {
    if (!meta[key]) problems.push(`${key} is missing`);
  }
  if (meta.slug && !SLUG.test(meta.slug)) problems.push('slug must use lowercase letters, numbers and single hyphens');
  if (meta.section && !SECTIONS.some((section) => section.slug === meta.section)) problems.push(`section ${meta.section} is not one of ${SECTIONS.map((s) => s.slug).join(', ')}`);
  if (meta.type && !TYPES.includes(meta.type)) problems.push(`type must be one of ${TYPES.join(', ')}`);
  if ((meta.title ?? '').length > 200) problems.push('title is longer than 200 characters');
  if ((meta.kicker ?? '').length > 40) problems.push('kicker is longer than 40 characters');
  if ((meta.standfirst ?? '').length > 400) problems.push('standfirst is longer than 400 characters');
  if ((meta.caption ?? '').length > 300) problems.push('caption is longer than 300 characters');
  if ((meta.alt ?? '').length > 300) problems.push('alt is longer than 300 characters');
  const hoursAgo = Number(meta.hoursAgo ?? 0);
  if (!Number.isFinite(hoursAgo) || hoursAgo < 0) problems.push('hoursAgo must be a number of hours, 0 or more');
  for (const source of meta.sources) {
    if (!source.title || !HTTP.test(source.url) || (source.accessed && !DATE.test(source.accessed))) {
      problems.push(`source "${source.title}" needs a title, an http(s) link and a YYYY-MM-DD date`);
    }
  }
  let doc = null;
  try {
    doc = markdownToDoc(body);
  } catch (error) {
    problems.push(error.message);
  }
  if (problems.length) throw new Error(`${file}: ${problems.join('; ')}.`);
  return {
    file,
    title: meta.title,
    slug: meta.slug,
    section: meta.section,
    type: meta.type,
    kicker: meta.kicker ?? '',
    standfirst: meta.standfirst,
    image: meta.image,
    alt: meta.alt,
    caption: meta.caption,
    tags: list(meta.tags),
    related: list(meta.related),
    hoursAgo,
    sources: meta.sources,
    body: doc,
  };
}

/**
 * One starter page (About, Contact, Privacy policy): title, slug, description and body. Imported as a draft.
 * @returns {{ file: string, title: string, slug: string, description: string, body: { type: 'doc', content: any[] } }}
 */
export function parsePage(text, file) {
  const { meta, body } = splitFrontMatter(text);
  const problems = [];
  for (const key of ['title', 'slug']) if (!meta[key]) problems.push(`${key} is missing`);
  if (meta.slug && !SLUG.test(meta.slug)) problems.push('slug must use lowercase letters, numbers and single hyphens');
  if ((meta.title ?? '').length > 120) problems.push('title is longer than 120 characters');
  if ((meta.description ?? '').length > 300) problems.push('description is longer than 300 characters');
  let doc = null;
  try {
    doc = markdownToDoc(body);
  } catch (error) {
    problems.push(error.message);
  }
  if (problems.length) throw new Error(`${file}: ${problems.join('; ')}.`);
  return { file, title: meta.title, slug: meta.slug, description: meta.description ?? '', body: doc };
}
