// What an article needs before readers can see it (Publish, Schedule, Update). Anything else the
// SEO panel checks later is a warning, not a block. The lead image rule arrives with the media library.

export const MIN_WORDS = 150;
export const UNTITLED_SLUG = /^untitled-[0-9a-f]{8}$/;

export type PublishCheck = {
  title: string;
  slug: string;
  sectionId: string | null;
  authorIds: string[];
  standfirst: string;
  wordCount: number;
};

export type PublishField = 'title' | 'slug' | 'sectionId' | 'authorIds' | 'standfirst' | 'body';

export function publishProblems(article: PublishCheck): Partial<Record<PublishField, string>> {
  const problems: Partial<Record<PublishField, string>> = {};
  if (!article.title.trim()) problems.title = 'Add a headline before publishing.';
  if (!article.slug || UNTITLED_SLUG.test(article.slug)) problems.slug = 'Set the address before publishing. It fills in from the headline.';
  if (!article.sectionId) problems.sectionId = 'Choose a section.';
  if (!article.authorIds.length) problems.authorIds = 'Add at least one author.';
  if (!article.standfirst.trim()) problems.standfirst = 'Add a standfirst: one or two sentences under the headline.';
  if (article.wordCount < MIN_WORDS) problems.body = `The article needs at least ${MIN_WORDS} words. It has ${article.wordCount}.`;
  return problems;
}
