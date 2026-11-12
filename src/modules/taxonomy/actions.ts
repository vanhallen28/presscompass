'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { type Errors, parseAuthor, parseSection, parseTag } from './validate';

// Server Actions for Sections, Tags and Authors. Each one checks the session itself.

export type FormState = { errors: Errors; values?: Record<string, unknown>; message?: string };

type Kind = 'section' | 'tag' | 'author';
const TABLE: Record<Kind, 'sections' | 'tags' | 'authors'> = { section: 'sections', tag: 'tags', author: 'authors' };
const LIST: Record<Kind, string> = { section: '/newsroom/sections', tag: '/newsroom/tags', author: '/newsroom/authors' };

function idFrom(form: FormData): string | null {
  const id = form.get('id');
  return typeof id === 'string' && UUID.test(id) ? id : null;
}

async function store(kind: Kind, id: string | null, row: Record<string, unknown>, values: Record<string, unknown>): Promise<FormState> {
  const supabase = await createSessionClient();
  let error: { code?: string; message: string } | null;
  if (id) {
    ({ error } = await supabase.from(TABLE[kind]).update(row).eq('id', id));
  } else {
    let position = {};
    if (kind === 'section') {
      const { count } = await supabase.from('sections').select('id', { count: 'exact', head: true });
      position = { position: count ?? 0 };
    }
    ({ error } = await supabase.from(TABLE[kind]).insert({ ...row, ...position }));
  }
  if (error?.code === '23505') return { errors: { slug: `Another ${kind} already uses this address.` }, values };
  if (error) return { errors: {}, values, message: `The ${kind} could not be saved. ${error.message}` };
  redirect(`${LIST[kind]}?notice=${id ? 'updated' : 'created'}`);
}

export async function saveSection(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseSection(form);
  if (Object.keys(errors).length) return { errors, values };
  const supabase = await createSessionClient();
  const { data: page } = await supabase.from('pages').select('id').eq('slug', values.slug).maybeSingle();
  if (page) return { errors: { slug: 'A page already uses this address. Choose another.' }, values };
  return store('section', idFrom(form), { name: values.name, slug: values.slug, description: values.description, in_nav: values.inNav }, values);
}

export async function saveTag(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseTag(form);
  if (Object.keys(errors).length) return { errors, values };
  return store('tag', idFrom(form), values, values);
}

export async function saveAuthor(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseAuthor(form);
  if (Object.keys(errors).length) return { errors, values };
  return store('author', idFrom(form), values, values);
}

async function remove(kind: Kind, form: FormData) {
  await requireStaff();
  const id = idFrom(form);
  if (!id) redirect(LIST[kind]);
  const supabase = await createSessionClient();
  const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id);
  if (error) redirect(`${LIST[kind]}/${id}?notice=${error.code === '23503' ? 'in-use' : 'failed'}`);
  redirect(`${LIST[kind]}?notice=deleted`);
}

export async function deleteSection(form: FormData) {
  await remove('section', form);
}

export async function deleteTag(form: FormData) {
  await remove('tag', form);
}

export async function deleteAuthor(form: FormData) {
  await remove('author', form);
}

/** Moves a section one place up or down in the navigation order. */
export async function moveSection(form: FormData) {
  await requireStaff();
  const id = idFrom(form);
  const direction = form.get('direction') === 'up' ? -1 : 1;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('sections').select('id,position').order('position').order('name');
  if (error || !data || !id) return;
  const order = (data as { id: string; position: number }[]).map((row) => row.id);
  const from = order.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  const current = new Map((data as { id: string; position: number }[]).map((row) => [row.id, row.position]));
  for (const [position, sectionId] of order.entries()) {
    if (current.get(sectionId) !== position) await supabase.from('sections').update({ position }).eq('id', sectionId);
  }
  refresh();
}
