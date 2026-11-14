-- PressCompass Plan 6 (editor SEO, sitemaps, 404 log).
--   not_found_log: addresses readers reached that had no page (staff read it; only log_not_found() writes it)
--   site_seo(): the published SEO settings (layouts key 'seo')
--   site_article(): now also returns the article's SEO settings and social image
--   site_sitemap(), site_sitemap_articles(), site_news_sitemap(): what the XML sitemaps list
--   article_seo_lookup(): other articles with the same keyphrase or SEO title, and internal link suggestions
--   media_usage(): counts an image chosen as an article's social image

-- ---------------------------------------------------------------- 404 log

create table public.not_found_log (
  path text primary key check (path ~ '^/' and length(path) <= 300),
  hits integer not null default 1,
  referrer text not null default '' check (length(referrer) <= 500),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index not_found_log_last_seen_idx on public.not_found_log (last_seen desc);
comment on table public.not_found_log is 'Addresses that answered 404, counted. Written only by log_not_found() (secret key).';

alter table public.not_found_log enable row level security;
create policy not_found_log_read on public.not_found_log for select to authenticated using ((select public.is_staff()));
create policy not_found_log_delete on public.not_found_log for delete to authenticated using ((select public.is_staff()));
revoke all on public.not_found_log from anon;
revoke insert, update, truncate on public.not_found_log from authenticated;

-- Counts one 404. Ignores the Newsroom, the API and Next.js files; keeps the 1,000 most recent addresses.
create or replace function public.log_not_found(p_path text, p_referrer text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := left(split_part(coalesce(p_path, ''), '?', 1), 300);
  v_referrer text := left(coalesce(p_referrer, ''), 500);
begin
  if v_path !~ '^/' or v_path ~ '^//' or v_path ~ '^/(newsroom|api|_next)(/|$)' then
    return;
  end if;
  insert into public.not_found_log as l (path, referrer)
  values (v_path, v_referrer)
  on conflict (path) do update
    set hits = l.hits + 1,
        last_seen = now(),
        referrer = case when excluded.referrer <> '' then excluded.referrer else l.referrer end;
  delete from public.not_found_log
  where path in (select path from public.not_found_log order by last_seen desc offset 1000);
end;
$$;
revoke all on function public.log_not_found(text, text) from public, anon, authenticated;
grant execute on function public.log_not_found(text, text) to service_role;

-- ---------------------------------------------------------------- settings and articles for the site

create or replace function public.site_seo()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce((select l.published from public.layouts l where l.key = 'seo'), '{}'::jsonb);
$$;

-- True when an article may appear in sitemaps: not noindex and without a canonical pointing elsewhere.
create or replace function public.article_in_sitemap(p_seo jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((p_seo ->> 'noindex')::boolean, false) = false and coalesce(p_seo ->> 'canonical', '') = '';
$$;

-- The Plan 4 function keeps its body under a new name; site_article adds the SEO settings to it.
alter function public.site_article(text) rename to site_article_page;

create or replace function public.site_article(p_slug text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when page is null then null else page || jsonb_build_object(
    'seo', jsonb_build_object(
      'title', coalesce(a.seo ->> 'title', ''),
      'description', coalesce(a.seo ->> 'description', ''),
      'canonical', coalesce(a.seo ->> 'canonical', ''),
      'noindex', coalesce((a.seo ->> 'noindex')::boolean, false),
      'keyphrase', coalesce(a.seo ->> 'keyphrase', '')
    ),
    'ogImage', case when a.seo ->> 'ogMediaId' ~ '^[0-9a-f-]{36}$' then public.site_image((a.seo ->> 'ogMediaId')::uuid) end,
    'modifiedAt', coalesce(a.major_update_at, a.published_at)
  ) end
  from (select public.site_article_page(p_slug) as page) p
  left join public.articles a on a.id = (p.page ->> 'id')::uuid;
$$;

-- What /sitemap.xml lists: one file per month of articles, plus sections, authors, tags and pages, each with
-- the time it last changed for readers (lastmod: publication or Major update, never routine edits).
create or replace function public.site_sitemap()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with live as (
    select a.id, a.section_id, coalesce(a.major_update_at, a.published_at) as lastmod, a.published_at
    from public.articles a
    where public.site_is_live(a.status, a.published_at) and public.article_in_sitemap(a.seo)
  )
  select jsonb_build_object(
    'months', coalesce((
      select jsonb_agg(jsonb_build_object('month', m.month, 'lastmod', m.lastmod) order by m.month desc)
      from (select to_char(published_at at time zone 'UTC', 'YYYY-MM') as month, max(lastmod) as lastmod from live group by 1) m
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('slug', s.slug, 'lastmod', (select max(l.lastmod) from live l where l.section_id = s.id)) order by s.position, s.name)
      from public.sections s
    ), '[]'::jsonb),
    'authors', coalesce((
      select jsonb_agg(jsonb_build_object('slug', x.slug, 'lastmod', x.lastmod) order by x.slug)
      from (
        select au.slug, max(l.lastmod) as lastmod
        from public.authors au
        join public.article_authors aa on aa.author_id = au.id
        join live l on l.id = aa.article_id
        group by au.slug
      ) x
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('slug', x.slug, 'lastmod', x.lastmod) order by x.slug)
      from (
        select t.slug, max(l.lastmod) as lastmod
        from public.tags t
        join public.article_tags tg on tg.tag_id = t.id
        join live l on l.id = tg.article_id
        group by t.slug
      ) x
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('slug', pg.slug, 'lastmod', pg.updated_at) order by pg.slug)
      from public.pages pg
      where pg.status = 'published' and pg.published_at <= now()
    ), '[]'::jsonb),
    'lastmod', (select max(lastmod) from live)
  );
$$;

-- The articles of one month ('YYYY-MM', by first publication in UTC), newest first, with their lead image.
create or replace function public.site_sitemap_articles(p_month text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', a.slug,
    'section', s.slug,
    'lastmod', coalesce(a.major_update_at, a.published_at),
    'image', public.site_image(a.lead_media_id)
  ) order by a.published_at desc, a.id), '[]'::jsonb)
  from public.articles a
  join public.sections s on s.id = a.section_id
  where p_month ~ '^\d{4}-\d{2}$'
    and public.site_is_live(a.status, a.published_at)
    and public.article_in_sitemap(a.seo)
    and to_char(a.published_at at time zone 'UTC', 'YYYY-MM') = p_month;
$$;

-- Google News sitemap: articles first published in the last two days, at most 1,000.
create or replace function public.site_news_sitemap()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.item order by x.published_at desc), '[]'::jsonb)
  from (
    select a.published_at, jsonb_build_object('slug', a.slug, 'section', s.slug, 'title', a.title, 'publishedAt', a.published_at) as item
    from public.articles a
    join public.sections s on s.id = a.section_id
    where public.site_is_live(a.status, a.published_at)
      and public.article_in_sitemap(a.seo)
      and a.published_at > now() - interval '48 hours'
    order by a.published_at desc
    limit 1000
  ) x;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.site_seo()',
    'public.article_in_sitemap(jsonb)',
    'public.site_article(text)',
    'public.site_article_page(text)',
    'public.site_sitemap()',
    'public.site_sitemap_articles(text)',
    'public.site_news_sitemap()'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- Newsroom: SEO panel

-- For the SEO panel of one article (staff): other articles with the same keyphrase or the same SEO title
-- (archived ones left out), and published articles from the same section or tags that it does not link to yet.
create or replace function public.article_seo_lookup(
  p_id uuid,
  p_keyphrase text,
  p_title text,
  p_section uuid default null,
  p_tags uuid[] default '{}',
  p_exclude uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text := lower(btrim(coalesce(p_keyphrase, '')));
  v_title text := lower(btrim(coalesce(p_title, '')));
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'keyphrase', case when v_key = '' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'status', a.status) order by a.updated_at desc)
      from public.articles a
      where a.id <> p_id and a.status <> 'archived' and lower(btrim(coalesce(a.seo ->> 'keyphrase', ''))) = v_key
    ), '[]'::jsonb) end,
    'title', case when v_title = '' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'status', a.status) order by a.updated_at desc)
      from public.articles a
      where a.id <> p_id and a.status <> 'archived' and lower(btrim(coalesce(nullif(a.seo ->> 'title', ''), a.title))) = v_title
    ), '[]'::jsonb) end,
    'suggestions', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'path', x.path) order by x.shared desc, x.published_at desc)
      from (
        select a.id, a.title, a.published_at, public.article_path(a.section_id, a.slug) as path,
               (select count(*) from public.article_tags tg where tg.article_id = a.id and tg.tag_id = any(coalesce(p_tags, '{}'))) as shared
        from public.articles a
        where a.id <> p_id
          and not (a.id = any(coalesce(p_exclude, '{}')))
          and public.site_is_live(a.status, a.published_at)
          and (a.section_id = p_section or exists (select 1 from public.article_tags tg where tg.article_id = a.id and tg.tag_id = any(coalesce(p_tags, '{}'))))
        order by shared desc, a.published_at desc
        limit 6
      ) x
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.article_seo_lookup(uuid, text, text, uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.article_seo_lookup(uuid, text, text, uuid, uuid[], uuid[]) to authenticated, service_role;

create or replace function public.media_usage(p_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(u.item order by u.item ->> 'kind', u.item ->> 'title')
    from (
      select jsonb_build_object(
        'kind', 'article',
        'id', a.id,
        'title', a.title,
        'status', a.status,
        'role', case when a.lead_media_id = p_id then 'lead' when a.seo ->> 'ogMediaId' = p_id::text then 'social' else 'body' end
      ) as item
      from public.articles a
      where a.lead_media_id = p_id
         or a.seo ->> 'ogMediaId' = p_id::text
         or exists (select 1 from public.body_media_ids(a.body) m where m = p_id)
      union all
      select jsonb_build_object('kind', 'page', 'id', pg.id, 'title', pg.title, 'status', pg.status, 'role', 'body')
      from public.pages pg
      where exists (select 1 from public.body_media_ids(public.page_body(pg.blocks)) m where m = p_id)
      union all
      select jsonb_build_object('kind', 'author', 'id', au.id, 'title', au.name, 'status', null, 'role', 'photo')
      from public.authors au
      where au.photo_media_id = p_id
    ) u
  ), '[]'::jsonb);
end;
$$;
