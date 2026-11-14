-- PressCompass v0.6.1 (Vercel Pro): redirects served by Vercel's CDN (bulk redirects), so readers and search
-- engines get a real 308 with a Location header on every visit.
--   cdn_redirects(): the permanent redirects whose old address shows nothing today (secret key only)
--   cdn_redirects_state(): the last sync with Vercel, for the Newsroom Redirects page (staff)
-- The state itself is kept in app_meta (key 'cdn_redirects'), which only the secret key reaches.

-- A redirect from an address that has a page again (an article moved back, a manual redirect from a live
-- section) is left to the site, which shows the page: the CDN would otherwise send readers away from it.
create or replace function public.cdn_redirects()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('source', r.from_path, 'destination', r.to_path) order by r.from_path), '[]'::jsonb)
  from public.redirects r
  where r.code in (301, 308)
    and r.to_path <> ''
    and r.from_path <> r.to_path
    and not exists (
      select 1 from public.articles a join public.sections s on s.id = a.section_id
      where public.site_is_live(a.status, a.published_at) and '/' || s.slug || '/' || a.slug = r.from_path
    )
    and not exists (select 1 from public.sections s where '/' || s.slug = r.from_path)
    and not exists (select 1 from public.pages p where p.status = 'published' and '/' || p.slug = r.from_path)
    and not exists (select 1 from public.authors au where '/author/' || au.slug = r.from_path)
    and not exists (select 1 from public.tags t where '/tag/' || t.slug = r.from_path);
$$;
revoke all on function public.cdn_redirects() from public, anon, authenticated;
grant execute on function public.cdn_redirects() to service_role;

create or replace function public.cdn_redirects_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.newsroom_allowed() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return (select m.value from public.app_meta m where m.key = 'cdn_redirects');
end;
$$;
revoke all on function public.cdn_redirects_state() from public, anon;
grant execute on function public.cdn_redirects_state() to authenticated, service_role;
