-- PressCompass Plan 4 (public site): read functions for the site.
-- The site calls these with the publishable key (role anon). They run as the caller, so Row Level Security
-- still applies, and they also filter on "published and due" themselves: staff calling them get the same
-- public view, never drafts. Each returns JSON shaped for the page that renders it.

-- An image from the media library, or null.
create or replace function public.site_image(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('publicId', m.public_id, 'width', m.width, 'height', m.height, 'alt', m.alt, 'credit', m.credit)
  from public.media m
  where m.id = p_id;
$$;

-- True when an article row is published and due.
create or replace function public.site_is_live(p_status public.article_status, p_published_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'published' and p_published_at is not null and p_published_at <= now();
$$;

-- One published article as a card for lists, or null.
create or replace function public.site_card(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'title', a.title,
    'slug', a.slug,
    'type', a.type,
    'kicker', a.kicker_label,
    'standfirst', a.standfirst,
    'publishedAt', a.published_at,
    'updatedAt', a.major_update_at,
    'readingMinutes', a.reading_minutes,
    'isBreaking', a.is_breaking,
    'section', (select jsonb_build_object('name', s.name, 'slug', s.slug) from public.sections s where s.id = a.section_id),
    'authors', coalesce((
      select jsonb_agg(jsonb_build_object('name', au.name, 'slug', au.slug, 'role', au.role, 'photo', public.site_image(au.photo_media_id)) order by aa.position, au.name)
      from public.article_authors aa
      join public.authors au on au.id = aa.author_id
      where aa.article_id = a.id
    ), '[]'::jsonb),
    'lead', public.site_image(a.lead_media_id)
  )
  from public.articles a
  where a.id = p_id and public.site_is_live(a.status, a.published_at);
$$;

-- Cards for a list of article ids, in the given order.
create or replace function public.site_cards(p_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(c.card order by c.n), '[]'::jsonb)
  from (select public.site_card(i.id) as card, i.n from unnest(p_ids) with ordinality as i(id, n)) c
  where c.card is not null;
$$;

-- A page of published articles, newest first.
--   p_kind 'latest': every article (p_since limits to articles published after that moment)
--   p_kind 'section' | 'author' | 'tag': the articles of that section, author or tag (by slug)
-- Returns {subject, total, rows}, or null when the section, author or tag does not exist, and for authors
-- and tags that have no published article.
create or replace function public.site_list(
  p_kind text,
  p_slug text default null,
  p_limit integer default 24,
  p_offset integer default 0,
  p_since timestamptz default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_id uuid;
  v_subject jsonb;
  v_total integer;
  v_ids uuid[];
begin
  if p_kind = 'section' then
    select s.id, jsonb_build_object('name', s.name, 'slug', s.slug, 'description', s.description)
    into v_id, v_subject from public.sections s where s.slug = p_slug;
  elsif p_kind = 'author' then
    select au.id, jsonb_build_object('name', au.name, 'slug', au.slug, 'role', au.role, 'bio', au.bio, 'links', au.links, 'photo', public.site_image(au.photo_media_id))
    into v_id, v_subject from public.authors au where au.slug = p_slug;
  elsif p_kind = 'tag' then
    select t.id, jsonb_build_object('name', t.name, 'slug', t.slug, 'description', t.description)
    into v_id, v_subject from public.tags t where t.slug = p_slug;
  elsif p_kind <> 'latest' then
    raise exception 'unknown list kind %', p_kind using errcode = '22023';
  end if;
  if p_kind <> 'latest' and v_id is null then
    return null;
  end if;

  with matching as (
    select a.id, a.published_at
    from public.articles a
    where public.site_is_live(a.status, a.published_at)
      and (p_since is null or a.published_at >= p_since)
      and case p_kind
        when 'section' then a.section_id = v_id
        when 'author' then exists (select 1 from public.article_authors aa where aa.article_id = a.id and aa.author_id = v_id)
        when 'tag' then exists (select 1 from public.article_tags tg where tg.article_id = a.id and tg.tag_id = v_id)
        else true
      end
  )
  select
    (select count(*)::integer from matching),
    array(select m.id from matching m order by m.published_at desc, m.id limit greatest(p_limit, 0) offset greatest(p_offset, 0))
  into v_total, v_ids;

  if p_kind in ('author', 'tag') and v_total = 0 then
    return null;
  end if;
  return jsonb_build_object('subject', v_subject, 'total', v_total, 'rows', public.site_cards(v_ids));
end;
$$;

-- The front page: lead and top stories, a row per section in the navigation, and opinion.
-- Each article appears once: section rows and opinion leave out what is already shown above them.
create or replace function public.site_home(p_top integer default 5, p_per_section integer default 4, p_opinion integer default 3)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_shown uuid[];
  v_top uuid[];
  v_ids uuid[];
  v_sections jsonb := '[]'::jsonb;
  v_opinion uuid[];
  s record;
begin
  v_top := array(
    select a.id from public.articles a
    where public.site_is_live(a.status, a.published_at)
    order by a.published_at desc, a.id
    limit p_top
  );
  v_shown := v_top;

  for s in select sec.id, sec.name, sec.slug from public.sections sec where sec.in_nav order by sec.position, sec.name loop
    v_ids := array(
      select a.id from public.articles a
      where public.site_is_live(a.status, a.published_at) and a.section_id = s.id and a.id <> all(v_shown) and a.type <> 'opinion'
      order by a.published_at desc, a.id
      limit p_per_section
    );
    if cardinality(v_ids) > 0 then
      v_sections := v_sections || jsonb_build_array(jsonb_build_object('name', s.name, 'slug', s.slug, 'articles', public.site_cards(v_ids)));
      v_shown := v_shown || v_ids;
    end if;
  end loop;

  v_opinion := array(
    select a.id from public.articles a
    where public.site_is_live(a.status, a.published_at) and a.type = 'opinion' and a.id <> all(v_top)
    order by a.published_at desc, a.id
    limit p_opinion
  );

  return jsonb_build_object('top', public.site_cards(v_top), 'sections', v_sections, 'opinion', public.site_cards(v_opinion));
end;
$$;

-- One published article with everything its page shows, or null.
--   related: the editor's picks first, then the newest articles sharing a tag or the section (3 in all)
--   more: other articles from the same section that are not already related (3)
--   links: titles and addresses for the Read more cards in the body (published articles only)
--   media: images used by image blocks in the body
create or replace function public.site_article(p_slug text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  a public.articles;
  v_related uuid[];
  v_more uuid[];
begin
  select * into a from public.articles x where x.slug = p_slug and public.site_is_live(x.status, x.published_at);
  if not found then
    return null;
  end if;

  v_related := array(
    select r.related_id from public.article_related r
    join public.articles x on x.id = r.related_id
    where r.article_id = a.id and public.site_is_live(x.status, x.published_at)
    order by r.position
    limit 3
  );
  if cardinality(v_related) < 3 then
    v_related := v_related || array(
      select x.id from public.articles x
      where public.site_is_live(x.status, x.published_at) and x.id <> a.id and x.id <> all(v_related)
        and (
          exists (
            select 1 from public.article_tags mine join public.article_tags theirs on theirs.tag_id = mine.tag_id
            where mine.article_id = a.id and theirs.article_id = x.id
          )
          or x.section_id = a.section_id
        )
      order by
        (select count(*) from public.article_tags mine join public.article_tags theirs on theirs.tag_id = mine.tag_id
         where mine.article_id = a.id and theirs.article_id = x.id) desc,
        x.published_at desc, x.id
      limit 3 - cardinality(v_related)
    );
  end if;

  v_more := array(
    select x.id from public.articles x
    where public.site_is_live(x.status, x.published_at) and x.section_id = a.section_id and x.id <> a.id and x.id <> all(v_related)
    order by x.published_at desc, x.id
    limit 3
  );

  return public.site_card(a.id) || jsonb_build_object(
    'body', a.body,
    'sources', a.sources,
    'leadCaption', a.lead_caption,
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) order by t.name)
      from public.article_tags tg join public.tags t on t.id = tg.tag_id
      where tg.article_id = a.id
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(public.site_image(m.id) || jsonb_build_object('id', m.id))
      from public.media m
      where m.id in (select public.body_media_ids(a.body))
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'slug', x.slug, 'section', s.slug))
      from public.articles x
      left join public.sections s on s.id = x.section_id
      where public.site_is_live(x.status, x.published_at)
        and x.id::text in (
          select v #>> '{}' from jsonb_path_query(a.body, 'lax $.content[*] ? (@.type == "readMore").attrs.articleId') as v
        )
    ), '[]'::jsonb),
    'related', public.site_cards(v_related),
    'more', public.site_cards(v_more)
  );
end;
$$;

-- Full-text search over published articles (headline, standfirst, text), best match first.
-- Returns {total, rows}; an empty or stop-word-only query finds nothing.
create or replace function public.site_search(p_query text, p_limit integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_query tsquery;
  v_total integer;
  v_ids uuid[];
begin
  v_query := websearch_to_tsquery('english', left(coalesce(p_query, ''), 200));
  if numnode(v_query) = 0 then
    return jsonb_build_object('total', 0, 'rows', '[]'::jsonb);
  end if;
  with matching as (
    select a.id, a.published_at, ts_rank(a.search, v_query) as rank
    from public.articles a
    where public.site_is_live(a.status, a.published_at) and a.search @@ v_query
  )
  select
    (select count(*)::integer from matching),
    array(select m.id from matching m order by m.rank desc, m.published_at desc, m.id limit greatest(p_limit, 0) offset greatest(p_offset, 0))
  into v_total, v_ids;
  return jsonb_build_object('total', v_total, 'rows', public.site_cards(v_ids));
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.site_image(uuid)',
    'public.site_is_live(public.article_status, timestamptz)',
    'public.site_card(uuid)',
    'public.site_cards(uuid[])',
    'public.site_list(text, text, integer, integer, timestamptz)',
    'public.site_home(integer, integer, integer)',
    'public.site_article(text)',
    'public.site_search(text, integer, integer)',
    -- Pure helper from Plan 3, needed by site_article for body images.
    'public.body_media_ids(jsonb)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end;
$$;
