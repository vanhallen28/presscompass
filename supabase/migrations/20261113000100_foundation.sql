-- PressCompass schema v1 (Plan 1, Foundation).
-- Content tables for the Newsroom with Row Level Security on every table:
--   anon (publishable key, no session)    reads published content only, writes nothing;
--   authenticated (Newsroom session)       reads and writes everything when public.is_staff() is true;
--   service_role (secret key, server only) bypasses RLS for cron, indexing and reader forms.

-- ---------------------------------------------------------------- helpers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- staff and app meta

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);
comment on table public.staff is 'Newsroom users. Rows are added with `npm run staff:grant` (secret key) or the SQL Editor.';

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated, service_role;

create table public.app_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
comment on table public.app_meta is 'System values. `environment` marks the project as production or preview (src/lib/environment-guard.ts).';

-- ---------------------------------------------------------------- taxonomy and people

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    check (slug not in ('page', 'author', 'tag', 'search', 'newsletter', 'newsroom', 'api', 'feed', 'sitemaps')),
  description text not null default '',
  position integer not null default 0,
  in_nav boolean not null default true,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  kind text not null default 'image' check (kind in ('image')),
  format text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes integer not null check (bytes >= 0),
  alt text not null default '',
  caption text not null default '',
  credit text not null default '',
  original_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.media.public_id is 'Cloudinary public ID. The file itself lives on Cloudinary.';

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  role text not null default '',
  bio text not null default '',
  photo_media_id uuid references public.media (id) on delete set null,
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- articles

create type public.article_status as enum ('draft', 'review', 'scheduled', 'published', 'archived');
create type public.article_type as enum ('news', 'analysis', 'explainer', 'opinion', 'feature');

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  section_id uuid references public.sections (id) on delete restrict,
  type public.article_type not null default 'news',
  kicker_label text not null default '',
  standfirst text not null default '',
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  body_text text not null default '',
  lead_media_id uuid references public.media (id) on delete set null,
  lead_caption text not null default '',
  status public.article_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  major_update_at timestamptz,
  is_breaking boolean not null default false,
  seo jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  word_count integer not null default 0,
  reading_minutes integer not null default 0,
  version integer not null default 1,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(standfirst, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_needs_time check (status <> 'scheduled' or scheduled_at is not null),
  constraint published_needs_time check (status <> 'published' or published_at is not null)
);
create index articles_status_published_idx on public.articles (status, published_at desc);
create index articles_section_idx on public.articles (section_id, published_at desc);
create index articles_search_idx on public.articles using gin (search);

create table public.article_authors (
  article_id uuid not null references public.articles (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete restrict,
  position integer not null default 0,
  primary key (article_id, author_id)
);
create index article_authors_author_idx on public.article_authors (author_id);

create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (article_id, tag_id)
);
create index article_tags_tag_idx on public.article_tags (tag_id);

create table public.article_related (
  article_id uuid not null references public.articles (id) on delete cascade,
  related_id uuid not null references public.articles (id) on delete cascade,
  position integer not null default 0,
  primary key (article_id, related_id),
  check (article_id <> related_id)
);

create table public.article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  snapshot jsonb not null,
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index article_revisions_article_idx on public.article_revisions (article_id, created_at desc);

-- ---------------------------------------------------------------- pages, layouts, redirects

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    check (slug not in ('page', 'author', 'tag', 'search', 'newsletter', 'newsroom', 'api', 'feed', 'sitemaps')),
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  seo jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_published_needs_time check (status <> 'published' or published_at is not null)
);

create table public.layouts (
  key text primary key check (key in ('home', 'nav', 'site', 'seo')),
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
comment on table public.layouts is 'Editable site layout and settings. The site reads only `published`; Publish in the Newsroom copies draft to published.';

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique check (from_path ~ '^/' and from_path !~ '^//'),
  to_path text not null default '' check (to_path = '' or to_path ~ '^/'),
  code smallint not null default 308 check (code in (301, 308, 410)),
  auto boolean not null default false,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code = 410 or to_path <> '')
);

-- ---------------------------------------------------------------- updated_at triggers

create trigger sections_updated_at before update on public.sections for each row execute function public.set_updated_at();
create trigger tags_updated_at before update on public.tags for each row execute function public.set_updated_at();
create trigger media_updated_at before update on public.media for each row execute function public.set_updated_at();
create trigger authors_updated_at before update on public.authors for each row execute function public.set_updated_at();
create trigger articles_updated_at before update on public.articles for each row execute function public.set_updated_at();
create trigger pages_updated_at before update on public.pages for each row execute function public.set_updated_at();
create trigger layouts_updated_at before update on public.layouts for each row execute function public.set_updated_at();
create trigger redirects_updated_at before update on public.redirects for each row execute function public.set_updated_at();
create trigger app_meta_updated_at before update on public.app_meta for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- row level security

alter table public.staff enable row level security;
alter table public.app_meta enable row level security;
alter table public.sections enable row level security;
alter table public.tags enable row level security;
alter table public.media enable row level security;
alter table public.authors enable row level security;
alter table public.articles enable row level security;
alter table public.article_authors enable row level security;
alter table public.article_tags enable row level security;
alter table public.article_related enable row level security;
alter table public.article_revisions enable row level security;
alter table public.pages enable row level security;
alter table public.layouts enable row level security;
alter table public.redirects enable row level security;

-- staff: each user may see their own row (to check access); only the secret key writes.
create policy staff_read_own on public.staff for select to authenticated using (user_id = (select auth.uid()));

-- app_meta: no policies, so only the secret key (service_role) reaches it.

-- Taxonomy, people, media and redirects are public; only staff write.
create policy sections_read on public.sections for select to anon, authenticated using (true);
create policy sections_write on public.sections for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy tags_read on public.tags for select to anon, authenticated using (true);
create policy tags_write on public.tags for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy authors_read on public.authors for select to anon, authenticated using (true);
create policy authors_write on public.authors for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy media_read on public.media for select to anon, authenticated using (true);
create policy media_write on public.media for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy redirects_read on public.redirects for select to anon, authenticated using (true);
create policy redirects_write on public.redirects for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Articles: published (and due) rows are public; staff see and write everything.
create or replace function public.article_is_public(article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published' and a.published_at <= now()
  );
$$;
revoke all on function public.article_is_public(uuid) from public;
grant execute on function public.article_is_public(uuid) to anon, authenticated, service_role;

create policy articles_read on public.articles for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or (select public.is_staff()));
create policy articles_write on public.articles for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy article_authors_read on public.article_authors for select to anon, authenticated
  using (public.article_is_public(article_id) or (select public.is_staff()));
create policy article_authors_write on public.article_authors for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy article_tags_read on public.article_tags for select to anon, authenticated
  using (public.article_is_public(article_id) or (select public.is_staff()));
create policy article_tags_write on public.article_tags for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy article_related_read on public.article_related for select to anon, authenticated
  using ((public.article_is_public(article_id) and public.article_is_public(related_id)) or (select public.is_staff()));
create policy article_related_write on public.article_related for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Revisions are Newsroom-only.
create policy article_revisions_staff on public.article_revisions for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Pages: published rows are public.
create policy pages_read on public.pages for select to anon, authenticated using (status = 'published' or (select public.is_staff()));
create policy pages_write on public.pages for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Layouts: rows are readable, but anon may only select the published columns (column privileges below).
create policy layouts_read on public.layouts for select to anon, authenticated using (true);
create policy layouts_write on public.layouts for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
revoke select on public.layouts from anon;
grant select (key, published, published_at) on public.layouts to anon;

-- Nobody but the secret key touches system tables through the Data API.
revoke all on public.app_meta from anon, authenticated;
revoke insert, update, delete on public.staff from anon, authenticated;
revoke all on public.staff from anon;
revoke all on public.article_revisions from anon;

-- ---------------------------------------------------------------- starting rows

insert into public.layouts (key) values ('home'), ('nav'), ('site'), ('seo');
