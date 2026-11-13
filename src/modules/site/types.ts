import type { Doc } from '@/lib/doc/schema';
import type { ArticleType, Source } from '@/modules/editor/input';

// Shapes returned by the site_* SQL functions (supabase/migrations/20261116000100_public_site.sql).

export type SiteImage = { publicId: string; width: number; height: number; alt: string; credit: string };
export type SitePerson = { name: string; slug: string; role: string; photo: SiteImage | null };
export type SiteSection = { name: string; slug: string };

export type Card = {
  id: string;
  title: string;
  slug: string;
  type: ArticleType;
  kicker: string;
  standfirst: string;
  publishedAt: string;
  updatedAt: string | null;
  readingMinutes: number;
  isBreaking: boolean;
  section: SiteSection | null;
  authors: SitePerson[];
  lead: SiteImage | null;
};

export type ArticlePage = Card & {
  body: Doc;
  sources: Source[];
  leadCaption: string;
  tags: { name: string; slug: string }[];
  media: (SiteImage & { id: string })[];
  links: { id: string; title: string; slug: string; section: string | null }[];
  related: Card[];
  more: Card[];
};

export type Home = { top: Card[]; sections: (SiteSection & { articles: Card[] })[]; opinion: Card[] };

export type ListKind = 'latest' | 'section' | 'author' | 'tag';
export type ListSubject = SiteSection & { description?: string; role?: string; bio?: string; links?: { label: string; url: string }[]; photo?: SiteImage | null };
export type ListPage = { subject: ListSubject | null; total: number; rows: Card[] };
export type SearchPage = { total: number; rows: Card[] };

export type NavSection = SiteSection & { inNav: boolean };
export type Redirect = { to: string; code: number };
