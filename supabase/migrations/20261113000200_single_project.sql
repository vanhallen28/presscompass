-- v0.1.1: PressCompass uses one Supabase project for production, Vercel Preview and the owner's computer.
-- The environment marker is replaced by a project marker: the app refuses to start against any
-- Supabase project that is not PressCompass's (for example point.lat's keys pasted by mistake).

delete from public.app_meta where key = 'environment';

insert into public.app_meta (key, value)
values ('project', '"presscompass"')
on conflict (key) do nothing;
