// Loads the starter content pack (content/starter) into the Supabase project: sourced explainers with their
// illustrations (uploaded to Cloudinary), and About, Contact and Privacy policy pages. Safe to run again:
// anything already there (same article or page slug, image public ID, section, tag or author slug) is kept.
//
// Usage: npm run content:starter                      publish the articles, spread over the last two days
//        npm run content:starter -- --email you@site  also fill in the contact email and publish the pages
//        npm run content:starter -- --draft           add the articles as drafts to review in the Newsroom first
//        npm run content:starter -- --dry-run         only check the files
// Reads the Supabase and Cloudinary keys from .env. Everything is checked before anything is written.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCloudinary, checkEnvValues, checkSupabase, contentCounts, readEnv, refreshRunningSite, secretClient } from './lib/setup.mjs';
import {
  AUTHOR,
  IMAGE_CREDIT,
  SECTIONS,
  bodyText,
  imagePublicId,
  parseArticle,
  parsePage,
  readingMinutes,
  slugify,
  wordCount,
} from './starter/parse.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'starter');
const PLACEHOLDER = '[add your contact email here]';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- options

const argv = process.argv.slice(2);
const options = { dryRun: false, draft: false, email: '' };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--dry-run') options.dryRun = true;
  else if (arg === '--draft') options.draft = true;
  else if (arg === '--email') options.email = argv[(i += 1)] ?? '';
  else if (arg.startsWith('--email=')) options.email = arg.slice('--email='.length);
  else fail(`Unknown option ${arg}. Use --email <address>, --draft or --dry-run.`);
}
options.email = options.email.trim();
if (argv.some((arg) => arg.startsWith('--email')) && !EMAIL.test(options.email))
  fail('--email needs an email address, for example --email desk@presscompass.site');

// ---------------------------------------------------------------- files

const readDir = (dir) =>
  existsSync(join(ROOT, dir))
    ? readdirSync(join(ROOT, dir))
        .filter((name) => name.endsWith('.md'))
        .sort()
    : [];
let articles;
let pages;
try {
  articles = readDir('articles').map((file) => parseArticle(readFileSync(join(ROOT, 'articles', file), 'utf8'), file));
  pages = readDir('pages').map((file) => parsePage(readFileSync(join(ROOT, 'pages', file), 'utf8'), file));
} catch (error) {
  fail(error.message);
}
const slugs = articles.map((article) => article.slug);
if (new Set(slugs).size !== slugs.length) fail('Two starter articles share a slug.');
for (const article of articles) {
  if (!existsSync(join(ROOT, 'images', `${article.image}.jpg`))) fail(`${article.file}: content/starter/images/${article.image}.jpg is missing.`);
  for (const slug of article.related) if (!slugs.includes(slug)) fail(`${article.file}: related article ${slug} is not in the pack.`);
}

if (options.dryRun) {
  for (const article of articles) {
    console.log(`${article.slug}  (${article.section}, ${article.type}, ${wordCount(bodyText(article.body))} words, image ${article.image})`);
  }
  for (const page of pages) console.log(`page /${page.slug}  (${options.email ? 'published' : 'draft'}, ${wordCount(bodyText(page.body))} words)`);
  console.log(`\n${articles.length} articles and ${pages.length} pages are ready to import.\n`);
  process.exit(0);
}

/** Replaces the contact placeholder in a page body (text nodes only). */
function withEmail(doc, email) {
  return JSON.parse(JSON.stringify(doc), (key, value) =>
    key === 'text' && typeof value === 'string' ? value.split(PLACEHOLDER).join(email) : value,
  );
}
const hasPlaceholder = (doc) => JSON.stringify(doc).includes(PLACEHOLDER);
/** JSON with sorted keys (jsonb returns keys sorted), to tell an untouched page from one edited in the Newsroom. */
const canon = (value) =>
  Array.isArray(value)
    ? `[${value.map(canon).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canon(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);

// ---------------------------------------------------------------- checks before writing

const e = readEnv();
console.log('Checking .env, Supabase and Cloudinary…');
for (const result of checkEnvValues(e).filter((r) => !r.ok && !/CRON_SECRET/.test(r.message))) fail(`${result.message}\n${result.fix}`);
for (const check of [checkSupabase(e), checkCloudinary(e, imagePublicId(articles[0].image))]) {
  const result = await check;
  if (!result.ok) fail(`${result.message}\n${result.fix}\nNothing was changed.`);
  console.log(`  ✓ ${result.message}`);
}

const supabase = secretClient(e);

/** Throws with a readable message when Supabase returns an error. */
async function run(what, query) {
  const { data, error } = await query;
  if (error) throw new Error(`Could not ${what}: ${error.message}`);
  return data;
}

/** Same signature as src/modules/media/cloudinary.ts. */
function sign(params) {
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1')
    .update(serialized + e.cloud.secret)
    .digest('hex');
}

async function uploadImage(name) {
  const signed = {
    allowed_formats: 'jpg',
    overwrite: 'false',
    public_id: imagePublicId(name),
    timestamp: String(Math.floor(Date.now() / 1000)),
    transformation: 'c_limit,w_2560,q_auto',
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(signed)) form.append(key, value);
  form.append('api_key', e.cloud.key);
  form.append('signature', sign(signed));
  form.append('file', new Blob([readFileSync(join(ROOT, 'images', `${name}.jpg`))], { type: 'image/jpeg' }), `${name}.jpg`);
  const response = await fetch(`${e.cloud.api}/v1_1/${e.cloud.name}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Cloudinary did not take ${name}.jpg: ${body.error?.message ?? response.statusText}`);
  return {
    public_id: String(body.public_id),
    format: String(body.format),
    width: Number(body.width),
    height: Number(body.height),
    bytes: Number(body.bytes),
  };
}

// ---------------------------------------------------------------- import

async function main() {
  const existing = await run('read articles', supabase.from('articles').select('id,slug').in('slug', slugs));
  const articleId = new Map(existing.map((row) => [row.slug, row.id]));
  const todo = articles.filter((article) => !articleId.has(article.slug));

  // 1. Images first: an upload problem stops the import before any article is written.
  const mediaId = new Map();
  for (const name of [...new Set(todo.map((article) => article.image))]) {
    const article = todo.find((a) => a.image === name);
    let media = await run('read media', supabase.from('media').select('id').eq('public_id', imagePublicId(name)).maybeSingle());
    if (!media) {
      process.stdout.write(`  uploading ${name}.jpg… `);
      const uploaded = await uploadImage(name);
      media = await run(
        'save the image',
        supabase
          .from('media')
          .insert({ ...uploaded, kind: 'image', alt: article.alt, caption: article.caption, credit: IMAGE_CREDIT, original_name: `${name}.jpg` })
          .select('id')
          .single(),
      );
      console.log('done');
    }
    mediaId.set(name, media.id);
  }

  // 2. Sections, author and tags: create what is missing, never change what exists.
  const sectionRows = await run('read sections', supabase.from('sections').select('id,slug,position'));
  const sectionId = new Map(sectionRows.map((row) => [row.slug, row.id]));
  let position = Math.max(-1, ...sectionRows.map((row) => row.position));
  const newSections = SECTIONS.filter((section) => !sectionId.has(section.slug)).map((section) => ({ ...section, position: (position += 1) }));
  if (newSections.length) {
    for (const row of await run('add sections', supabase.from('sections').insert(newSections).select('id,slug'))) sectionId.set(row.slug, row.id);
    console.log(`Added sections: ${newSections.map((section) => section.name).join(', ')}.`);
  }

  let author = await run('read authors', supabase.from('authors').select('id').eq('slug', AUTHOR.slug).maybeSingle());
  if (!author) {
    author = await run('add the author', supabase.from('authors').insert(AUTHOR).select('id').single());
    console.log(`Added the author ${AUTHOR.name}.`);
  }

  const tagNames = new Map();
  for (const article of todo) for (const name of article.tags) tagNames.set(slugify(name), name);
  const tagId = new Map();
  if (tagNames.size) {
    for (const row of await run(
      'read tags',
      supabase
        .from('tags')
        .select('id,slug')
        .in('slug', [...tagNames.keys()]),
    ))
      tagId.set(row.slug, row.id);
    const newTags = [...tagNames].filter(([slug]) => !tagId.has(slug)).map(([slug, name]) => ({ slug, name }));
    if (newTags.length) {
      for (const row of await run('add tags', supabase.from('tags').insert(newTags).select('id,slug'))) tagId.set(row.slug, row.id);
      console.log(`Added ${newTags.length} tags.`);
    }
  }

  // 3. Articles, bylines and tags.
  const now = Date.now();
  for (const article of articles) {
    if (articleId.has(article.slug)) {
      console.log(`Skipped (already there): ${article.title}`);
      continue;
    }
    const text = bodyText(article.body);
    const words = wordCount(text);
    const publishedAt = new Date(Math.floor((now - article.hoursAgo * 3_600_000) / 60_000) * 60_000).toISOString();
    const row = await run(
      `add "${article.title}"`,
      supabase
        .from('articles')
        .insert({
          title: article.title,
          slug: article.slug,
          section_id: sectionId.get(article.section),
          type: article.type,
          kicker_label: article.kicker,
          standfirst: article.standfirst,
          body: article.body,
          body_text: text,
          word_count: words,
          reading_minutes: readingMinutes(words),
          lead_media_id: mediaId.get(article.image),
          lead_caption: article.caption,
          sources: article.sources,
          status: options.draft ? 'draft' : 'published',
          published_at: options.draft ? null : publishedAt,
        })
        .select('id')
        .single(),
    );
    articleId.set(article.slug, row.id);
    await run('add the byline', supabase.from('article_authors').insert({ article_id: row.id, author_id: author.id, position: 0 }));
    const tags = article.tags.map((name) => ({ article_id: row.id, tag_id: tagId.get(slugify(name)) }));
    if (tags.length) await run('add tags to the article', supabase.from('article_tags').insert(tags));
    console.log(`${options.draft ? 'Added as draft' : 'Published'}: ${article.title}`);
  }

  // 4. Related articles once every article has an id; then a first revision, so History has a starting point.
  for (const article of todo) {
    const id = articleId.get(article.slug);
    const related = article.related.map((slug, index) => ({ article_id: id, related_id: articleId.get(slug), position: index }));
    if (related.length) await run('add related articles', supabase.from('article_related').insert(related));
    await run('save the first revision', supabase.rpc('record_revision', { p_id: id, p_note: 'Imported from the starter content pack.' }));
  }

  // 5. Pages: new ones are added; with --email, pages still showing the placeholder are completed and published.
  const pageRows = pages.length
    ? await run(
        'read pages',
        supabase
          .from('pages')
          .select('id,slug,status,blocks')
          .in(
            'slug',
            pages.map((page) => page.slug),
          ),
      )
    : [];
  for (const page of pages) {
    const row = pageRows.find((r) => r.slug === page.slug);
    const body = options.email ? withEmail(page.body, options.email) : page.body;
    const publish = Boolean(options.email);
    const fields = { status: publish ? 'published' : 'draft', published_at: publish ? new Date().toISOString() : null };
    if (!row) {
      await run(
        'add a page',
        supabase
          .from('pages')
          .insert({ title: page.title, slug: page.slug, seo: { description: page.description }, blocks: [{ type: 'text', body }], ...fields }),
      );
      console.log(`${publish ? 'Published page' : 'Added draft page'}: ${page.title}`);
    } else if (publish && row.status === 'draft') {
      const stored = Array.isArray(row.blocks) ? row.blocks.find((block) => block?.type === 'text')?.body : null;
      if (stored && !hasPlaceholder(stored) && canon(stored) !== canon(page.body)) {
        console.log(`Left as you edited it (draft): ${page.title}. Publish it in the Newsroom, Pages.`);
        continue;
      }
      await run(
        'publish a page',
        supabase
          .from('pages')
          .update({ blocks: [{ type: 'text', body: withEmail(stored ?? page.body, options.email) }], ...fields })
          .eq('id', row.id),
      );
      console.log(`Published page: ${page.title}`);
    }
  }

  // 6. Tell a running site to drop its cached pages, and report what readers can now see.
  const refresh = await refreshRunningSite(e);
  const counts = await contentCounts(e);
  console.log(
    `\nDone. ${counts.published} published articles and ${counts.pagesPublished} published pages (${counts.drafts} article drafts, ${counts.pagesDraft} page drafts).`,
  );
  console.log(
    `Site cache: ${refresh.message}.${refresh.ok ? '' : ' If npm run dev is running, stop it (Ctrl+C) and start it again to see the changes.'}`,
  );
  if (!options.email && counts.pagesDraft > 0) {
    console.log(
      'The About, Contact and Privacy policy pages are drafts. Run again with --email <your contact address> to complete and publish them.',
    );
  }
  console.log('The next deployment (git push) builds the live site with this content.\n');
}

main().catch((error) => fail(error.message));
