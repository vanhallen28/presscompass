import 'server-only';
import { createSessionClient } from '@/lib/supabase/clients';
import type { AuthorLink } from './validate';

// Reads for the Sections, Tags and Authors pages and the article editor's pickers (Newsroom session).

export type Section = { id: string; name: string; slug: string; description: string; position: number; in_nav: boolean };
export type Tag = { id: string; name: string; slug: string; description: string };
export type Author = { id: string; name: string; slug: string; role: string; bio: string; links: AuthorLink[]; photo_media_id: string | null };
export type Usage = { sections: Record<string, number>; tags: Record<string, number>; authors: Record<string, number> };

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listSections(): Promise<Section[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('sections').select('id,name,slug,description,position,in_nav').order('position').order('name'));
}

export async function getSection(id: string): Promise<Section | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('sections').select('id,name,slug,description,position,in_nav').eq('id', id).maybeSingle());
}

export async function listTags(): Promise<Tag[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('tags').select('id,name,slug,description').order('name'));
}

export async function getTag(id: string): Promise<Tag | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('tags').select('id,name,slug,description').eq('id', id).maybeSingle());
}

export async function listAuthors(): Promise<Author[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('authors').select('id,name,slug,role,bio,links,photo_media_id').order('name'));
}

export async function getAuthor(id: string): Promise<Author | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('authors').select('id,name,slug,role,bio,links,photo_media_id').eq('id', id).maybeSingle());
}

/** How many articles (any status) use each section, tag and author. */
export async function getUsage(): Promise<Usage> {
  const supabase = await createSessionClient();
  return rows(supabase.rpc('newsroom_usage'));
}
