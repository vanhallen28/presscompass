# PressCompass: rules for agents

English-language news site about Indonesia with its own CMS (the Newsroom). Next.js on Vercel Hobby,
Supabase Free (Postgres, Auth), Cloudinary Free for images. No Docker anywhere. Node 26, npm only.

Read first: `docs/specs/2026-11-13-presscompass-design.md` (spec), the current plan in `docs/plans/`,
and `AGENTS.md` (this Next.js version differs from training data: read `node_modules/next/dist/docs/`).

## Language

- Everything a reader or the Newsroom user sees is **English** (British spelling, sentence case, no exclamation marks).
- Owner documents (`README.md`, `CHANGELOG.md`, `docs/ops/`, plans) are **Indonesian**.
- Code, comments, commit messages and test names are English.

## Architecture rules

- Supabase is reached only with the project's own keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (`sb_publishable_`), `SUPABASE_SECRET_KEY` (`sb_secret_`, server only). Legacy `anon`/`service_role` JWT keys are rejected.
- Three clients in `src/lib/supabase/clients.ts`: `createPublicClient` (site reads, anon + RLS), `createSessionClient`
  (Newsroom, authenticated + `is_staff()`), `createAdminClient` (secret key: cron, indexing, reader forms). Never import
  these from client components.
- One Supabase project serves production, Vercel Preview and the owner's computer (v0.1.1). Anything that talks to
  outside services (Google, IndexNow) must use a fake adapter outside Vercel Production. `src/instrumentation.ts`
  refuses to start when `app_meta.project` is not `presscompass` (wrong keys or migrations missing).
- Every table has Row Level Security. A migration that adds a table also adds its policies and a test in `tests/db/`.
- Migrations live in `supabase/migrations/`, are additive, and are applied with `npm run db:push` (Supabase CLI, no Docker).
- Every protected Newsroom layout, page and Server Action calls `requireStaff()`. `src/proxy.ts` is only an optimistic check.
- Cache Components is on. Newsroom segments export `instant = false`; anything that reads the session goes through
  `createSessionClient()`, which calls `connection()` first.
- Next keeps recently visited pages in the DOM (hidden) for instant back navigation, so never hard-code element
  ids in Newsroom components: use `useId()` (client) or `aria-label` (server), or labels point at a hidden page's field.
- Design tokens come from `src/styles/tokens.json` (the design system). Run `npm run tokens` after editing it.
  Components use the CSS variables and the `.type-*` classes, never hard-coded colours.

## Article body

- The stored body is the editor's JSON restricted to `src/lib/doc/schema.ts`. Four places must agree when a block is
  added or changed: the schema, `src/lib/doc/sanitize.ts` (runs on every save), the Tiptap extensions in
  `src/components/newsroom/editor/extensions.ts`, and `src/modules/content/ArticleBody.tsx` (renders it, no raw HTML).
- ProseMirror keeps attributes in null-prototype objects, which Server Action arguments drop: the editor sends
  `JSON.parse(JSON.stringify(editor.getJSON()))`.
- Saving goes through the SQL function `save_article` (version check, slug, relations, revision) via `prepareSave()`.
  Status rules live in `src/modules/editor/status.ts`, publish rules in `rules.ts`.

## Media (Cloudinary)

- Files live on Cloudinary; the `media` table keeps the public ID, size, alt text, default caption and credit.
  Alt text belongs to the image (one per image); captions belong to each use (`articles.lead_caption`, image block attrs).
- Uploads go straight from the browser to Cloudinary with fields signed by the `prepareUpload` Server Action
  (`src/modules/media/cloudinary.ts`). `registerUpload` re-reads the resource from the Admin API; never trust the browser's
  sizes. Public IDs stay under `presscompass/images/`.
- Readers' images use `CloudImage` (`<img srcset>` built by `src/lib/media/url.ts`), not `next/image`: always pass
  `sizes`, and `priority` only for the one LCP image.
- Without Cloudinary keys the app still runs (`uploadsReady()` is false); never throw at startup for them.
- Deleting removes the row first, then the Cloudinary asset, and only when `media_usage()` is empty.
- E2E uses the fake Cloudinary in `tests/fake-supabase/cloudinary.mjs` (same signatures, Admin API, delivery).

## Tests (all without Docker)

- `npm test`: unit (Vitest).
- `npm run test:db`: migrations + RLS on plain PostgreSQL with a Supabase stub (`tests/db/supabase-stub.sql`).
  Locally: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres`.
- `npm run test:e2e`: Playwright against a production build and the fake Supabase in `tests/fake-supabase/`
  (fake Auth + a Data API that runs real SQL on a fresh local PostgreSQL database `presscompass_e2e`).
  Locally you can use an installed Chrome: `PW_CHROME_PATH=/usr/bin/google-chrome`.
- Locators for alerts are scoped to `main`: Next.js renders its own route announcer with `role="alert"`.
- E2E locators use roles (`getByRole`), not `getByLabel`: hidden, kept-alive pages still match labels.
- `npm run fake:supabase` plus `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dev npm run dev`
  runs the site against the fake Supabase for local checks (user `owner@example.com`, password in `tests/fake-supabase/auth.mjs`).

## Delivering updates to the owner

- Each finished plan ships as `presscompass-vX.Y.Z.zip`: a clean clone of `main` with history and the version tag,
  no `.env`, no `node_modules`. `package.json` version, tag and `CHANGELOG.md` match.
- Terminal commands for the owner use npm and contain no `#` comments (zsh passes them on as arguments).
- The owner pushes from their Mac. Install commands end with `git commit --amend --no-edit --reset-author` before
  `git push`, because Vercel Hobby only deploys commits authored by the account owner.
