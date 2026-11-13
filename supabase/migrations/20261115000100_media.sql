-- PressCompass Plan 3 (media): where each image is used, and the media library list.
-- Images are used as an article's lead image (articles.lead_media_id), as image blocks in an
-- article body ({"type": "image", "attrs": {"mediaId": ...}}) and as author photos (authors.photo_media_id).

-- Media ids of the image blocks in an article body.
create or replace function public.body_media_ids(p_body jsonb)
returns setof uuid
language sql
immutable
set search_path = ''
as $$
  select distinct (v #>> '{}')::uuid
  from jsonb_path_query(p_body, 'lax $.** ? (@.type == "image").attrs.mediaId') as v
  where (v #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- Articles and authors that use an image, for the media page and the delete check.
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
        'role', case when a.lead_media_id = p_id then 'lead' else 'body' end
      ) as item
      from public.articles a
      where a.lead_media_id = p_id or exists (select 1 from public.body_media_ids(a.body) m where m = p_id)
      union all
      select jsonb_build_object('kind', 'author', 'id', au.id, 'title', au.name, 'status', null, 'role', 'photo')
      from public.authors au
      where au.photo_media_id = p_id
    ) u
  ), '[]'::jsonb);
end;
$$;

-- The media library: newest first, searchable by alt text, caption, credit and file name,
-- with the number of articles and authors that use each image.
create or replace function public.newsroom_media(
  p_query text default null,
  p_limit integer default 24,
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

  with uses as (
    select media_id, count(distinct owner) as n
    from (
      select 'article:' || a.id as owner, a.lead_media_id as media_id from public.articles a where a.lead_media_id is not null
      union all
      select 'article:' || a.id, m from public.articles a cross join lateral public.body_media_ids(a.body) m
      union all
      select 'author:' || au.id, au.photo_media_id from public.authors au where au.photo_media_id is not null
    ) x
    group by media_id
  ),
  filtered as (
    select m.*
    from public.media m
    where coalesce(p_query, '') = ''
      or m.alt ilike v_pattern
      or m.caption ilike v_pattern
      or m.credit ilike v_pattern
      or m.original_name ilike v_pattern
  ),
  page as (
    select * from filtered order by created_at desc, id limit greatest(p_limit, 0) offset greatest(p_offset, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'public_id', p.public_id,
        'format', p.format,
        'width', p.width,
        'height', p.height,
        'bytes', p.bytes,
        'alt', p.alt,
        'caption', p.caption,
        'credit', p.credit,
        'original_name', p.original_name,
        'created_at', p.created_at,
        'uses', coalesce(u.n, 0)
      ) order by p.created_at desc, p.id)
      from page p
      left join uses u on u.media_id = p.id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.body_media_ids(jsonb)',
    'public.media_usage(uuid)',
    'public.newsroom_media(text, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;
