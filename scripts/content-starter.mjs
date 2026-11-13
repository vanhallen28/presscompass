// Loads the starter content pack (content/starter) into the Supabase project: ten sourced explainers with
// their illustrations, which are uploaded to Cloudinary, and draft About, Contact and Privacy policy pages.
// Safe to run again: anything already there (same article or page slug, image public ID, section, tag or
// author slug) is left as it is.
//
// Usage: npm run content:starter            publish the articles, spread over the last 30 hours
//        npm run content:starter -- --draft  add them as drafts to review in the Newsroom first
//        npm run content:starter -- --dry-run  only check the files
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and the Cloudinary keys from .env.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { AUTHOR, IMAGE_CREDIT, SECTIONS, bodyText, imagePublicId, parseArticle, parsePage, readingMinutes, slugify, wordCount } from './starter/parse.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'starter');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const draft = args.has('--draft');

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

for (const arg of args) if (!['--dry-run', '--draft'].includes(arg)) fail(`Unknown option ${arg}. Use --draft or --dry-run.`);

// ---------------------------------------------------------------- files

const files = readdirSync(join(ROOT, 'articles')).filter((name) => name.endsWith('.md')).sort();
let articles;
try {
  articles = files.map((file) => parseArticle(readFileSync(join(ROOT, 'articles', file), 'utf8'), file));
} catch (error) {
  fail(error.message);
}
const pageFiles = existsSync(join(ROOT, 'pages')) ? readdirSync(join(ROOT, 'pages')).filter((name) => name.endsWith('.md')).sort() : [];
let pages;
try {
  pages = pageFiles.map((file) => parsePage(readFileSync(join(ROOT, 'pages', file), 'utf8'), file));
} catch (error) {
  fail(error.message);
}
const slugs = articles.map((article) => article.slug);
if (new Set(slugs).size !== slugs.length) fail('Two starter articles share a slug.');
for (const article of articles) {
  if (!existsSync(join(ROOT, 'images', `${article.image}.jpg`))) fail(`${article.file}: content/starter/images/${article.image}.jpg is missing.`);
  for (const slug of article.related) if (!slugs.includes(slug)) fail(`${article.file}: related article ${slug} is not in the pack.`);
}

if (dryRun) {
  for (const article of articles) {
    const words = wordCount(bodyText(article.body));
    console.log(`${article.slug}  (${article.section}, ${article.type}, ${words} words, image ${article.image})`);
  }
  for (const page of pages) console.log(`page /${page.slug}  (draft, ${wordCount(bodyText(page.body))} words)`);
  console.log(`\n${articles.length} articles and ${pages.length} pages are ready to import.\n`);
  process.exit(0);
}

// ---------------------------------------------------------------- services

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is missing from .env.');
if (!secret?.startsWith('sb_secret_')) fail('SUPABASE_SECRET_KEY in .env must be a secret key that starts with sb_secret_.');

const cloud = {
  name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim(),
  key: process.env.CLOUDINARY_API_KEY?.trim(),
  secret: process.env.CLOUDINARY_API_SECRET?.trim(),
  api: process.env.CLOUDINARY_API_URL?.trim() || 'https://api.cloudinary.com',
};
if (!cloud.name || !cloud.key || !cloud.secret) {
  fail('The Cloudinary keys are missing from .env (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).');
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

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
  return createHash('sha1').update(serialized + cloud.secret).digest('hex');
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
  form.append('api_key', cloud.key);
  form.append('signature', sign(signed));
  form.append('file', new Blob([readFileSync(join(ROOT, 'images', `${name}.jpg`))], { type: 'image/jpeg' }), `${name}.jpg`);
  const response = await fetch(`${cloud.api}/v1_1/${cloud.name}/image/upload`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Cloudinary did not take ${name}.jpg: ${body.error?.message ?? response.statusText}`);
  return { public_id: String(body.public_id), format: String(body.format), width: Number(body.width), height: Number(body.height), bytes: Number(body.bytes) };
}

// ---------------------------------------------------------------- import

async function main() {
  const meta = await run('read app_meta (have the migrations been applied with npm run db:push?)', supabase.from('app_meta').select('value').eq('key', 'project').maybeSingle());
  if (meta?.value !== 'presscompass') throw new Error('This Supabase project is not set up for PressCompass. Check the keys in .env and run npm run db:push.');

  // Sections, author and tags: create what is missing, never change what exists.
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
  for (const article of articles) for (const name of article.tags) tagNames.set(slugify(name), name);
  const tagRows = await run('read tags', supabase.from('tags').select('id,slug').in('slug', [...tagNames.keys()]));
  const tagId = new Map(tagRows.map((row) => [row.slug, row.id]));
  const newTags = [...tagNames].filter(([slug]) => !tagId.has(slug)).map(([slug, name]) => ({ slug, name }));
  if (newTags.length) {
    for (const row of await run('add tags', supabase.from('tags').insert(newTags).select('id,slug'))) tagId.set(row.slug, row.id);
    console.log(`Added ${newTags.length} tags.`);
  }

  const existing = await run('read articles', supabase.from('articles').select('id,slug').in('slug', slugs));
  const articleId = new Map(existing.map((row) => [row.slug, row.id]));
  const created = [];
  const now = Date.now();

  for (const article of articles) {
    if (articleId.has(article.slug)) {
      console.log(`Skipped (already there): ${article.title}`);
      continue;
    }
    const publicId = imagePublicId(article.image);
    let media = await run('read media', supabase.from('media').select('id').eq('public_id', publicId).maybeSingle());
    if (!media) {
      const uploaded = await uploadImage(article.image);
      media = await run(
        'save the image',
        supabase
          .from('media')
          .insert({ ...uploaded, kind: 'image', alt: article.alt, caption: article.caption, credit: IMAGE_CREDIT, original_name: `${article.image}.jpg` })
          .select('id')
          .single(),
      );
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
          lead_media_id: media.id,
          lead_caption: article.caption,
          sources: article.sources,
          status: draft ? 'draft' : 'published',
          published_at: draft ? null : publishedAt,
        })
        .select('id')
        .single(),
    );
    articleId.set(article.slug, row.id);
    created.push(article);
    await run('add the byline', supabase.from('article_authors').insert({ article_id: row.id, author_id: author.id, position: 0 }));
    const tags = article.tags.map((name) => ({ article_id: row.id, tag_id: tagId.get(slugify(name)) }));
    if (tags.length) await run('add tags to the article', supabase.from('article_tags').insert(tags));
    console.log(`${draft ? 'Added as draft' : 'Published'}: ${article.title}`);
  }

  // Related articles once every article has an id; then a first revision, so History has a starting point.
  for (const article of created) {
    const id = articleId.get(article.slug);
    const related = article.related.map((slug, index) => ({ article_id: id, related_id: articleId.get(slug), position: index }));
    if (related.length) await run('add related articles', supabase.from('article_related').insert(related));
    await run('save the first revision', supabase.rpc('record_revision', { p_id: id, p_note: 'Imported from the starter content pack.' }));
  }

  // Static pages as drafts: their contact details and legal text are the owner's to complete before publishing.
  const pageRows = pages.length ? await run('read pages', supabase.from('pages').select('slug').in('slug', pages.map((page) => page.slug))) : [];
  const newPages = pages.filter((page) => !pageRows.some((row) => row.slug === page.slug));
  if (newPages.length) {
    await run(
      'add pages',
      supabase.from('pages').insert(newPages.map((page) => ({ title: page.title, slug: page.slug, seo: { description: page.description }, blocks: [{ type: 'text', body: page.body }], status: 'draft' }))),
    );
    console.log(`Added draft pages: ${newPages.map((page) => page.title).join(', ')}. Complete them under Pages in the Newsroom, then publish.`);
  }

  console.log(
    created.length
      ? `\n${created.length} of ${articles.length} starter articles added. They are in the Newsroom under Articles, where you can edit or unpublish them.\n` +
          'The next deployment (git push) includes them; until then the live site may show its cached pages.\n'
      : `\nNothing to add: all ${articles.length} starter articles are already there.\n`,
  );
}

main().catch((error) => fail(error.message));
