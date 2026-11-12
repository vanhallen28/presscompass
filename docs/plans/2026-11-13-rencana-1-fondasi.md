# Rencana 1 · Fondasi PressCompass (v0.1.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proyek Next.js PressCompass yang bisa dideploy ke Vercel Hobby: token dan komponen dasar design system, skema Supabase v1 dengan Row Level Security, login Newsroom untuk pemilik, penjaga lingkungan, dan CI, semuanya tanpa Docker.

**Architecture:** Satu aplikasi Next.js 16 (App Router, Cache Components). Supabase dicapai hanya lewat Project URL, publishable key, dan secret key, dengan tiga klien (publik, sesi Newsroom, admin). Skema berupa migrasi SQL di `supabase/migrations/` yang diterapkan Supabase CLI (`db push`, tanpa Docker) dan diuji di PostgreSQL biasa dengan tiruan bagian Supabase. Newsroom dilindungi `requireStaff()` di setiap layout, halaman, dan Server Action; `src/proxy.ts` hanya penyegar sesi dan pengalih optimistis.

**Tech Stack:** Next.js 16.4.6, React 19.3.0, @supabase/supabase-js 2.119.0, @supabase/ssr 0.12.7, TypeScript 5.9.3, Vitest 5.1.0, Playwright 1.65.0 + @axe-core/playwright 4.14.0, pg 8.23.1, Supabase CLI 3.1.0 (lewat npx), Node 26, npm 11.

**Spesifikasi:** `docs/specs/2026-11-13-presscompass-design.md` (§4 Arsitektur, §6 Model data, §7 Newsroom, §13 Keamanan, §15 Testing, §17 Rencana 1).

**Status:** kode di rencana ini sudah dibangun dan diverifikasi sebelum rencana ditulis: type check dan lint bersih, unit 19, database 15, E2E 20 (desktop dan HP, axe terang dan gelap), build produksi berhasil. Supabase CLI 3.1.0 `db push` diuji tanpa Docker (daemon Docker mati) ke PostgreSQL lokal.

## Global Constraints

- Situs dan Newsroom hanya bahasa Inggris (British English, sentence case, tanpa tanda seru). Dokumen pemilik bahasa Indonesia.
- Tanpa Docker di mana pun: pengembangan, tes, CI, migrasi.
- Node `26.x` (`.nvmrc` 26), npm saja. Versi dependensi dikunci persis di `package.json`.
- Supabase hanya lewat `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_`), `SUPABASE_SECRET_KEY` (`sb_secret_`, hanya server). Kunci lama `anon`/`service_role` (JWT `eyJ...`) ditolak.
- Row Level Security di setiap tabel; `anon` hanya membaca konten terbit dan tidak pernah menulis.
- Warna, huruf, spasi, dan radius hanya dari token design system (`src/styles/tokens.json` → `tokens.css`).
- Situs belum diindeks (`robots: noindex`) sampai Rencana 8.
- Vercel Hobby: fungsi di `sin1`, non-komersial.

## Struktur file

| Path | Tanggung jawab |
|---|---|
| `scripts/tokens.mjs` | membangun `src/styles/tokens.css` dari `tokens.json` |
| `src/app/fonts.ts`, `src/fonts/*.woff2` | Newsreader, IBM Plex Sans, IBM Plex Mono lewat `next/font/local` |
| `src/components/ds/` | Logo (SVG sebaris), Icon, Button |
| `src/lib/env.ts` | baca dan validasi env |
| `src/lib/supabase/clients.ts` | tiga klien Supabase |
| `src/lib/environment-guard.ts`, `src/instrumentation.ts` | penanda lingkungan di `app_meta` |
| `src/modules/auth/` | jalur, pesan, staf, Server Action masuk dan keluar |
| `src/proxy.ts` | penyegar sesi dan pengalih untuk `/newsroom` |
| `src/app/newsroom/` | login, kerangka Newsroom, dashboard fondasi |
| `supabase/migrations/` | skema SQL |
| `tests/unit/`, `tests/db/`, `tests/e2e/` | tes unit, database (RLS), E2E (dengan Supabase tiruan) |
| `.github/workflows/ci.yml`, `scripts/ci-postgres.sh` | CI tanpa Docker |
| `scripts/grant-staff.mjs` | beri akses Newsroom ke pengguna Supabase |

---
### Task 1: Proyek Next.js dan alat kerja

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vercel.json`
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `eslint.config.mjs`
- Create: `vitest.config.mts`
- Create: `tests/stubs/empty.ts`
- Create: `CLAUDE.md`
- Create: `AGENTS.md`
- Create: `supabase/config.toml`

**Interfaces:**
- Produces: skrip npm `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:db`, `test:e2e`, `tokens`, `db:login`, `db:link`, `db:push`, `staff:grant`; alias impor `@/*` → `src/*`; proyek Vitest `unit` dan `db`.

- [ ] **Step 1: Buat proyek dan pasang dependensi**

```bash
npx -y create-next-app@latest presscompass --ts --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-npm --yes --disable-git
cd presscompass
npm install @supabase/supabase-js @supabase/ssr server-only
npm install -D @types/node@26 vitest @playwright/test @axe-core/playwright pg @types/pg
npx -y supabase@3.1.0 init --yes
rm -rf supabase/.temp src/app/page.module.css src/app/favicon.ico public/*.svg
```

Expected: `next` 16.4.6, `react` 19.3.0. `supabase/config.toml` dibuat. `AGENTS.md` dari Next.js dibiarkan dan di-commit (`next dev` menulisnya ulang).

- [ ] **Step 2: Kunci versi dan skrip**

```json title="package.json"
{
  "name": "presscompass",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": "26.x"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --project unit",
    "test:db": "vitest run --project db",
    "test:e2e": "playwright test",
    "tokens": "node scripts/tokens.mjs",
    "db:login": "npx -y supabase@3.1.0 login",
    "db:link": "npx -y supabase@3.1.0 link",
    "db:push": "npx -y supabase@3.1.0 db push --remote",
    "staff:grant": "node --env-file=.env scripts/grant-staff.mjs"
  },
  "dependencies": {
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "2.119.0",
    "next": "16.4.6",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "server-only": "0.0.1"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.14.0",
    "@playwright/test": "1.65.0",
    "@types/node": "26.6.6",
    "@types/pg": "8.23.1",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "eslint": "9.39.5",
    "eslint-config-next": "16.4.6",
    "pg": "8.23.1",
    "typescript": "5.9.3",
    "vitest": "5.1.0"
  }
}
```

Jalankan `npm install` sekali lagi supaya `package-lock.json` mengikuti versi persis.

- [ ] **Step 3: Konfigurasi**

```ts title="next.config.ts"
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cached, tag-revalidated public pages (Plan 4) build on Cache Components.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
};

export default nextConfig;
```
```json title="vercel.json"
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"]
}
```
``` title=".nvmrc"
26
```
``` title="vitest.config.mts"
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside React Server Components; unit tests import server modules directly.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      {
        extends: true,
        test: { name: 'db', include: ['tests/db/**/*.test.ts'], environment: 'node', fileParallelism: false, testTimeout: 30000, hookTimeout: 60000 },
      },
    ],
  },
});
```
```ts title="tests/stubs/empty.ts"
export {};
```

Tambahkan ke `.gitignore` bawaan create-next-app:

```text title=".gitignore (tambahan)"
!.env.example
/playwright-report/
/test-results/
/blob-report/
/supabase/.temp/
/supabase/.branches/
```

- [ ] **Step 4: Aturan proyek untuk agen**

```markdown title="CLAUDE.md"
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
- Every table has Row Level Security. A migration that adds a table also adds its policies and a test in `tests/db/`.
- Migrations live in `supabase/migrations/`, are additive, and are applied with `npm run db:push` (Supabase CLI, no Docker).
- Every protected Newsroom layout, page and Server Action calls `requireStaff()`. `src/proxy.ts` is only an optimistic check.
- Cache Components is on. Newsroom segments export `instant = false`; anything that reads the session goes through
  `createSessionClient()`, which calls `connection()` first.
- Design tokens come from `src/styles/tokens.json` (the design system). Run `npm run tokens` after editing it.
  Components use the CSS variables and the `.type-*` classes, never hard-coded colours.

## Tests (all without Docker)

- `npm test`: unit (Vitest).
- `npm run test:db`: migrations + RLS on plain PostgreSQL with a Supabase stub (`tests/db/supabase-stub.sql`).
  Locally: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres`.
- `npm run test:e2e`: Playwright against a production build and `tests/e2e/mock-supabase.mjs`.
  Locally you can use an installed Chrome: `PW_CHROME_PATH=/usr/bin/google-chrome`.
- Locators for alerts are scoped to `main`: Next.js renders its own route announcer with `role="alert"`.

## Delivering updates to the owner

- Each finished plan ships as `presscompass-vX.Y.Z.zip`: a clean clone of `main` with history and the version tag,
  no `.env`, no `node_modules`. `package.json` version, tag and `CHANGELOG.md` match.
- Terminal commands for the owner use npm and contain no `#` comments (zsh passes them on as arguments).
- The owner pushes from their Mac. Install commands end with `git commit --amend --no-edit --reset-author` before
  `git push`, because Vercel Hobby only deploys commits authored by the account owner.
```

- [ ] **Step 5: Verifikasi dan commit**

Run: `npx tsc --noEmit && npx eslint`
Expected: tanpa keluaran galat.

```bash
git init -b main
git add -A
git commit -m "chore: scaffold Next.js 16 project with npm, Node 26 and test tooling"
```

---

### Task 2: Token desain, font, komponen dasar, halaman sementara

**Files:**
- Create: `scripts/tokens.mjs`
- Create: `src/styles/tokens.json`
- Create: `src/styles/tokens.css`
- Create: `src/fonts/*.woff2`
- Create: `src/app/fonts.ts`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/page.module.css`
- Create: `src/app/icon.svg`
- Create: `src/components/ds/logo-paths.ts`
- Create: `src/components/ds/Logo.tsx`
- Create: `src/components/ds/Icon.tsx`
- Create: `src/components/ds/Button.tsx`
- Create: `src/components/ds/Button.module.css`
- Test: `tests/unit/tokens.test.ts`

**Interfaces:**
- Consumes: `src/styles/tokens.json` dari design system (artifact PressCompass Design System, `project/tokens.json`), tujuh file font dari `project/fonts/`, `presscompass-favicon.svg` (disalin sebagai `src/app/icon.svg`).
- Produces: variabel CSS semua token (`--paper`, `--ink`, `--space-4`, `--radius-sm`, `--font-serif`, …), kelas `.type-{nama}`; `<Logo variant="primary" | "wordmark" | "symbol" tone="default" | "inverse" | "mono" height label>`; `<Icon name size label>`; `<Button variant="primary" | "secondary" | "quiet" size="md" | "sm" icon iconAfter fullWidth>`.

- [ ] **Step 1: Tulis tes token yang gagal**

```ts title="tests/unit/tokens.test.ts"
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTokensCss } from '../../scripts/tokens.mjs';

const tokens = JSON.parse(readFileSync('src/styles/tokens.json', 'utf8'));
const css = buildTokensCss(tokens);

describe('design tokens', () => {
  it('matches the committed tokens.css (run `npm run tokens` after editing tokens.json)', () => {
    expect(readFileSync('src/styles/tokens.css', 'utf8')).toBe(css);
  });

  it('declares light values on :root and dark values for data-theme and the system preference', () => {
    const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
    expect(light).toContain('--paper: #f6f4ef;');
    expect(light).toContain('--ink: #0f1e33;');
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(dark).toContain('--paper: #0b1524;');
    expect(css).toContain('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {');
  });

  it('keeps single-value tokens the same in both themes and resolves aliases', () => {
    expect(css.match(/--compass-mark: #c8432b;/g)).toHaveLength(3);
    expect(css).toContain('--link: var(--meridian);');
  });

  it('points font families at the self-hosted next/font variables', () => {
    expect(css).toContain('--font-serif: var(--font-newsreader), Georgia, "Times New Roman", serif;');
    expect(css).toContain('--font-sans: var(--font-plex-sans), "Helvetica Neue", Arial, sans-serif;');
    expect(css).toContain('--font-mono: var(--font-plex-mono), ui-monospace, Menlo, monospace;');
  });

  it('emits a class per type style, with uppercase kickers', () => {
    expect(css).toContain(".type-display {\n  font-family: var(--font-serif);\n  font-size: 56px;");
    expect(css).toMatch(/\.type-kicker \{[^}]*text-transform: uppercase;/);
    expect(css).toMatch(/\.type-quote \{[^}]*font-style: italic;/);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run --project unit tests/unit/tokens.test.ts`
Expected: FAIL (`scripts/tokens.mjs` belum ada).

- [ ] **Step 3: Generator token**

```js title="scripts/tokens.mjs"
// Builds src/styles/tokens.css from src/styles/tokens.json (the PressCompass design system tokens).
// Run with `npm run tokens` after changing tokens.json. tests/unit/tokens.test.ts fails when the CSS is stale.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// next/font/local exposes each self-hosted family as a CSS variable (src/app/fonts.ts).
const FONT_VARIABLES = {
  serif: '--font-newsreader',
  sans: '--font-plex-sans',
  mono: '--font-plex-mono',
};

function valueFor(value, theme, firstTheme) {
  const raw = typeof value === 'string' ? value : (value[theme] ?? value[firstTheme]);
  const alias = /^\{(.+)\}$/.exec(raw);
  return alias ? `var(--${alias[1]})` : raw;
}

function themeDeclarations(tokens, theme, firstTheme, indent) {
  return [...tokens.color.tokens, ...tokens.shadow.tokens]
    .map((t) => `${indent}--${t.name}: ${valueFor(t.value, theme, firstTheme)};`)
    .join('\n');
}

export function buildTokensCss(tokens) {
  const themes = tokens.color.themes.map((t) => t.id);
  const [first] = themes;
  const out = ['/* PressCompass: generated from tokens.json by scripts/tokens.mjs. Do not edit by hand. */', ''];

  out.push(`:root,\n[data-theme="${first}"] {\n  color-scheme: ${first};\n${themeDeclarations(tokens, first, first, '  ')}\n}`, '');
  for (const theme of themes.slice(1)) {
    out.push(`[data-theme="${theme}"] {\n  color-scheme: ${theme};\n${themeDeclarations(tokens, theme, first, '  ')}\n}`, '');
    out.push(
      `@media (prefers-color-scheme: ${theme}) {\n  :root:not([data-theme]) {\n    color-scheme: ${theme};\n${themeDeclarations(tokens, theme, first, '    ')}\n  }\n}`,
      '',
    );
  }

  const root = [];
  for (const family of ['spacing', 'radius', 'layout']) {
    for (const t of tokens[family].tokens) root.push(`  --${t.name}: ${t.value};`);
  }
  for (const [key, stack] of Object.entries(tokens.type.families)) {
    const fallback = stack.split(',').slice(1).join(',').trim();
    root.push(`  --font-${key}: var(${FONT_VARIABLES[key]}), ${fallback};`);
  }
  out.push(`:root {\n${root.join('\n')}\n}`, '');

  for (const group of tokens.type.groups) {
    for (const style of group.styles) {
      const decl = [
        `font-family: var(--font-${style.family ?? group.family});`,
        `font-size: ${style.fontSize};`,
        `line-height: ${style.lineHeight};`,
        `font-weight: ${style.fontWeight};`,
      ];
      if (style.letterSpacing) decl.push(`letter-spacing: ${style.letterSpacing};`);
      if (style.fontStyle) decl.push(`font-style: ${style.fontStyle};`);
      if (style.opticalSize) decl.push(`font-variation-settings: 'opsz' ${style.opticalSize};`);
      if (style.name === 'kicker') decl.push('text-transform: uppercase;');
      out.push(`.type-${style.name} {\n${decl.map((d) => `  ${d}`).join('\n')}\n}`, '');
    }
  }
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(await readFile(new URL('../src/styles/tokens.json', import.meta.url), 'utf8'));
  await writeFile(new URL('../src/styles/tokens.css', import.meta.url), buildTokensCss(tokens));
  console.log('Updated src/styles/tokens.css');
}
```

Run: `npm run tokens`
Expected: `Updated src/styles/tokens.css`.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `npx vitest run --project unit tests/unit/tokens.test.ts`
Expected: PASS (5 tes).

- [ ] **Step 5: Font, gaya dasar, layout**

```ts title="src/app/fonts.ts"
import localFont from 'next/font/local';

// Self-hosted design system faces (SIL Open Font License), Latin subset.
// tokens.css maps --font-serif / --font-sans / --font-mono onto these variables.

export const newsreader = localFont({
  src: [
    { path: '../fonts/newsreader-latin-opsz-normal.woff2', weight: '200 800', style: 'normal' },
    { path: '../fonts/newsreader-latin-opsz-italic.woff2', weight: '200 800', style: 'italic' },
  ],
  variable: '--font-newsreader',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

export const plexSans = localFont({
  src: [
    { path: '../fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
  preload: false,
});

export const plexMono = localFont({
  src: [
    { path: '../fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
});
```
```css title="src/app/globals.css"
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font: 400 15px/22px var(--font-sans);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1,
h2,
h3,
h4,
p,
figure,
blockquote {
  margin: 0;
}

a {
  color: inherit;
}

img,
svg {
  display: block;
  max-width: 100%;
}

button,
input,
textarea,
select {
  font: inherit;
  color: inherit;
}

:focus-visible {
  outline: 2px solid transparent;
  box-shadow: var(--focus-ring);
}

::selection {
  background: var(--meridian-soft);
  color: var(--ink);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}
```
```tsx title="src/app/layout.tsx"
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { siteUrl } from '@/lib/env';
import { newsreader, plexMono, plexSans } from './fonts';
import '@/styles/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'PressCompass', template: '%s · PressCompass' },
  description: 'News with a sense of direction.',
  // Not indexed until launch (Plan 8 turns indexing on).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f4ef' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1524' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Komponen dasar**

`logo-paths.ts` berisi geometri logo utama dan path wordmark Newsreader yang sudah dikurvakan (dibuat dari file logo design system; 19 KB, tidak diedit tangan). Salin apa adanya dari repo; kepalanya:

```ts title="src/components/ds/logo-paths.ts (path dipotong di sini)"
// Outlined PressCompass wordmark (Newsreader wght 560, opsz 72) and the locked primary lockup geometry.
// Generated from the design system logo files; do not edit by hand.

/** Primary logo: nib-needle symbol beside the one-line logotype. */
export const PRIMARY = {
  width: 257.8,
  height: 36.41,
  symbol: { x: 1, y: 1, size: 33.23 },
  wordmark: "M61.06 11.86Q61…",
} as const;

/** One-line logotype without the symbol. */
export const WORDMARK = {
  width: 266.92,
  height: 40.7,
  path: "M21.24 10.26Q21…",
} as const;
```

```tsx title="src/components/ds/Logo.tsx"
import { PRIMARY, WORDMARK } from './logo-paths';

// Nib-needle symbol on a 64-unit grid: ring, north half with the pen-nib slit and breather hole, south half.
const NORTH =
  'M32 10L39.5 32L24.5 32Z M31.15 15.5L32.85 15.5L32.85 26.5L31.15 26.5Z M29.9 28.6A2.1 2.1 0 1 0 34.1 28.6A2.1 2.1 0 1 0 29.9 28.6Z';
const SOUTH = 'M24.5 32L39.5 32L32 54Z';

export type LogoVariant = 'primary' | 'wordmark' | 'symbol';
export type LogoTone = 'default' | 'inverse' | 'mono';

type LogoProps = {
  variant?: LogoVariant;
  tone?: LogoTone;
  /** Rendered height in px; width follows the artwork's proportions. */
  height?: number;
  /** Accessible name. Pass an empty string when a parent link already names it. */
  label?: string;
  className?: string;
};

function NibSymbol({ x, y, size, ink, mono }: { x: number; y: number; size: number; ink: string; mono: boolean }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 64 64" overflow="visible">
      <circle cx="32" cy="32" r="29.25" fill="none" stroke={ink} strokeWidth="5.5" />
      <path d={NORTH} fill={mono ? ink : 'var(--compass-mark)'} fillRule="evenodd" />
      {mono ? <path d={SOUTH} fill="none" stroke={ink} strokeWidth="1.6" /> : <path d={SOUTH} fill={ink} />}
    </svg>
  );
}

/** The PressCompass logo as inline SVG. Ink follows the theme; the north tip is always compass-mark red. */
export function Logo({ variant = 'primary', tone = 'default', height, label = 'PressCompass', className }: LogoProps) {
  const ink = tone === 'inverse' ? 'var(--on-navy)' : 'var(--ink)';
  const mono = tone === 'mono';
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };

  if (variant === 'symbol') {
    const h = height ?? 32;
    return (
      <svg className={className} viewBox="0 0 64 64" width={h} height={h} {...a11y}>
        <NibSymbol x={0} y={0} size={64} ink={ink} mono={mono} />
      </svg>
    );
  }
  const art = variant === 'wordmark' ? WORDMARK : PRIMARY;
  const h = height ?? 28;
  return (
    <svg className={className} viewBox={`0 0 ${art.width} ${art.height}`} height={h} width={(h * art.width) / art.height} {...a11y}>
      {variant === 'primary' && <NibSymbol {...PRIMARY.symbol} ink={ink} mono={mono} />}
      <path d={variant === 'primary' ? PRIMARY.wordmark : WORDMARK.path} fill={ink} />
    </svg>
  );
}
```
```tsx title="src/components/ds/Icon.tsx"
// Outline icons on a 24-unit grid with a 1.5 stroke (design system: Iconography).
const ICONS = {
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'log-out': 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  alert: 'M12 7.5v5.5M12 16.2v.3M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  archive: 'M4 5h16v4H4zM5.5 9v10h13V9M10 13h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7v5l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  folder: 'M3 6h6l2 2h10v11H3z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  image: 'M3 5h18v14H3zM7.5 10a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M21 16l-5-5-8 8',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  search: 'M4 11a7 7 0 1 0 14 0 7 7 0 0 0-14 0M20 20l-4-4',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0M8 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  users: 'M5.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 3 3 6',
  x: 'M6 6l12 12M18 6L6 18',
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  /** Accessible name for an icon that stands alone; omit when visible text explains it. */
  label?: string;
  className?: string;
};

export function Icon({ name, size = 20, label, className }: IconProps) {
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
```
```tsx title="src/components/ds/Button.tsx"
import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'md' | 'sm';
  icon?: IconName;
  iconAfter?: IconName;
  fullWidth?: boolean;
};

/** Design system button. `secondary` is the default; use one `primary` per view. Icon-only buttons need `aria-label`. */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  fullWidth,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], fullWidth && styles.full, !children && styles.iconOnly, className]
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children && <span>{children}</span>}
      {iconAfter && <Icon name={iconAfter} size={iconSize} />}
    </button>
  );
}
```
```css title="src/components/ds/Button.module.css"
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font: 500 15px/22px var(--font-sans);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms ease-out, border-color 120ms ease-out;
}

.md {
  height: 40px;
  padding: 0 var(--space-4);
}

.sm {
  height: 32px;
  padding: 0 var(--space-3);
  font-size: 14px;
}

.primary {
  background: var(--navy);
  color: var(--on-navy);
}

.primary:hover {
  background: var(--ink-secondary);
}

.secondary {
  background: transparent;
  border-color: var(--line-strong);
  color: var(--ink);
}

.secondary:hover {
  background: var(--paper-sunken);
  border-color: var(--ink);
}

.quiet {
  background: transparent;
  color: var(--ink);
}

.quiet:hover {
  background: var(--paper-sunken);
}

.button:disabled,
.button[aria-disabled='true'] {
  cursor: not-allowed;
  color: var(--ink-muted);
  background: var(--paper-sunken);
  border-color: var(--line);
}

.full {
  width: 100%;
}

.iconOnly.md {
  width: 40px;
  padding: 0;
}

.iconOnly.sm {
  width: 32px;
  padding: 0;
}
```

- [ ] **Step 7: Halaman sementara**

```tsx title="src/app/page.tsx"
import { Logo } from '@/components/ds/Logo';
import styles from './page.module.css';

// Holding page until the public site arrives in Plan 4 (its text then comes from the Newsroom).
export default function HomePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.logo}>
        <Logo height={40} />
      </h1>
      <p className={`type-standfirst ${styles.tagline}`}>News with a sense of direction.</p>
      <p className={`type-data ${styles.note}`}>Independent, English-language news about Indonesia. Launching soon.</p>
    </main>
  );
}
```
```css title="src/app/page.module.css"
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-4);
  text-align: center;
  border-top: var(--rule-heavy) solid var(--ink);
}

.logo {
  color: var(--ink);
}

.tagline {
  color: var(--ink-secondary);
}

.note {
  color: var(--ink-muted);
  max-width: 36ch;
}
```

- [ ] **Step 8: Verifikasi dan commit**

Run: `npx tsc --noEmit && npx eslint && npx vitest run --project unit`
Expected: semua lulus.

```bash
git add -A
git commit -m "feat: design tokens, self-hosted fonts, logo, icon and button, holding page"
```

---

### Task 3: Skema Supabase v1 dengan Row Level Security

**Files:**
- Create: `supabase/migrations/20261113000100_foundation.sql`
- Create: `tests/db/supabase-stub.sql`
- Create: `tests/db/database.ts`
- Test: `tests/db/rls.test.ts`

**Interfaces:**
- Produces (SQL): tabel `staff`, `app_meta`, `sections`, `tags`, `media`, `authors`, `articles`, `article_authors`, `article_tags`, `article_related`, `article_revisions`, `pages`, `layouts` (baris `home`, `nav`, `site`, `seo`), `redirects`; enum `article_status` (`draft`, `review`, `scheduled`, `published`, `archived`) dan `article_type` (`news`, `analysis`, `explainer`, `opinion`, `feature`); fungsi `public.is_staff()`, `public.article_is_public(uuid)`, `public.set_updated_at()`.
- Produces (tes): `createTestDatabase(): Promise<TestDatabase>` dengan `as(role, userId, fn)` dan `close()`.

- [ ] **Step 1: Tiruan Supabase untuk PostgreSQL biasa**

```sql title="tests/db/supabase-stub.sql"
-- Minimal stand-in for the parts of a Supabase database the migrations rely on, so the
-- migrations and Row Level Security can be tested on plain PostgreSQL (CI runner, no Docker).
-- Mirrors Supabase: roles anon / authenticated / service_role, auth.users, auth.uid(),
-- and default privileges that grant the API roles access to new public tables.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end
$$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(current_setting('request.jwt.claim.sub', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')),
    ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
```
```ts title="tests/db/database.ts"
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, type QueryResultRow } from 'pg';

// Tests run against a throwaway database on plain PostgreSQL.
// TEST_DATABASE_URL points at a server where the user may create databases,
// e.g. postgresql://postgres:postgres@localhost:5432/postgres (CI: scripts/ci-postgres.sh).
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

export type TestDatabase = {
  client: Client;
  /** Runs `fn` inside a transaction as the given API role (and user), then rolls everything back. */
  as<T>(role: 'anon' | 'authenticated' | 'service_role', userId: string | null, fn: (q: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export type Query = <R extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;

export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `presscompass_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(readFileSync(join(__dirname, 'supabase-stub.sql'), 'utf8'));
  const dir = join(__dirname, '..', '..', 'supabase', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(readFileSync(join(dir, file), 'utf8'));
  }

  return {
    client,
    async as(role, userId, fn) {
      await client.query('begin');
      try {
        await client.query(`set local role ${role}`);
        await client.query(`select set_config('request.jwt.claims', $1, true)`, [userId ? JSON.stringify({ sub: userId, role }) : '']);
        const query: Query = async (sql, params) => (await client.query(sql, params)).rows;
        return await fn(query);
      } finally {
        await client.query('rollback');
      }
    },
    async close() {
      await client.end();
      const cleanup = new Client({ connectionString: ADMIN_URL });
      await cleanup.connect();
      await cleanup.query(`drop database if exists ${name} with (force)`);
      await cleanup.end();
    },
  };
}
```

- [ ] **Step 2: Tulis tes RLS yang gagal**

```ts title="tests/db/rls.test.ts"
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './database';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: TestDatabase;
let sectionId: string;
let authorId: string;
let publishedId: string;
let draftId: string;
let futureId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  const q = db.client;
  await q.query(`insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'stranger@example.com')`, [OWNER, STRANGER]);
  await q.query(`insert into public.staff (user_id) values ($1)`, [OWNER]);
  sectionId = (await q.query(`insert into public.sections (name, slug) values ('Business', 'business') returning id`)).rows[0].id;
  authorId = (await q.query(`insert into public.authors (name, slug) values ('Rani Prameswari', 'rani-prameswari') returning id`)).rows[0].id;
  const insertArticle = async (slug: string, status: string, publishedAt: string | null) =>
    (
      await q.query(
        `insert into public.articles (title, slug, section_id, status, published_at) values ($1, $2, $3, $4, $5) returning id`,
        [slug, slug, sectionId, status, publishedAt],
      )
    ).rows[0].id as string;
  publishedId = await insertArticle('rice-prices', 'published', '2026-11-12T12:50:00Z');
  draftId = await insertArticle('draft-story', 'draft', null);
  futureId = await insertArticle('embargoed-story', 'published', '2999-01-01T00:00:00Z');
  for (const id of [publishedId, draftId]) await q.query(`insert into public.article_authors (article_id, author_id) values ($1, $2)`, [id, authorId]);
  await q.query(`insert into public.pages (title, slug, status, published_at) values ('About', 'about', 'published', now()), ('Privacy', 'privacy', 'draft', null)`);
  await q.query(`update public.layouts set draft = '{"title":"draft"}', published = '{"title":"live"}' where key = 'home'`);
  await q.query(`insert into public.app_meta (key, value) values ('environment', '"preview"')`);
  await q.query(`insert into public.article_revisions (article_id, snapshot) values ($1, '{}')`, [draftId]);
});

afterAll(async () => {
  await db?.close();
});

describe('anon (publishable key, no session)', () => {
  it('reads only published, due articles', async () => {
    const rows = await db.as('anon', null, (q) => q<{ slug: string }>('select slug from public.articles order by slug'));
    expect(rows.map((r) => r.slug)).toEqual(['rice-prices']);
  });

  it('reads authors of published articles only', async () => {
    const rows = await db.as('anon', null, (q) => q<{ article_id: string }>('select article_id from public.article_authors'));
    expect(rows.map((r) => r.article_id)).toEqual([publishedId]);
  });

  it('reads public taxonomy and published pages', async () => {
    const sections = await db.as('anon', null, (q) => q('select slug from public.sections'));
    expect(sections).toHaveLength(1);
    const pages = await db.as('anon', null, (q) => q<{ slug: string }>('select slug from public.pages'));
    expect(pages.map((p) => p.slug)).toEqual(['about']);
  });

  it('reads the published layout but not the draft column', async () => {
    const rows = await db.as('anon', null, (q) => q<{ published: unknown }>(`select published from public.layouts where key = 'home'`));
    expect(rows[0].published).toEqual({ title: 'live' });
    await expect(db.as('anon', null, (q) => q(`select draft from public.layouts where key = 'home'`))).rejects.toThrow(/permission denied/);
  });

  it('cannot read system tables or revisions', async () => {
    await expect(db.as('anon', null, (q) => q('select * from public.app_meta'))).rejects.toThrow(/permission denied/);
    await expect(db.as('anon', null, (q) => q('select * from public.staff'))).rejects.toThrow(/permission denied/);
    await expect(db.as('anon', null, (q) => q('select * from public.article_revisions'))).rejects.toThrow(/permission denied/);
  });

  it('cannot write anything', async () => {
    await expect(db.as('anon', null, (q) => q(`insert into public.sections (name, slug) values ('Hack', 'hack')`))).rejects.toThrow(
      /row-level security/,
    );
    const updated = await db.as('anon', null, (q) => q(`update public.articles set title = 'x' where id = $1 returning id`, [publishedId]));
    expect(updated).toHaveLength(0);
  });
});

describe('authenticated user who is not staff', () => {
  it('sees only public content and cannot write', async () => {
    const rows = await db.as('authenticated', STRANGER, (q) => q<{ slug: string }>('select slug from public.articles order by slug'));
    expect(rows.map((r) => r.slug)).toEqual(['rice-prices']);
    await expect(
      db.as('authenticated', STRANGER, (q) => q(`insert into public.tags (name, slug) values ('x', 'x')`)),
    ).rejects.toThrow(/row-level security/);
    const staff = await db.as('authenticated', STRANGER, (q) => q('select * from public.staff'));
    expect(staff).toHaveLength(0);
  });
});

describe('staff (Newsroom session)', () => {
  it('sees drafts and embargoed articles', async () => {
    const rows = await db.as('authenticated', OWNER, (q) => q<{ id: string }>('select id from public.articles'));
    expect(rows.map((r) => r.id).sort()).toEqual([publishedId, draftId, futureId].sort());
  });

  it('writes content, layouts and revisions', async () => {
    await db.as('authenticated', OWNER, async (q) => {
      await q(`insert into public.tags (name, slug) values ('Food prices', 'food-prices')`);
      const rows = await q(`update public.layouts set draft = '{"title":"next"}' where key = 'home' returning key`);
      expect(rows).toHaveLength(1);
      await q(`insert into public.article_revisions (article_id, snapshot) values ($1, '{}')`, [publishedId]);
    });
  });

  it('reads its own staff row but cannot grant itself more', async () => {
    const rows = await db.as('authenticated', OWNER, (q) => q<{ role: string }>('select role from public.staff'));
    expect(rows).toEqual([{ role: 'owner' }]);
    await expect(db.as('authenticated', OWNER, (q) => q(`insert into public.staff (user_id) values ($1)`, [STRANGER]))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('still cannot read app_meta through the Data API', async () => {
    await expect(db.as('authenticated', OWNER, (q) => q('select * from public.app_meta'))).rejects.toThrow(/permission denied/);
  });
});

describe('service_role (secret key)', () => {
  it('reads and writes system tables', async () => {
    await db.as('service_role', null, async (q) => {
      const rows = await q<{ value: unknown }>(`select value from public.app_meta where key = 'environment'`);
      expect(rows[0].value).toBe('preview');
      await q(`insert into public.staff (user_id) values ($1)`, [STRANGER]);
    });
  });
});

describe('constraints', () => {
  it('rejects reserved and malformed slugs', async () => {
    await expect(db.client.query(`insert into public.sections (name, slug) values ('API', 'api')`)).rejects.toThrow(/check constraint/);
    await expect(db.client.query(`insert into public.tags (name, slug) values ('Bad', 'Bad Slug')`)).rejects.toThrow(/check constraint/);
  });

  it('requires a time for scheduled and published articles', async () => {
    await expect(
      db.client.query(`insert into public.articles (slug, status) values ('needs-time', 'scheduled')`),
    ).rejects.toThrow(/scheduled_needs_time/);
  });

  it('builds the English search vector', async () => {
    const rows = (
      await db.client.query(`select slug from public.articles where search @@ websearch_to_tsquery('english', 'rice price')`)
    ).rows;
    expect(rows.map((r) => r.slug)).toContain('rice-prices');
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npx vitest run --project db`
Expected: FAIL (folder `supabase/migrations` belum berisi skema, tabel tidak ada).

- [ ] **Step 4: Migrasi**

```sql title="supabase/migrations/20261113000100_foundation.sql"
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
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npx vitest run --project db`
Expected: PASS (15 tes).

- [ ] **Step 6: Bukti `db push` tanpa Docker**

```bash
createdb pc_push_test
npx -y supabase@3.1.0 db push --remote="postgresql://postgres:postgres@localhost:5432/pc_push_test" --yes
```

Expected (daemon Docker mati): `Applying migration 20261113000100_foundation.sql...` lalu `Finished supabase db push.` Hapus database uji sesudahnya.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Supabase schema v1 with row level security and database tests"
```

---

### Task 4: Env, klien Supabase, penjaga lingkungan

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/supabase/clients.ts`
- Create: `src/lib/environment-guard.ts`
- Create: `src/instrumentation.ts`
- Test: `tests/unit/env.test.ts`
- Test: `tests/unit/environment-guard.test.ts`

**Interfaces:**
- Produces: `publicEnv(source?) → { supabaseUrl, publishableKey }`, `secretKey(source?) → string`, `deployEnv(source?) → 'production' | 'preview'`, `siteUrl(source?) → string`, `class EnvError`; `createPublicClient()`, `async createSessionClient()`, `createAdminClient()`; `checkEnvironmentMarker(stored, current) → 'claim' | 'ok'` (melempar bila beda), `assertEnvironment()`.

- [ ] **Step 1: Tulis tes yang gagal**

```ts title="tests/unit/env.test.ts"
import { describe, expect, it } from 'vitest';
import { EnvError, deployEnv, publicEnv, secretKey, siteUrl } from '@/lib/env';

const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';

describe('publicEnv', () => {
  it('returns the origin and publishable key', () => {
    expect(
      publicEnv({ NEXT_PUBLIC_SUPABASE_URL: `${URL_OK}/`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_abc ' }),
    ).toEqual({ supabaseUrl: URL_OK, publishableKey: 'sb_publishable_abc' });
  });

  it('allows plain http only for localhost', () => {
    expect(publicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).supabaseUrl).toBe(
      'http://127.0.0.1:54321',
    );
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://example.com', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toThrow(
      /must start with https/,
    );
  });

  it('explains missing and invalid values', () => {
    expect(() => publicEnv({})).toThrow(EnvError);
    expect(() => publicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL is missing/);
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'not a url', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toThrow(/not a valid URL/);
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK })).toThrow(/PUBLISHABLE_KEY is missing/);
  });

  it('rejects legacy anon keys and other key types', () => {
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOi.legacy' })).toThrow(/legacy anon key/);
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_oops' })).toThrow(
      /must start with sb_publishable_/,
    );
  });
});

describe('secretKey', () => {
  it('accepts sb_secret_ keys only', () => {
    expect(secretKey({ SUPABASE_SECRET_KEY: 'sb_secret_abc' })).toBe('sb_secret_abc');
    expect(() => secretKey({})).toThrow(/SUPABASE_SECRET_KEY is missing/);
    expect(() => secretKey({ SUPABASE_SECRET_KEY: 'eyJservice' })).toThrow(/legacy service_role key/);
    expect(() => secretKey({ SUPABASE_SECRET_KEY: 'sb_publishable_x' })).toThrow(/must start with sb_secret_/);
  });
});

describe('deployEnv and siteUrl', () => {
  it('maps Vercel Production to production and everything else to preview', () => {
    expect(deployEnv({ VERCEL_ENV: 'production' })).toBe('production');
    expect(deployEnv({ VERCEL_ENV: 'preview' })).toBe('preview');
    expect(deployEnv({})).toBe('preview');
  });

  it('prefers the explicit site URL, then the Vercel production domain', () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://presscompass.site/' })).toBe('https://presscompass.site');
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'presscompass.site' })).toBe('https://presscompass.site');
    expect(siteUrl({})).toBe('http://localhost:3000');
  });
});
```
```ts title="tests/unit/environment-guard.test.ts"
import { describe, expect, it } from 'vitest';
import { checkEnvironmentMarker } from '@/lib/environment-guard';

describe('checkEnvironmentMarker', () => {
  it('claims an unmarked project', () => {
    expect(checkEnvironmentMarker(null, 'production')).toBe('claim');
  });

  it('accepts the matching environment', () => {
    expect(checkEnvironmentMarker('preview', 'preview')).toBe('ok');
    expect(checkEnvironmentMarker('production', 'production')).toBe('ok');
  });

  it('refuses a project that belongs to the other environment', () => {
    expect(() => checkEnvironmentMarker('production', 'preview')).toThrow(/preview deployment is connected to the production Supabase project/);
    expect(() => checkEnvironmentMarker('preview', 'production')).toThrow(/Vercel Production environment/);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run --project unit tests/unit/env.test.ts tests/unit/environment-guard.test.ts`
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implementasi**

```ts title="src/lib/env.ts"
// Reads and validates the environment. Values come from the Supabase project's own API keys
// (Settings, API Keys): the Project URL, the publishable key and the secret key.

export class EnvError extends Error {
  name = 'EnvError';
}

type Source = Record<string, string | undefined>;

const LEGACY_JWT = /^eyJ/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export type PublicEnv = { supabaseUrl: string; publishableKey: string };

/** Project URL and publishable key. Safe for the browser; used for public reads and the Newsroom session. */
export function publicEnv(source: Source = process.env): PublicEnv {
  const rawUrl = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl) throw new EnvError('NEXT_PUBLIC_SUPABASE_URL is missing. Copy the Project URL from Supabase.');
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.');
  }
  if (url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_URL must start with https://.');
  }
  if (!key) throw new EnvError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Copy the publishable key from Supabase.');
  if (LEGACY_JWT.test(key)) {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a legacy anon key. Use the publishable key (sb_publishable_...).');
  }
  if (!key.startsWith('sb_publishable_')) {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must start with sb_publishable_.');
  }
  return { supabaseUrl: url.origin, publishableKey: key };
}

/** Secret key. Server only: it bypasses Row Level Security. */
export function secretKey(source: Source = process.env): string {
  const key = source.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new EnvError('SUPABASE_SECRET_KEY is missing. Copy the secret key from Supabase.');
  if (LEGACY_JWT.test(key)) {
    throw new EnvError('SUPABASE_SECRET_KEY is a legacy service_role key. Use a secret key (sb_secret_...).');
  }
  if (!key.startsWith('sb_secret_')) throw new EnvError('SUPABASE_SECRET_KEY must start with sb_secret_.');
  return key;
}

export type DeployEnv = 'production' | 'preview';

/** Vercel Production is `production`; Preview deployments and the owner's computer share the preview project. */
export function deployEnv(source: Source = process.env): DeployEnv {
  return source.VERCEL_ENV === 'production' ? 'production' : 'preview';
}

/** Canonical site origin without a trailing slash. */
export function siteUrl(source: Source = process.env): string {
  const explicit = source.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  if (source.VERCEL_PROJECT_PRODUCTION_URL) return `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}
```
```ts title="src/lib/supabase/clients.ts"
import 'server-only';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { publicEnv, secretKey } from '@/lib/env';

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/**
 * Public reads for the site, with the publishable key and no session (`anon` role).
 * Row Level Security only returns published rows.
 */
export function createPublicClient() {
  const { supabaseUrl, publishableKey } = publicEnv();
  return createClient(supabaseUrl, publishableKey, { auth: NO_SESSION });
}

/**
 * The signed-in Newsroom user's client (`authenticated` role), with the session kept in cookies.
 * Writes are allowed only when `public.is_staff()` is true.
 */
export async function createSessionClient() {
  // Supabase Auth reads the clock (token expiry); under Cache Components that must happen at request time.
  await connection();
  const cookieStore = await cookies();
  const { supabaseUrl, publishableKey } = publicEnv();
  return createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the session on every Newsroom request.
        }
      },
    },
  });
}

/**
 * System work (cron, indexing, reader forms, logs) with the secret key.
 * Bypasses Row Level Security: never import from client components or pass its results to the browser unfiltered.
 */
export function createAdminClient() {
  const { supabaseUrl } = publicEnv();
  return createClient(supabaseUrl, secretKey(), { auth: NO_SESSION });
}
```
```ts title="src/lib/environment-guard.ts"
import type { DeployEnv } from '@/lib/env';

export type MarkerDecision = 'claim' | 'ok';

/**
 * Each Supabase project is marked with the environment that first used it (`app_meta.environment`).
 * A Preview deployment pointed at the production project (or the reverse) must refuse to start.
 */
export function checkEnvironmentMarker(stored: string | null, current: DeployEnv): MarkerDecision {
  if (stored === null) return 'claim';
  if (stored === current) return 'ok';
  throw new Error(
    `This ${current} deployment is connected to the ${stored} Supabase project. ` +
      `Check NEXT_PUBLIC_SUPABASE_URL and the Supabase keys in the Vercel ${current === 'production' ? 'Production' : 'Preview'} environment.`,
  );
}

/** Called from instrumentation.ts when a server instance starts on Vercel. */
export async function assertEnvironment(): Promise<void> {
  const { deployEnv } = await import('@/lib/env');
  const { createAdminClient } = await import('@/lib/supabase/clients');
  const current = deployEnv();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('app_meta').select('value').eq('key', 'environment').maybeSingle();
  if (error) throw new Error(`Could not read app_meta from Supabase: ${error.message}. Have the migrations been applied?`);
  const stored = typeof data?.value === 'string' ? data.value : null;
  if (checkEnvironmentMarker(stored, current) === 'claim') {
    const { error: insertError } = await supabase.from('app_meta').insert({ key: 'environment', value: current });
    if (insertError && insertError.code !== '23505') throw new Error(`Could not mark the Supabase project: ${insertError.message}`);
  }
}
```
```ts title="src/instrumentation.ts"
export async function register() {
  // Only on Vercel, only in the Node.js server runtime, never during `next build`.
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.VERCEL_ENV) return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { assertEnvironment } = await import('@/lib/environment-guard');
  await assertEnvironment();
}
```

Catatan: `createSessionClient()` memanggil `connection()` lebih dulu. Tanpa itu, Cache Components mencatat galat "encountered the unstable value `Date.now()`" saat Supabase Auth membaca jam (ditemukan di E2E).

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run --project unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: environment validation, Supabase clients and environment guard"
```

---

### Task 5: Login Newsroom dan perlindungan akses

**Files:**
- Create: `src/modules/auth/paths.ts`
- Create: `src/modules/auth/messages.ts`
- Create: `src/modules/auth/staff.ts`
- Create: `src/modules/auth/actions.ts`
- Create: `src/proxy.ts`
- Create: `src/app/newsroom/login/page.tsx`
- Create: `src/app/newsroom/login/LoginForm.tsx`
- Create: `src/app/newsroom/login/login.module.css`
- Create: `src/app/newsroom/(app)/layout.tsx`
- Create: `src/app/newsroom/(app)/page.tsx`
- Create: `src/app/newsroom/(app)/newsroom.module.css`
- Create: `playwright.config.ts`
- Create: `tests/e2e/mock-supabase.mjs`
- Test: `tests/unit/auth.test.ts`
- Test: `tests/e2e/foundation.spec.ts`

**Interfaces:**
- Consumes: `createSessionClient()`, `publicEnv()`, `deployEnv()` (Task 4); `Logo`, `Icon`, `Button` (Task 2); tabel `staff`, `sections` (Task 3).
- Produces: `NEWSROOM_HOME`, `LOGIN_PATH`, `safeNextPath(raw)`, `loginUrl(next?)`; `SIGN_IN_MESSAGES`, `signInErrorMessage(error)`; `getStaff() → Staff | null`, `requireStaff() → Staff`; Server Actions `signIn(prev, formData)`, `signOut()`; segmen Newsroom mengekspor `instant = false`.

- [ ] **Step 1: Tulis tes unit yang gagal**

```ts title="tests/unit/auth.test.ts"
import { describe, expect, it } from 'vitest';
import { SIGN_IN_MESSAGES, signInErrorMessage } from '@/modules/auth/messages';
import { loginUrl, safeNextPath } from '@/modules/auth/paths';

describe('safeNextPath', () => {
  it('keeps Newsroom paths', () => {
    expect(safeNextPath('/newsroom/articles?status=draft')).toBe('/newsroom/articles?status=draft');
    expect(safeNextPath(encodeURIComponent('/newsroom/media'))).toBe('/newsroom/media');
    expect(safeNextPath('/newsroom')).toBe('/newsroom');
  });

  it('falls back to the Newsroom home for anything else', () => {
    for (const raw of [null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil', '/business/story', '/newsroomx', '/newsroom/login', '%E0%A4%A']) {
      expect(safeNextPath(raw)).toBe('/newsroom');
    }
  });
});

describe('loginUrl', () => {
  it('adds the destination only when it is not the Newsroom home', () => {
    expect(loginUrl()).toBe('/newsroom/login');
    expect(loginUrl('/newsroom')).toBe('/newsroom/login');
    expect(loginUrl('/newsroom/articles')).toBe('/newsroom/login?next=%2Fnewsroom%2Farticles');
  });
});

describe('signInErrorMessage', () => {
  it('maps Supabase Auth errors to actionable messages', () => {
    expect(signInErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe(SIGN_IN_MESSAGES.invalidCredentials);
    expect(signInErrorMessage({ status: 400, message: 'Invalid login credentials' })).toBe(SIGN_IN_MESSAGES.invalidCredentials);
    expect(signInErrorMessage({ status: 429 })).toBe(SIGN_IN_MESSAGES.rateLimited);
    expect(signInErrorMessage({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' })).toBe(SIGN_IN_MESSAGES.unreachable);
    expect(signInErrorMessage({ name: 'EnvError', message: 'missing' })).toBe(SIGN_IN_MESSAGES.notConfigured);
    expect(signInErrorMessage({ status: 500, message: 'boom' })).toBe(SIGN_IN_MESSAGES.unknown);
  });
});
```

Run: `npx vitest run --project unit tests/unit/auth.test.ts`
Expected: FAIL.

- [ ] **Step 2: Jalur dan pesan**

```ts title="src/modules/auth/paths.ts"
export const NEWSROOM_HOME = '/newsroom';
export const LOGIN_PATH = '/newsroom/login';

/** Only same-site Newsroom paths are allowed as a post-login destination. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return NEWSROOM_HOME;
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return NEWSROOM_HOME;
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\u0000-\u001f]/.test(path)) return NEWSROOM_HOME;
  if (path !== NEWSROOM_HOME && !path.startsWith(`${NEWSROOM_HOME}/`) && !path.startsWith(`${NEWSROOM_HOME}?`)) return NEWSROOM_HOME;
  if (path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}?`) || path.startsWith(`${LOGIN_PATH}/`)) return NEWSROOM_HOME;
  return path;
}

/** Login URL that returns to `next` after signing in. */
export function loginUrl(next?: string): string {
  const target = safeNextPath(next);
  return target === NEWSROOM_HOME ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(target)}`;
}
```
```ts title="src/modules/auth/messages.ts"
// Newsroom sign-in messages (English, design system ux-copy rules: say what happened and what to do).

export const SIGN_IN_MESSAGES = {
  missingFields: 'Enter your email and password.',
  invalidCredentials: 'Email or password is incorrect.',
  rateLimited: 'Too many attempts. Wait a minute, then try again.',
  unreachable: 'We could not reach the sign-in service. Check your connection, then try again.',
  notStaff: 'This account does not have Newsroom access.',
  notConfigured: 'The Newsroom is not configured yet. Add the Supabase keys to the environment.',
  unknown: 'Sign-in failed. Try again in a moment.',
} as const;

type AuthLikeError = { name?: string; status?: number; code?: string; message?: string };

/** Maps a Supabase Auth error to a message the owner can act on. */
export function signInErrorMessage(error: AuthLikeError): string {
  if (error.name === 'EnvError') return SIGN_IN_MESSAGES.notConfigured;
  if (error.code === 'invalid_credentials' || (error.status === 400 && /invalid login credentials/i.test(error.message ?? ''))) {
    return SIGN_IN_MESSAGES.invalidCredentials;
  }
  if (error.status === 429 || error.code === 'over_request_rate_limit') return SIGN_IN_MESSAGES.rateLimited;
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || /fetch failed|network/i.test(error.message ?? '')) {
    return SIGN_IN_MESSAGES.unreachable;
  }
  return SIGN_IN_MESSAGES.unknown;
}
```

Run: `npx vitest run --project unit tests/unit/auth.test.ts`
Expected: PASS (4 tes).

- [ ] **Step 3: Staf, Server Action, proxy**

```ts title="src/modules/auth/staff.ts"
import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createSessionClient } from '@/lib/supabase/clients';
import { LOGIN_PATH } from './paths';

export type Staff = { id: string; email: string; role: 'owner' };

/** The signed-in Newsroom user, or null when signed out, not staff, or Supabase is unreachable. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  try {
    const supabase = await createSessionClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return null;
    const { data: staff, error } = await supabase.from('staff').select('role').eq('user_id', userData.user.id).maybeSingle();
    if (error || !staff) return null;
    return { id: userData.user.id, email: userData.user.email ?? '', role: staff.role as Staff['role'] };
  } catch {
    return null;
  }
});

/** Use at the top of every protected Newsroom layout, page and Server Action. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect(LOGIN_PATH);
  return staff;
}
```
```ts title="src/modules/auth/actions.ts"
'use server';

import { redirect } from 'next/navigation';
import { createSessionClient } from '@/lib/supabase/clients';
import { SIGN_IN_MESSAGES, signInErrorMessage } from './messages';
import { LOGIN_PATH, safeNextPath } from './paths';

export type SignInState = { error: string | null; email: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNextPath(String(formData.get('next') ?? ''));
  if (!email || !password) return { error: SIGN_IN_MESSAGES.missingFields, email };

  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: signInErrorMessage(error ?? {}), email };

    const { data: staff } = await supabase.from('staff').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (!staff) {
      await supabase.auth.signOut();
      return { error: SIGN_IN_MESSAGES.notStaff, email };
    }
  } catch (error) {
    return { error: signInErrorMessage(error as Error), email };
  }
  redirect(next);
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  } finally {
    redirect(LOGIN_PATH);
  }
}
```
```ts title="src/proxy.ts"
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';
import { LOGIN_PATH, loginUrl } from '@/modules/auth/paths';

const hasAuthCookie = (request: NextRequest) =>
  request.cookies.getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));

/**
 * Runs only for /newsroom (public pages stay cacheable). Refreshes the Supabase session cookie and
 * sends signed-out visitors to the login page. This is an optimistic check: every protected layout,
 * page and Server Action still calls requireStaff().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;

  if (!hasAuthCookie(request)) {
    if (isLogin) return NextResponse.next();
    return NextResponse.redirect(new URL(loginUrl(pathname + search), request.url));
  }

  let response = NextResponse.next({ request });
  try {
    const { supabaseUrl, publishableKey } = publicEnv();
    const supabase = createServerClient(supabaseUrl, publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    await supabase.auth.getUser();
  } catch {
    // Missing keys or Supabase unreachable: let the page render its own message.
  }
  return response;
}

export const config = { matcher: ['/newsroom', '/newsroom/:path*'] };
```

- [ ] **Step 4: Halaman Newsroom**

```tsx title="src/app/newsroom/login/page.tsx"
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/ds/Logo';
import { safeNextPath } from '@/modules/auth/paths';
import { getStaff } from '@/modules/auth/staff';
import { LoginForm } from './LoginForm';
import styles from './login.module.css';

// Newsroom pages read the session on every request, so they block on the server instead of
// prerendering a static shell (Cache Components).
export const instant = false;

export const metadata: Metadata = { title: 'Sign in · Newsroom' };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const destination = safeNextPath(next);
  if (await getStaff()) redirect(destination);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Logo height={26} />
          <p className={styles.label}>NEWSROOM</p>
        </div>
        <h1 className={styles.title}>Sign in</h1>
        <LoginForm next={destination} />
      </div>
    </main>
  );
}
```
```tsx title="src/app/newsroom/login/LoginForm.tsx"
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { signIn, type SignInState } from '@/modules/auth/actions';
import styles from './login.module.css';

const INITIAL: SignInState = { error: null, email: '' };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);
  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="next" value={next} />
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={styles.input} />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={styles.input} />
      </div>
      <div role="alert" aria-live="assertive" className={styles.alertSlot}>
        {state.error && (
          <p className={styles.error}>
            <Icon name="alert" size={16} />
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
```
```css title="src/app/newsroom/login/login.module.css"
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-5) var(--space-4);
  background: var(--paper-sunken);
}

.card {
  width: 100%;
  max-width: 400px;
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-top: var(--rule-heavy) solid var(--ink);
  border-radius: var(--radius-md);
  padding: var(--space-6) var(--space-5);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  color: var(--ink);
}

.label {
  font: 500 12px/16px var(--font-mono);
  letter-spacing: 0.04em;
  color: var(--ink-muted);
}

.title {
  margin: var(--space-6) 0 var(--space-5);
  font: 500 30px/36px var(--font-serif);
  font-variation-settings: 'opsz' 48;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font: 500 14px/20px var(--font-sans);
}

.input {
  height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
  font: 400 15px/22px var(--font-sans);
}

.input:hover {
  border-color: var(--ink-secondary);
}

.input:focus-visible {
  border-color: var(--meridian);
}

.alertSlot:empty {
  display: none;
}

.error {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
  font: 400 14px/20px var(--font-sans);
}

.error svg {
  flex: none;
  margin-top: 2px;
}
```
```tsx title="src/app/newsroom/(app)/layout.tsx"
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ds/Logo';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { signOut } from '@/modules/auth/actions';
import { requireStaff } from '@/modules/auth/staff';
import styles from './newsroom.module.css';

// Newsroom pages read the session on every request, so they block on the server instead of
// prerendering a static shell (Cache Components).
export const instant = false;

export const metadata: Metadata = { title: { default: 'Newsroom', template: '%s · Newsroom' } };

export default async function NewsroomLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className={styles.shell}>
      <aside className={styles.side} aria-label="Newsroom">
        <div className={styles.brand}>
          <Logo height={24} />
          <p className={styles.brandLabel}>NEWSROOM</p>
        </div>
        <nav className={styles.nav} aria-label="Newsroom sections">
          <a href="/newsroom" aria-current="page">
            <Icon name="grid" />
            Dashboard
          </a>
        </nav>
        <div className={styles.user}>
          <p className={styles.userEmail}>{staff.email}</p>
          <form action={signOut}>
            <Button type="submit" variant="quiet" size="sm" icon="log-out">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
```
```tsx title="src/app/newsroom/(app)/page.tsx"
import type { Metadata } from 'next';
import { Icon } from '@/components/ds/Icon';
import { deployEnv } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import styles from './newsroom.module.css';

export const metadata: Metadata = { title: 'Dashboard' };

async function databaseCheck(): Promise<{ ok: boolean; detail: string }> {
  try {
    const supabase = await createSessionClient();
    const { count, error } = await supabase.from('sections').select('id', { count: 'exact', head: true });
    if (error) return { ok: false, detail: error.message };
    return { ok: true, detail: `Connected. ${count ?? 0} sections.` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

const NEXT_STEPS = [
  ['v0.2.0', 'Articles, sections, tags and authors'],
  ['v0.3.0', 'Media library on Cloudinary'],
  ['v0.4.0', 'Public site'],
  ['v0.5.0', 'Homepage, navigation, pages and site settings'],
  ['v0.6.0', 'SEO tools'],
  ['v0.7.0', 'Automatic indexing and the SEO dashboard'],
] as const;

export default async function DashboardPage() {
  const staff = await requireStaff();
  const database = await databaseCheck();
  const environment = deployEnv();

  return (
    <>
      <h1 className={styles.title}>Dashboard</h1>
      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="foundation">
          <h2 id="foundation" className={styles.panelTitle}>
            Foundation
          </h2>
          <ul className={styles.checks}>
            <li>
              <Icon name={database.ok ? 'check' : 'alert'} size={16} className={database.ok ? styles.ok : styles.bad} />
              <span>
                <b>Database</b> {database.detail}
              </span>
            </li>
            <li>
              <Icon name="check" size={16} className={styles.ok} />
              <span>
                <b>Environment</b> {environment === 'production' ? 'Production' : 'Preview'}
              </span>
            </li>
            <li>
              <Icon name="check" size={16} className={styles.ok} />
              <span>
                <b>Signed in</b> {staff.email}
              </span>
            </li>
          </ul>
        </section>
        <section className={styles.panel} aria-labelledby="coming">
          <h2 id="coming" className={styles.panelTitle}>
            Coming next
          </h2>
          <ol className={styles.steps}>
            {NEXT_STEPS.map(([version, text]) => (
              <li key={version}>
                <span className={styles.version}>{version}</span>
                {text}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
```
```css title="src/app/newsroom/(app)/newsroom.module.css"
.shell {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 100vh;
}

.side {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: 20px 14px;
  background: var(--paper-sunken);
  border-right: 1px solid var(--line);
  color: var(--ink);
}

.brand {
  padding: 4px 8px;
}

.brandLabel {
  margin-top: var(--space-2);
  font: 500 12px/16px var(--font-mono);
  letter-spacing: 0.04em;
  color: var(--ink-muted);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font: 500 15px/22px var(--font-sans);
  color: var(--ink-secondary);
  text-decoration: none;
}

.nav a:hover {
  background: var(--paper);
  color: var(--ink);
}

.nav a[aria-current] {
  background: var(--paper-raised);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--line);
}

.user {
  margin-top: auto;
  padding: var(--space-4) 8px 0;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.userEmail {
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
  overflow-wrap: anywhere;
}

.main {
  min-width: 0;
  padding: var(--space-5) var(--space-6) var(--space-7);
}

.title {
  margin-bottom: var(--space-5);
  font: 500 30px/36px var(--font-serif);
  font-variation-settings: 'opsz' 48;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
  align-items: start;
}

.panel {
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5) var(--space-5);
}

.panelTitle {
  margin-bottom: var(--space-3);
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.checks,
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  color: var(--ink-secondary);
}

.checks li {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
}

.checks svg {
  flex: none;
  margin-top: 3px;
}

.checks b {
  color: var(--ink);
  font-weight: 600;
  margin-right: 4px;
}

.ok {
  color: var(--success);
}

.bad {
  color: var(--danger);
}

.steps li {
  display: flex;
  gap: var(--space-3);
}

.version {
  flex: none;
  min-width: 52px;
  font: 500 13px/22px var(--font-mono);
  color: var(--meridian);
}

@media (max-width: 1024px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .side {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    padding: 12px 16px;
  }

  .brandLabel {
    display: none;
  }

  .nav {
    flex-direction: row;
  }

  .user {
    margin: 0 0 0 auto;
    padding: 0;
    border: 0;
    flex-direction: row;
    align-items: center;
  }

  .userEmail {
    display: none;
  }

  .main {
    padding: var(--space-4);
  }
}
```

Run: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npx next build`
Expected: build berhasil; `/` statis, `/newsroom` dan `/newsroom/login` dinamis, Proxy aktif. Tanpa `instant = false`, build gagal dengan "encountered uncached or runtime data during prerendering".

- [ ] **Step 5: Tes E2E dengan Supabase tiruan**

```js title="tests/e2e/mock-supabase.mjs"
// A tiny stand-in for the Supabase Auth and Data APIs, used only by the E2E tests.
// It knows two users: the owner (staff) and a stranger (signed up, but no Newsroom access).
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 3101);
const PASSWORD = 'correct-horse-battery-staple';
const USERS = {
  'owner@example.com': { id: '11111111-1111-4111-8111-111111111111', staff: true },
  'stranger@example.com': { id: '22222222-2222-4222-8222-222222222222', staff: false },
};

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenFor = (email) => {
  const user = USERS[email];
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.sig`;
};
const emailFromToken = (header) => {
  const token = (header ?? '').replace(/^Bearer\s+/i, '');
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).email;
  } catch {
    return null;
  }
};
const userJson = (email) => ({
  id: USERS[email].id,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-11-13T00:00:00Z',
});

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};

  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    const user = USERS[body.email];
    if (!user || body.password !== PASSWORD) {
      return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    const now = Math.floor(Date.now() / 1000);
    return send(res, 200, {
      access_token: tokenFor(body.email),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: `refresh-${user.id}`,
      user: userJson(body.email),
    });
  }
  if (url.pathname === '/auth/v1/user') {
    const email = emailFromToken(req.headers.authorization);
    if (!email || !USERS[email]) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    return send(res, 200, userJson(email));
  }
  if (url.pathname === '/auth/v1/logout') return send(res, 204);

  if (url.pathname === '/rest/v1/staff') {
    const email = emailFromToken(req.headers.authorization);
    const user = email ? USERS[email] : null;
    const rows = user?.staff ? [{ user_id: user.id, role: 'owner' }] : [];
    return send(res, 200, rows);
  }
  if (url.pathname === '/rest/v1/sections') {
    return send(res, 200, req.method === 'HEAD' ? undefined : [], { 'content-range': '*/0' });
  }
  send(res, 404, { message: `Mock Supabase has no route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Mock Supabase on http://127.0.0.1:${PORT}`));
```
```ts title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

// E2E runs against a production build and a small mock of the Supabase Auth and Data APIs
// (tests/e2e/mock-supabase.mjs), so no real Supabase project is needed.
const PORT = 3100;
const MOCK_SUPABASE_PORT = 3101;
const E2E_ENV = {
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Locally you may point at an installed Chrome: PW_CHROME_PATH=/usr/bin/google-chrome
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node tests/e2e/mock-supabase.mjs',
      port: MOCK_SUPABASE_PORT,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_SUPABASE_PORT: String(MOCK_SUPABASE_PORT) },
    },
    {
      command: `npm run build && npm run start -- --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: E2E_ENV,
    },
  ],
});
```
```ts title="tests/e2e/foundation.spec.ts"
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Password the mock Supabase accepts (tests/e2e/mock-supabase.mjs).
const PASSWORD = 'correct-horse-battery-staple';

test.describe('holding page', () => {
  test('shows the logo and tagline, stays out of search engines', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('img', { name: 'PressCompass' })).toBeVisible();
    await expect(page.getByText('News with a sense of direction.')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('uses the light palette by default and the dark palette when the device prefers it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 244, 239)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 21, 36)');
  });

  test('loads the self-hosted fonts', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    expect(families.join(' ')).toMatch(/newsreader/i);
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('Newsroom access', () => {
  test('sends signed-out visitors to the login page and remembers where they were going', async ({ page }) => {
    await page.goto('/newsroom/articles?status=draft');
    await expect(page).toHaveURL(/\/newsroom\/login\?next=%2Fnewsroom%2Farticles%3Fstatus%3Ddraft$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('login page is labelled and accessible in both themes', async ({ page }) => {
    await page.goto('/newsroom/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations, `${colorScheme} theme`).toEqual([]);
    }
  });

  test('asks for both fields before contacting Supabase', async ({ page }) => {
    await page.goto('/newsroom/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Enter your email and password.');
  });

  test('rejects a wrong password and keeps the email', async ({ page }) => {
    await page.goto('/newsroom/login');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Email or password is incorrect.');
    await expect(page.getByLabel('Email')).toHaveValue('owner@example.com');
  });

  test('refuses accounts that are not Newsroom staff', async ({ page }) => {
    await page.goto('/newsroom/login');
    await page.getByLabel('Email').fill('stranger@example.com');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('This account does not have Newsroom access.');
    await page.goto('/newsroom');
    await expect(page).toHaveURL(/\/newsroom\/login/);
  });

  test('signs the owner in, shows the dashboard, and signs out', async ({ page }, testInfo) => {
    await page.goto('/newsroom');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/newsroom$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Connected. 0 sections.')).toBeVisible();
    if (testInfo.project.name === 'desktop') await expect(page.getByText('owner@example.com', { exact: true })).toBeVisible();

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations, `${colorScheme} theme`).toEqual([]);
    }

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/newsroom\/login$/);
    await page.goto('/newsroom');
    await expect(page).toHaveURL(/\/newsroom\/login/);
  });
});
```

Run: `CI=1 npx playwright test` (lokal dengan Chrome terpasang: tambahkan `PW_CHROME_PATH=/usr/bin/google-chrome`)
Expected: PASS (20 tes: 10 desktop, 10 HP). Pencari `role="alert"` dibatasi ke `main`, karena Next.js memasang pengumum rute sendiri dengan peran yang sama.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Newsroom sign-in, staff-only access and foundation dashboard"
```

---

### Task 6: CI, akses staf, dokumen pemilik

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/ci-postgres.sh`
- Create: `scripts/grant-staff.mjs`
- Create: `.env.example`
- Create: `README.md`
- Create: `CHANGELOG.md`
- Create: `docs/ops/setup.md`
- Create: `docs/specs/2026-11-13-presscompass-design.md`
- Create: `docs/plans/2026-11-13-rencana-1-fondasi.md`

**Interfaces:**
- Consumes: semua skrip npm dari Task 1; tabel `staff` dari Task 3.
- Produces: `npm run staff:grant -- email` (menulis baris `staff` dengan secret key dari `.env`); CI dua job (`check`, `e2e`).

- [ ] **Step 1: CI tanpa Docker**

```yaml title=".github/workflows/ci.yml"
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    name: Type check, lint, unit, database, build
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    env:
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
      NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:3101
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_ci
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - name: Start the runner's PostgreSQL (no Docker)
        run: bash scripts/ci-postgres.sh
      - run: npm run test:db
      - run: npm run build

  e2e:
    name: End-to-end (Playwright)
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          CI: '1'
      - name: Keep the report when tests fail
        if: failure()
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 14
```
```bash title="scripts/ci-postgres.sh"
#!/usr/bin/env bash
# Starts the PostgreSQL server that ships with the GitHub ubuntu-24.04 runner and sets the
# password used by tests/db (TEST_DATABASE_URL). No Docker and no service containers.
set -euo pipefail
sudo systemctl start postgresql.service
for _ in $(seq 1 20); do
  if pg_isready -q -h localhost; then break; fi
  sleep 1
done
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "alter user postgres password 'postgres';"
psql --version
```

Action dikunci SHA rilis (checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2). PostgreSQL adalah layanan bawaan runner ubuntu-24.04, bukan service container.

- [ ] **Step 2: Skrip akses staf**

```js title="scripts/grant-staff.mjs"
// Gives an existing Supabase Auth user access to the Newsroom.
// Usage: npm run staff:grant -- you@example.com
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env (the secret key bypasses RLS).
import { createClient } from '@supabase/supabase-js';

const email = (process.argv[2] ?? '').trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!email.includes('@')) fail('Give the email of the Supabase user, for example: npm run staff:grant -- you@example.com');
if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is missing from .env.');
if (!secret?.startsWith('sb_secret_')) fail('SUPABASE_SECRET_KEY in .env must be a secret key that starts with sb_secret_.');

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

let user = null;
for (let page = 1; !user; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) fail(`Could not list Supabase users: ${error.message}`);
  user = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}
if (!user) fail(`No Supabase user has the email ${email}. Create it first in Supabase: Authentication, Users, Add user.`);

const { error } = await supabase.from('staff').upsert({ user_id: user.id, role: 'owner' }, { onConflict: 'user_id' });
if (error) fail(`Could not save the staff row: ${error.message}. Have the migrations been applied (npm run db:push)?`);

console.log(`\n${email} can now sign in to the Newsroom at /newsroom/login.\n`);
```

Uji asap ke API tiruan: email ada → "can now sign in", exit 0; email tidak ada → pesan "Create it first", exit 1; tanpa argumen → contoh pemakaian, exit 1.

- [ ] **Step 3: Contoh env dan dokumen pemilik**

``` title=".env.example"
# Copy this file to .env and fill in the values from the Supabase project
# (Project Settings, API Keys). For your computer use the presscompass-preview project.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
SUPABASE_SECRET_KEY=sb_secret_replace_me
```
```markdown title="README.md"
# PressCompass

Media berita berbahasa Inggris tentang Indonesia di presscompass.site, lengkap dengan CMS sendiri (Newsroom) di `/newsroom`.

- **Stack:** Next.js 16 (App Router) di Vercel Hobby, Supabase Free (database dan login), Cloudinary Free (gambar, mulai v0.3.0).
- **Tanpa Docker.** Semua perintah memakai npm dan Node 26.
- **Sinkron ke Supabase** hanya lewat kunci bawaan proyek Supabase: Project URL, publishable key, dan secret key.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm ci` | memasang dependensi persis sesuai `package-lock.json` |
| `npm run dev` | menjalankan situs di http://localhost:3000 dengan proyek Supabase pratinjau dari `.env` |
| `npm run db:login` | masuk ke Supabase CLI (sekali per komputer, membuka browser) |
| `npm run db:link -- --project-ref KODE` | menautkan folder ini ke proyek Supabase (meminta password database) |
| `npm run db:push` | menerapkan migrasi baru ke proyek Supabase yang ditautkan |
| `npm run staff:grant -- email@anda.com` | memberi akses Newsroom ke pengguna Supabase |

Langkah pemasangan lengkap: `docs/ops/setup.md`. Riwayat versi: `CHANGELOG.md`.

## Tes

CI GitHub menjalankan semua tes di setiap push. Anda tidak perlu menjalankannya di komputer; centang hijau di GitHub adalah buktinya.
```
```markdown title="CHANGELOG.md"
# Riwayat versi

## v0.1.0 · 13 November 2026 · Fondasi (Rencana 1)

- Proyek Next.js 16.4.6 dengan npm dan Node 26, tanpa Docker.
- Token desain, font Newsreader dan IBM Plex (di-host sendiri), logo utama (simbol + logotype satu baris), ikon, dan tombol dari design system. Tema terang dan gelap mengikuti perangkat.
- Skema Supabase v1: rubrik, tag, penulis, media, artikel (dengan penulis, tag, terkait, dan riwayat versi), halaman, tata letak, redirect, staf, dan penanda lingkungan. Row Level Security di semua tabel: pembaca hanya melihat konten terbit, hanya staf yang menulis.
- Newsroom: halaman masuk di `/newsroom/login`, dashboard pemeriksaan fondasi, dan keluar. Hanya akun di tabel `staff` yang bisa masuk.
- Penjaga lingkungan: deploy Preview yang tersambung ke Supabase produksi (atau sebaliknya) menolak berjalan.
- Halaman depan sementara "Launching soon", tidak diindeks mesin pencari sampai peluncuran.
- CI GitHub Actions: type check, lint, 19 tes unit, 15 tes database dan RLS, build, dan 20 tes E2E (dengan axe dan Supabase tiruan), semuanya tanpa Docker.
```
````markdown title="docs/ops/setup.md"
# Pemasangan PressCompass v0.1.0

Panduan sekali jalan untuk pemilik: Supabase, komputer, GitHub, dan Vercel. Semua gratis dan tanpa Docker.
Rahasia (password database, secret key) tidak pernah dikirim lewat percakapan; isi langsung di tempatnya.

## A. Supabase (dua proyek gratis)

1. Buka https://supabase.com/dashboard, pilih **New project**.
   - Nama `presscompass-preview`, region **Southeast Asia (Singapore)**.
   - Password database: buat yang panjang dan **hanya huruf dan angka** (tanda seperti `#`, `/`, `?` merusak perintah). Simpan di pengelola password.
2. Ulangi untuk proyek produksi bernama `presscompass`.
   - Jatah gratis Supabase 2 proyek per akun. Bila akun ini masih memegang proyek gratis point.lat yang aktif, pakai akun Supabase lain.
3. Di **setiap** proyek:
   - **Authentication, Sign In / Providers:** matikan izin pendaftaran pengguna baru (Allow new users to sign up). Newsroom hanya untuk Anda.
   - **Authentication, Users, Add user, Create new user:** email Anda, password minimal 15 karakter, centang **Auto Confirm User**.
   - **Project Settings, API Keys:** catat **Project URL**, **publishable key** (`sb_publishable_...`), dan **secret key** (`sb_secret_...`). Jangan pakai kunci lama `anon` atau `service_role`.
   - Catat juga **kode proyek** (20 huruf di URL dashboard, `supabase.com/dashboard/project/KODE`).

## B. Komputer (Mac)

1. Pasang zip (perintah ada di pesan pengiriman v0.1.0).
2. Buat `.env` dari contoh, lalu isi dengan kunci proyek **pratinjau**:

   ```bash
   cp .env.example .env
   open -e .env
   ```

3. Terapkan skema ke proyek pratinjau. `db:login` membuka browser untuk masuk Supabase (sekali saja); `db:link` meminta password database proyek itu; `db:push` menanyakan konfirmasi:

   ```bash
   npm run db:login
   npm run db:link -- --project-ref KODE_PRATINJAU
   npm run db:push
   ```

4. Beri akses Newsroom ke akun Anda di proyek pratinjau, lalu jalankan:

   ```bash
   npm run staff:grant -- email@anda.com
   npm run dev
   ```

5. Buka http://localhost:3000/newsroom dan masuk. Kartu **Foundation** di Dashboard harus menunjukkan **Database Connected** dan **Environment Preview**.

## C. Skema proyek produksi

```bash
npm run db:link -- --project-ref KODE_PRODUKSI
npm run db:push
npm run db:link -- --project-ref KODE_PRATINJAU
```

Baris terakhir menautkan kembali ke pratinjau, supaya `db:push` berikutnya tidak tidak sengaja mengubah produksi.

Akses Newsroom produksi diberikan lewat **SQL Editor** proyek produksi (supaya secret key produksi tidak masuk terminal). Ganti emailnya, lalu Run:

```sql
insert into public.staff (user_id)
select id from auth.users where email = 'email@anda.com'
on conflict (user_id) do nothing;
```

## D. GitHub

1. Buat repo **privat** baru bernama `presscompass` di GitHub, tanpa README.
2. Kirim kode (perintah push ada di pesan pengiriman). CI berjalan otomatis; tunggu centang hijau.

## E. Vercel (Hobby)

1. **Add New, Project**, impor repo `presscompass`. Framework terdeteksi Next.js.
2. **Environment Variables** sebelum deploy pertama:

   | Nama | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://presscompass.site` | (kosongkan) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL produksi | Project URL pratinjau |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key produksi | publishable key pratinjau |
   | `SUPABASE_SECRET_KEY` | secret key produksi | secret key pratinjau |

3. Deploy. Region fungsi sudah dikunci ke Singapura (`sin1`) lewat `vercel.json`.
4. **Settings, Domains:** tambahkan `presscompass.site` dan ikuti petunjuk DNS Vercel di tempat domain dibeli.
5. Periksa:
   - https://presscompass.site menampilkan halaman "Launching soon";
   - https://presscompass.site/newsroom meminta masuk, lalu Dashboard menunjukkan **Database Connected** dan **Environment Production**.

## Bila ada masalah

| Gejala | Penyebab dan jalan keluar |
|---|---|
| Dashboard: "The Newsroom is not configured yet" saat masuk | env Supabase belum diisi atau salah ketik; periksa `.env` atau env Vercel, lalu deploy ulang |
| Semua halaman Vercel galat 500, log: "connected to the production Supabase project" | env Preview memakai kunci produksi (atau sebaliknya); perbaiki env Vercel, lalu deploy ulang |
| Masuk ditolak: "This account does not have Newsroom access" | baris `staff` belum dibuat untuk proyek itu (langkah B4 atau C) |
| `db:push`: IPv6 is not supported | jalankan `npm run db:link` lagi (link memakai pooler IPv4), lalu ulangi `db:push` |
| Deploy Vercel diblokir: commit author tidak punya akses | perintah pasang selalu memuat `git commit --amend --no-edit --reset-author` sebelum push; jalankan lalu push lagi |
````

Salin spesifikasi yang disetujui ke `docs/specs/2026-11-13-presscompass-design.md` dan rencana ini ke `docs/plans/`.

- [ ] **Step 4: Verifikasi penuh dan commit**

```bash
npx tsc --noEmit
npx eslint
npx vitest run --project unit
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npx vitest run --project db
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3101 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npx next build
CI=1 npx playwright test
```

Expected: unit 19, database 15, E2E 20 lulus; build berhasil.

```bash
git add -A
git commit -m "chore: CI without Docker, staff grant script and owner setup guide"
git tag -a v0.1.0 -m "PressCompass v0.1.0: foundation"
```

---

## Self-review (dijalankan)

- **Cakupan spesifikasi Rencana 1:** proyek Next.js npm/Node 26 (Task 1); token dan font dari design system, komponen dasar (Task 2); skema Supabase v1 + RLS (Task 3, tabel §6 kecuali tabel sistem Rencana 5 dan 7 yang menyusul secara aditif); tiga klien Supabase dan penjaga lingkungan (Task 4); login Newsroom (Task 5); CI dan `CLAUDE.md` (Task 1, 6). Storage Supabase tidak dibuat karena gambar lewat Cloudinary (keputusan pemilik 13 November).
- **Ditunda dengan sengaja:** tabel sistem (`indexing_*`, `search_*`, `newsletter_subscribers`, `contact_messages`, `rate_limits`, `not_found_log`) menunggu rencana yang memakainya; header keamanan dan cadangan di Rencana 8; MFA dan halaman Account di Rencana 2; keputusan preload font Newsreader (sekarang dua file, 279 KB) diukur ulang dengan Lighthouse di Rencana 4.
- **Konsistensi nama:** `createSessionClient`, `requireStaff`, `safeNextPath`, `loginUrl`, `deployEnv`, `checkEnvironmentMarker` dipakai sama di semua task.

---

## Revisi v0.1.1 (13 November 2026): satu proyek Supabase

Permintaan pemilik: "bisakah membuat project supabase nya hanya satu saja?" Dijalankan sebagai patch Rencana 1.

- **Migrasi** `supabase/migrations/20261113000200_single_project.sql`: hapus baris `app_meta.environment`, tulis `app_meta.project = "presscompass"`.
- **Pengaman:** `src/lib/environment-guard.ts` kini `checkProjectMarker(stored)` dan `assertProject()`; `src/instrumentation.ts` memanggil `assertProject()`. Deploy menolak berjalan bila penanda tidak ada (kunci proyek lain atau migrasi belum diterapkan) atau berisi nama proyek lain. Pembeda Production/Preview dihapus karena keduanya memakai proyek yang sama.
- **Dashboard:** baris "Deployment" menulis Production atau Preview or local.
- **Tes:** `tests/unit/environment-guard.test.ts` (3 tes penanda proyek), `tests/db/rls.test.ts` menambah tes penanda (database 16 tes).
- **Dokumen:** `docs/ops/setup.md` satu proyek, env Vercel sama di semua lingkungan; `CLAUDE.md` mewajibkan adapter layanan luar `fake` di luar Production; spesifikasi §2, §4, §18, §19 direvisi.
