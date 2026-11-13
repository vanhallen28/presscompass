-- PressCompass Plan 5 (ads and static pages).
--
-- Ads: one settings row and one row per fixed placement on the site. Only staff read or change them; the site
-- reads what it needs through site_ads(), which returns ad and tracking code only while ads are switched on.
-- The AdSense publisher ID, verification tags and ads.txt lines are returned even while ads are off, so AdSense
-- and other networks can verify the site before any ad is shown.
--
-- Pages: the pages table exists since Plan 1. A page body is stored as blocks: [{"type": "text", "body": <doc>}],
-- so the page builder of a later plan can add other block types next to it.

-- ---------------------------------------------------------------- ad settings

create table public.ad_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  consent_required boolean not null default true,
  privacy_url text not null default '' check (privacy_url = '' or privacy_url ~ '^(/[a-z0-9/-]*|https?://\S+)$'),
  label text not null default 'Advertisement' check (char_length(label) between 1 and 40),
  adsense_client text not null default '' check (adsense_client = '' or adsense_client ~ '^ca-pub-[0-9]{10,20}$'),
  adsense_auto boolean not null default false,
  meta_pixel_id text not null default '' check (meta_pixel_id = '' or meta_pixel_id ~ '^[0-9]{6,20}$'),
  head_code text not null default '' check (char_length(head_code) <= 50000),
  body_code text not null default '' check (char_length(body_code) <= 50000),
  verification_meta text not null default '' check (char_length(verification_meta) <= 5000),
  ads_txt text not null default '' check (char_length(ads_txt) <= 20000),
  updated_at timestamptz not null default now()
);

comment on table public.ad_settings is 'One row: ads switch, consent, AdSense, Meta Pixel, extra code, verification tags, ads.txt lines.';

insert into public.ad_settings default values;

create table public.ad_slots (
  placement text primary key check (
    placement in ('top', 'home_middle', 'list', 'article_inline_1', 'article_inline_2', 'article_end', 'article_rail', 'footer')
  ),
  enabled boolean not null default false,
  kind text not null default 'adsense' check (kind in ('adsense', 'gpt', 'html')),
  adsense_slot text not null default '' check (adsense_slot = '' or adsense_slot ~ '^[0-9]{6,20}$'),
  adsense_format text not null default 'display' check (adsense_format in ('display', 'in-article', 'in-feed', 'multiplex')),
  adsense_layout_key text not null default '' check (char_length(adsense_layout_key) <= 60),
  gpt_path text not null default '' check (gpt_path = '' or gpt_path ~ '^/[0-9]+(,[0-9]+)?(/[A-Za-z0-9_.-]+)+$'),
  gpt_sizes text not null default '' check (char_length(gpt_sizes) <= 200),
  html text not null default '' check (char_length(html) <= 20000),
  height_mobile integer not null default 250 check (height_mobile between 0 and 1200),
  height_desktop integer not null default 250 check (height_desktop between 0 and 1200),
  paragraph integer not null default 3 check (paragraph between 1 and 60),
  updated_at timestamptz not null default now(),
  check (not enabled or (kind = 'adsense' and adsense_slot <> '') or (kind = 'gpt' and gpt_path <> '' and gpt_sizes <> '') or (kind = 'html' and html <> ''))
);

comment on table public.ad_slots is 'Fixed ad placements on the site. Height 0 hides the slot on that screen size.';

insert into public.ad_slots (placement, height_mobile, height_desktop, paragraph) values
  ('top', 100, 90, 3),
  ('home_middle', 250, 250, 3),
  ('list', 250, 250, 3),
  ('article_inline_1', 280, 280, 3),
  ('article_inline_2', 280, 280, 8),
  ('article_end', 280, 280, 3),
  ('article_rail', 0, 600, 3),
  ('footer', 100, 90, 3);

create trigger ad_settings_updated_at before update on public.ad_settings for each row execute function public.set_updated_at();
create trigger ad_slots_updated_at before update on public.ad_slots for each row execute function public.set_updated_at();

alter table public.ad_settings enable row level security;
alter table public.ad_slots enable row level security;

-- Staff read and update the fixed rows; nobody inserts or deletes them through the Data API.
create policy ad_settings_read on public.ad_settings for select to authenticated using ((select public.is_staff()));
create policy ad_settings_update on public.ad_settings for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy ad_slots_read on public.ad_slots for select to authenticated using ((select public.is_staff()));
create policy ad_slots_update on public.ad_slots for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

revoke all on public.ad_settings, public.ad_slots from anon;
revoke insert, delete, truncate on public.ad_settings, public.ad_slots from authenticated;

-- What the site needs. Runs as its owner (the tables are staff only) and returns code only while ads are on.
create or replace function public.site_ads()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', s.enabled,
    'consentRequired', s.consent_required,
    'privacyUrl', s.privacy_url,
    'label', s.label,
    'adsenseClient', s.adsense_client,
    'verificationMeta', s.verification_meta,
    'adsTxt', s.ads_txt,
    'adsenseAuto', s.enabled and s.adsense_auto,
    'metaPixelId', case when s.enabled then s.meta_pixel_id else '' end,
    'headCode', case when s.enabled then s.head_code else '' end,
    'bodyCode', case when s.enabled then s.body_code else '' end,
    'slots', case when s.enabled then coalesce((
      select jsonb_agg(jsonb_build_object(
        'placement', a.placement,
        'kind', a.kind,
        'adsenseSlot', a.adsense_slot,
        'adsenseFormat', a.adsense_format,
        'adsenseLayoutKey', a.adsense_layout_key,
        'gptPath', a.gpt_path,
        'gptSizes', a.gpt_sizes,
        'html', a.html,
        'heightMobile', a.height_mobile,
        'heightDesktop', a.height_desktop,
        'paragraph', a.paragraph
      ) order by a.placement)
      from public.ad_slots a
      where a.enabled and (a.kind <> 'adsense' or s.adsense_client <> '')
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.ad_settings s;
$$;

-- ---------------------------------------------------------------- pages

-- The first text block of a page (its body), or an empty document.
create or replace function public.page_body(p_blocks jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select b -> 'body' from jsonb_array_elements(case when jsonb_typeof(p_blocks) = 'array' then p_blocks else '[]'::jsonb end) b
     where b ->> 'type' = 'text' limit 1),
    '{"type":"doc","content":[]}'::jsonb
  );
$$;

-- One published page by address, or null. Same image and Read more data as site_article.
create or replace function public.site_page(p_slug text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'slug', p.slug,
    'description', coalesce(p.seo ->> 'description', ''),
    'body', public.page_body(p.blocks),
    'publishedAt', p.published_at,
    'updatedAt', p.updated_at,
    'media', coalesce((
      select jsonb_agg(public.site_image(m.id) || jsonb_build_object('id', m.id))
      from public.media m
      where m.id in (select public.body_media_ids(public.page_body(p.blocks)))
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'slug', x.slug, 'section', s.slug))
      from public.articles x
      left join public.sections s on s.id = x.section_id
      where public.site_is_live(x.status, x.published_at)
        and x.id::text in (
          select v #>> '{}' from jsonb_path_query(public.page_body(p.blocks), 'lax $.content[*] ? (@.type == "readMore").attrs.articleId') as v
        )
    ), '[]'::jsonb)
  )
  from public.pages p
  where p.slug = p_slug and p.status = 'published' and p.published_at <= now();
$$;

-- Published pages for the footer, by title.
create or replace function public.site_pages()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('title', p.title, 'slug', p.slug) order by p.title), '[]'::jsonb)
  from public.pages p
  where p.status = 'published' and p.published_at <= now();
$$;

-- Articles, pages and authors that use an image (pages added to the Plan 3 version).
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

do $$
declare
  f text;
begin
  foreach f in array array['public.site_ads()', 'public.site_page(text)', 'public.site_pages()', 'public.page_body(jsonb)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end;
$$;
