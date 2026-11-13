import { sanitizeDoc } from '@/lib/doc/sanitize';
import type { Doc } from '@/lib/doc/schema';
import { isSlug, RESERVED_SLUGS } from '@/lib/slug';

// Checks what the page editor sends. Pure, shared by the Server Action and the tests.

export const PAGE_LIMITS = { title: 120, description: 300 } as const;

export type PageIntent = 'save' | 'publish' | 'unpublish';
export type PageInput = { id: string; title: string; slug: string; description: string; body: Doc; intent: PageIntent };
export type PageErrors = Partial<Record<'title' | 'slug' | 'description' | 'body', string>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePageInput(raw: unknown): { ok: true; value: PageInput; errors: PageErrors } | { ok: false } {
  if (typeof raw !== 'object' || raw === null) return { ok: false };
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !UUID.test(r.id) || !['save', 'publish', 'unpublish'].includes(r.intent as string)) return { ok: false };
  if (typeof r.title !== 'string' || typeof r.slug !== 'string' || typeof r.description !== 'string') return { ok: false };
  const value: PageInput = {
    id: r.id.toLowerCase(),
    title: r.title.trim(),
    slug: r.slug.trim(),
    description: r.description.trim(),
    body: sanitizeDoc(r.body),
    intent: r.intent as PageIntent,
  };
  const errors: PageErrors = {};
  if (value.title.length > PAGE_LIMITS.title) errors.title = `Keep the title under ${PAGE_LIMITS.title} characters.`;
  if (!isSlug(value.slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  else if ((RESERVED_SLUGS as readonly string[]).includes(value.slug)) errors.slug = 'The site uses this address itself. Choose another.';
  if (value.description.length > PAGE_LIMITS.description) errors.description = `Keep the description under ${PAGE_LIMITS.description} characters.`;
  if (value.intent === 'publish') {
    if (!value.title) errors.title ??= 'Add a title before publishing.';
    if (!value.body.content.some((block) => block.type !== 'paragraph' || block.content?.length)) errors.body = 'Write the page before publishing.';
  }
  return { ok: true, value, errors };
}

/** A page body as stored in pages.blocks. */
export const bodyBlocks = (body: Doc) => [{ type: 'text', body }];
