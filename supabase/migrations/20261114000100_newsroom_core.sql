-- PressCompass Plan 2 (Newsroom core): saving articles, the status flow, revisions and automatic redirects.
-- Every function runs with the caller's rights (security invoker), so Row Level Security still applies,
-- and refuses callers who are not Newsroom staff (or the secret key). Anonymous visitors cannot call them.

-- ---------------------------------------------------------------- access

create or replace function public.newsroom_allowed()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select public.is_staff()) or current_user = 'service_role';
$$;

-- ---------------------------------------------------------------- version for conflict checks

create or replace function public.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger articles_version before update on public.articles
  for each row execute function public.bump_version();

-- ---------------------------------------------------------------- automatic redirects

-- Adds a 308 redirect and keeps chains one hop long. When `p_to` was itself redirected away
-- (the address is coming back), that redirect is removed.
create or replace function public.add_redirect(p_from text, p_to text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_from = p_to then
    return;
  end if;
  delete from public.redirects where from_path = p_to;
  update public.redirects set to_path = p_to where to_path = p_from and code <> 410;
  insert into public.redirects (from_path, to_path, code, auto)
  values (p_from, p_to, 308, true)
  on conflict (from_path) do update set to_path = excluded.to_path, code = 308, auto = true;
end;
$$;

create or replace function public.article_path(p_section uuid, p_slug text)
returns text
language sql
stable
set search_path = ''
as $$
  select '/' || s.slug || '/' || p_slug from public.sections s where s.id = p_section;
$$;

create or replace function public.articles_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and new.status = 'published' then
    perform public.add_redirect(public.article_path(old.section_id, old.slug), public.article_path(new.section_id, new.slug));
  end if;
  return null;
end;
$$;

create trigger articles_redirect after update of slug, section_id on public.articles
  for each row execute function public.articles_redirect();

create or replace function public.sections_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a record;
begin
  if new.slug <> old.slug then
    perform public.add_redirect('/' || old.slug, '/' || new.slug);
    for a in select slug from public.articles where section_id = new.id and status = 'published' loop
      perform public.add_redirect('/' || old.slug || '/' || a.slug, '/' || new.slug || '/' || a.slug);
    end loop;
  end if;
  return null;
end;
$$;

create trigger sections_redirect after update of slug on public.sections
  for each row execute function public.sections_redirect();

create or replace function public.tags_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug <> old.slug and exists (
    select 1 from public.article_tags t join public.articles a on a.id = t.article_id
    where t.tag_id = new.id and a.status = 'published'
  ) then
    perform public.add_redirect('/tag/' || old.slug, '/tag/' || new.slug);
  end if;
  return null;
end;
$$;

create trigger tags_redirect after update of slug on public.tags
  for each row execute function public.tags_redirect();

create or replace function public.authors_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug <> old.slug and exists (
    select 1 from public.article_authors x join public.articles a on a.id = x.article_id
    where x.author_id = new.id and a.status = 'published'
  ) then
    perform public.add_redirect('/author/' || old.slug, '/author/' || new.slug);
  end if;
  return null;
end;
$$;

create trigger authors_redirect after update of slug on public.authors
  for each row execute function public.authors_redirect();

-- ---------------------------------------------------------------- revisions

create or replace function public.article_snapshot(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'title', a.title,
    'slug', a.slug,
    'section_id', a.section_id,
    'type', a.type,
    'kicker_label', a.kicker_label,
    'standfirst', a.standfirst,
    'body', a.body,
    'lead_media_id', a.lead_media_id,
    'lead_caption', a.lead_caption,
    'is_breaking', a.is_breaking,
    'seo', a.seo,
    'sources', a.sources,
    'status', a.status,
    'scheduled_at', a.scheduled_at,
    'published_at', a.published_at,
    'authors', coalesce((select jsonb_agg(x.author_id order by x.position) from public.article_authors x where x.article_id = a.id), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(t.tag_id) from public.article_tags t where t.article_id = a.id), '[]'::jsonb),
    'related', coalesce((select jsonb_agg(r.related_id order by r.position) from public.article_related r where r.article_id = a.id), '[]'::jsonb)
  )
  from public.articles a
  where a.id = p_id;
$$;

-- Stores the article as it is now. With `p_throttle`, skips when a revision was stored in the last 10 minutes.
create or replace function public.record_revision(p_id uuid, p_note text, p_throttle boolean default false)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  if p_throttle and exists (
    select 1 from public.article_revisions where article_id = p_id and created_at > now() - interval '10 minutes'
  ) then
    return false;
  end if;
  insert into public.article_revisions (article_id, snapshot, note, created_by)
  values (p_id, public.article_snapshot(p_id), coalesce(p_note, ''), auth.uid());
  return true;
end;
$$;

create or replace function public.trim_revisions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.article_revisions r
  where r.article_id = new.article_id
    and r.id not in (
      select id from public.article_revisions where article_id = new.article_id order by id desc limit 50
    );
  return null;
end;
$$;

create trigger article_revisions_trim after insert on public.article_revisions
  for each row execute function public.trim_revisions();

-- ---------------------------------------------------------------- saving

create or replace function public.free_article_slug(p_base text, p_except uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  n integer := 2;
  candidate text := p_base;
begin
  while exists (select 1 from public.articles where slug = candidate and id <> p_except) loop
    candidate := rtrim(left(p_base, 79 - length(n::text)), '-') || '-' || n;
    n := n + 1;
  end loop;
  return candidate;
end;
$$;

-- Saves the given fields (only the keys present in `p_fields`) and, when not null, replaces the
-- authors (in order), tags and related articles, all in one transaction. Refuses a save whose
-- `p_version` is no longer current. `slug_auto` lets a never-published article take a free suffix
-- when its automatic slug is taken. Returns the new version, slug and status.
create or replace function public.save_article(
  p_id uuid,
  p_version integer,
  p_fields jsonb,
  p_authors uuid[] default null,
  p_tags uuid[] default null,
  p_related uuid[] default null,
  p_revision text default null,
  p_throttle boolean default false
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_slug text := p_fields ->> 'slug';
  v_was_published boolean;
  v_row public.articles;
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select published_at is not null into v_was_published from public.articles where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;

  if v_slug is not null and exists (select 1 from public.articles where slug = v_slug and id <> p_id) then
    if coalesce((p_fields ->> 'slug_auto')::boolean, false) and not v_was_published then
      v_slug := public.free_article_slug(v_slug, p_id);
    else
      raise exception 'slug_taken' using errcode = '23505';
    end if;
  end if;

  update public.articles a set
    title = case when p_fields ? 'title' then p_fields ->> 'title' else a.title end,
    slug = coalesce(v_slug, a.slug),
    section_id = case when p_fields ? 'section_id' then (p_fields ->> 'section_id')::uuid else a.section_id end,
    type = case when p_fields ? 'type' then (p_fields ->> 'type')::public.article_type else a.type end,
    kicker_label = case when p_fields ? 'kicker_label' then p_fields ->> 'kicker_label' else a.kicker_label end,
    standfirst = case when p_fields ? 'standfirst' then p_fields ->> 'standfirst' else a.standfirst end,
    body = case when p_fields ? 'body' then p_fields -> 'body' else a.body end,
    body_text = case when p_fields ? 'body_text' then p_fields ->> 'body_text' else a.body_text end,
    word_count = case when p_fields ? 'word_count' then (p_fields ->> 'word_count')::integer else a.word_count end,
    reading_minutes = case when p_fields ? 'reading_minutes' then (p_fields ->> 'reading_minutes')::integer else a.reading_minutes end,
    lead_media_id = case when p_fields ? 'lead_media_id' then (p_fields ->> 'lead_media_id')::uuid else a.lead_media_id end,
    lead_caption = case when p_fields ? 'lead_caption' then p_fields ->> 'lead_caption' else a.lead_caption end,
    is_breaking = case when p_fields ? 'is_breaking' then (p_fields ->> 'is_breaking')::boolean else a.is_breaking end,
    seo = case when p_fields ? 'seo' then p_fields -> 'seo' else a.seo end,
    sources = case when p_fields ? 'sources' then p_fields -> 'sources' else a.sources end,
    status = case when p_fields ? 'status' then (p_fields ->> 'status')::public.article_status else a.status end,
    scheduled_at = case when p_fields ? 'scheduled_at' then (p_fields ->> 'scheduled_at')::timestamptz else a.scheduled_at end,
    published_at = case when p_fields ? 'published_at' then (p_fields ->> 'published_at')::timestamptz else a.published_at end,
    major_update_at = case when p_fields ? 'major_update_at' then (p_fields ->> 'major_update_at')::timestamptz else a.major_update_at end
  where a.id = p_id and a.version = p_version
  returning * into v_row;

  if not found then
    raise exception 'version_conflict' using errcode = 'PT409';
  end if;

  if p_authors is not null then
    delete from public.article_authors where article_id = p_id;
    insert into public.article_authors (article_id, author_id, position)
    select p_id, x.id, (x.n - 1)::integer from unnest(p_authors) with ordinality as x(id, n)
    on conflict do nothing;
  end if;

  if p_tags is not null then
    delete from public.article_tags where article_id = p_id;
    insert into public.article_tags (article_id, tag_id)
    select distinct p_id, x.id from unnest(p_tags) as x(id);
  end if;

  if p_related is not null then
    delete from public.article_related where article_id = p_id;
    insert into public.article_related (article_id, related_id, position)
    select p_id, x.id, (x.n - 1)::integer from unnest(p_related) with ordinality as x(id, n)
    where x.id <> p_id
    on conflict do nothing;
  end if;

  if p_revision is not null then
    perform public.record_revision(p_id, p_revision, p_throttle);
  end if;

  return jsonb_build_object(
    'version', v_row.version,
    'slug', v_row.slug,
    'status', v_row.status,
    'published_at', v_row.published_at,
    'scheduled_at', v_row.scheduled_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

-- ---------------------------------------------------------------- status changes

-- Moves several articles at once (list actions). Publish rules are checked by the Newsroom first.
create or replace function public.set_article_status(p_ids uuid[], p_action text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_note text;
  v_id uuid;
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  if p_action = 'publish' then
    v_note := 'Published';
    with moved as (
      update public.articles set status = 'published', published_at = coalesce(published_at, now()), scheduled_at = null
      where id = any (p_ids) and status in ('draft', 'review', 'scheduled')
      returning id
    ) select array_agg(id) into v_ids from moved;
  elsif p_action = 'unpublish' then
    v_note := 'Unpublished';
    with moved as (
      update public.articles set status = 'draft' where id = any (p_ids) and status = 'published' returning id
    ) select array_agg(id) into v_ids from moved;
  elsif p_action = 'archive' then
    v_note := 'Archived';
    with moved as (
      update public.articles set status = 'archived', scheduled_at = null where id = any (p_ids) and status <> 'archived' returning id
    ) select array_agg(id) into v_ids from moved;
  elsif p_action = 'restore' then
    v_note := 'Restored to draft';
    with moved as (
      update public.articles set status = 'draft' where id = any (p_ids) and status = 'archived' returning id
    ) select array_agg(id) into v_ids from moved;
  else
    raise exception 'unknown_action' using errcode = '22023';
  end if;

  foreach v_id in array coalesce(v_ids, '{}') loop
    perform public.record_revision(v_id, v_note);
  end loop;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

-- Publishes scheduled articles whose time has come. Called when the Newsroom opens, and by the cron
-- endpoint once the public site exists.
create or replace function public.publish_due_articles()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  update public.articles set status = 'published', published_at = scheduled_at
  where status = 'scheduled' and scheduled_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------- Newsroom reads

create or replace function public.newsroom_articles(
  p_status text default null,
  p_query text default null,
  p_section uuid default null,
  p_author uuid default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_pattern text := '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_result jsonb;
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  with filtered as (
    select a.*
    from public.articles a
    where (p_status is null or a.status::text = p_status)
      and (p_section is null or a.section_id = p_section)
      and (p_author is null or exists (select 1 from public.article_authors x where x.article_id = a.id and x.author_id = p_author))
      and (
        coalesce(p_query, '') = ''
        or a.title ilike v_pattern
        or a.slug ilike v_pattern
        or exists (
          select 1 from public.article_authors x join public.authors au on au.id = x.author_id
          where x.article_id = a.id and au.name ilike v_pattern
        )
      )
  ),
  page as (
    select * from filtered order by updated_at desc, slug limit greatest(p_limit, 0) offset greatest(p_offset, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'slug', p.slug,
        'status', p.status,
        'type', p.type,
        'is_breaking', p.is_breaking,
        'word_count', p.word_count,
        'updated_at', p.updated_at,
        'published_at', p.published_at,
        'scheduled_at', p.scheduled_at,
        'section', (select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug) from public.sections s where s.id = p.section_id),
        'authors', coalesce((
          select jsonb_agg(au.name order by x.position)
          from public.article_authors x join public.authors au on au.id = x.author_id
          where x.article_id = p.id
        ), '[]'::jsonb)
      ) order by p.updated_at desc, p.slug)
      from page p
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.article_status_counts()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return coalesce((select jsonb_object_agg(status, total) from (
    select status, count(*) as total from public.articles group by status
  ) c), '{}'::jsonb);
end;
$$;

create or replace function public.newsroom_usage()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'sections', coalesce((select jsonb_object_agg(section_id, n) from (
      select section_id, count(*) as n from public.articles where section_id is not null group by section_id
    ) s), '{}'::jsonb),
    'tags', coalesce((select jsonb_object_agg(tag_id, n) from (
      select tag_id, count(*) as n from public.article_tags group by tag_id
    ) t), '{}'::jsonb),
    'authors', coalesce((select jsonb_object_agg(author_id, n) from (
      select author_id, count(*) as n from public.article_authors group by author_id
    ) a), '{}'::jsonb)
  );
end;
$$;

-- Counts for the Dashboard. `p_day_start` is the start of today in WIB, as UTC.
create or replace function public.newsroom_dashboard(p_day_start timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'published_today', (select count(*) from public.articles where status = 'published'
                          and published_at >= p_day_start and published_at < p_day_start + interval '1 day'),
    'review', (select count(*) from public.articles where status = 'review'),
    'scheduled', (select count(*) from public.articles where status = 'scheduled'),
    'drafts', (select count(*) from public.articles where status = 'draft'),
    'next_scheduled_at', (select min(scheduled_at) from public.articles where status = 'scheduled')
  );
end;
$$;

-- ---------------------------------------------------------------- who may call what

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.newsroom_allowed()',
    'public.add_redirect(text, text)',
    'public.article_snapshot(uuid)',
    'public.record_revision(uuid, text, boolean)',
    'public.free_article_slug(text, uuid)',
    'public.save_article(uuid, integer, jsonb, uuid[], uuid[], uuid[], text, boolean)',
    'public.set_article_status(uuid[], text)',
    'public.publish_due_articles()',
    'public.newsroom_articles(text, text, uuid, uuid, integer, integer)',
    'public.article_status_counts()',
    'public.newsroom_usage()',
    'public.newsroom_dashboard(timestamptz)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;
