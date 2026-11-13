# Rencana 3 · Media Cloudinary (v0.3.0)

> **Untuk agen:** jalankan task demi task (skill executing-plans), TDD, commit per task. Kode akhir ada di lampiran di bawah (dibuat dari repo setelah eksekusi).

**Tujuan:** pemilik bisa mengunggah gambar ke Cloudinary dari Newsroom, mengelolanya di pustaka media (alt, keterangan, kredit, dipakai di mana, hapus), memilih gambar utama artikel, menyisipkan blok gambar di isi, dan memberi foto penulis. Artikel baru bisa terbit bila gambar utamanya ada dan semua gambar ber-alt.

**Arsitektur:**
- Browser mengunggah langsung ke Cloudinary dengan parameter yang ditandatangani server (Server Action `prepareUpload`), jadi file tidak lewat fungsi Vercel.
- Server lalu memeriksa aset lewat Admin API Cloudinary (`registerUpload`) dan menyimpan ukurannya dari Cloudinary, bukan dari browser.
- Gambar dikirim dari CDN Cloudinary dengan `srcset` (`f_auto,q_auto`, lebar terbatas) oleh komponen `CloudImage` yang bisa dirender server maupun klien.
- Penggunaan media (gambar utama, blok gambar di isi, foto penulis) dihitung oleh fungsi SQL dari data yang ada, tanpa tabel tambahan.
- Tes memakai Cloudinary tiruan di server tiruan yang sama dengan Supabase tiruan: menerima unggahan multipart, **memeriksa tanda tangan**, membaca ukuran PNG/JPEG/GIF, melayani Admin API, destroy, dan pengiriman gambar.

**Stack:** tanpa dependensi baru. Tanda tangan SHA-1 dengan `node:crypto`, HTTP dengan `fetch`, unggah dari browser dengan `XMLHttpRequest` (untuk progres).

## Batasan global

- Semua batasan Rencana 1 dan 2 tetap berlaku (bahasa, tanpa Docker, `requireStaff()`, RLS, token desain, id unik per mount).
- Kredensial: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (publik, ada di URL gambar), `CLOUDINARY_API_KEY` dan `CLOUDINARY_API_SECRET` (hanya server). Secret tidak pernah dikirim ke browser.
- Override khusus tes: `NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL` dan `CLOUDINARY_API_URL` (bawaan `https://res.cloudinary.com` dan `https://api.cloudinary.com`). Pemilik tidak pernah mengisinya.
- Format yang diterima: JPEG, PNG, WebP, AVIF, GIF; maksimal 10 MB (batas berkas Cloudinary Free).
- Transformasi masuk `c_limit,w_2560,q_auto`; folder `presscompass/images`; `overwrite=false`; public ID `presscompass/images/<slug-nama>-<8 hex>` dibuat server.
- Pengiriman: preset `original` (`c_limit`), `hero` (16:9), `card` (3:2), `square` (1:1), semuanya `c_fill,g_auto` kecuali original; lebar `srcset` 320/640/960/1280/1920, tidak melebihi lebar asli.

## Keputusan rencana

| Topik | Keputusan |
|---|---|
| `next/image` | Tidak dipakai. Loader kustom Next hanya membuat `srcset`, dan fungsi loader tidak bisa dioper dari Server Component. `CloudImage` membuat `<img srcset sizes width height>` yang sama tanpa JavaScript klien dan bisa diuji unit. Optimasi gambar Vercel tetap tidak tersentuh. |
| Tanpa kredensial | Situs tetap berjalan; unggah dimatikan dengan pesan cara mengisi kunci; Dashboard menulis "Media: Cloudinary is not connected". Spesifikasi §11 meminta produksi menolak berjalan; diubah menjadi peringatan karena Newsroom yang mati lebih merugikan, dan tanpa kredensial memang belum ada gambar. |
| Alt | Disimpan di media (satu sumber), bisa diubah dari pustaka maupun dialog pemilih. Keterangan per pemakaian: `lead_caption` untuk gambar utama, `caption` di blok gambar (bawaan dari keterangan media). Kredit dari media. |
| Aturan terbit | Ditambah: gambar utama dipilih dan ber-alt; semua gambar di isi ber-alt. |
| Hapus media | Diblokir bila dipakai. Baris database dihapus dulu, lalu aset di Cloudinary (`destroy` dengan `invalidate`). Bila destroy gagal, dicatat di log. |
| Penggunaan | `media_usage(id)` dan hitungan di `newsroom_media()` membaca `lead_media_id`, `photo_media_id`, dan blok `image` di `articles.body` lewat `jsonb_path_query`. |

## Task

### Task 1: Inti media murni
- `src/lib/media/url.ts`: preset, `cloudinaryUrl`, `imageSources` (src, srcset, width, height per preset). Tes unit.
- `src/modules/media/cloudinary.ts`: `signParams` (contoh resmi Cloudinary sebagai vektor tes), `uploadPlan`, `publicIdFor`, klien Admin API (`fetchResource`, `destroyAsset`). Tes unit.
- `src/modules/media/validate.ts`: jenis dan ukuran file, detail media (alt ≤ 300, keterangan ≤ 300, kredit ≤ 120). Tes unit.

### Task 2: Cloudinary tiruan + migrasi
- `tests/fake-supabase/cloudinary.mjs`: upload multipart bertanda tangan, Admin API, destroy, pengiriman gambar, CORS.
- Migrasi `20261115000100_media.sql`: `media_usage`, `newsroom_media`, hak akses. Tes database.

### Task 3: Pustaka media
- Server Actions `prepareUpload`, `registerUpload`, `updateMedia`, `deleteMedia`, `searchMedia`; halaman `/newsroom/media` dan `/newsroom/media/[id]`; komponen `UploadButton` dengan progres; menu Media.

### Task 4: Pemilih gambar, gambar utama, blok gambar, foto penulis
- `ImagePickerDialog` (pustaka + unggah + alt/keterangan/kredit).
- Editor: kartu Lead image di panel, tombol Image di toolbar, node `image` (skema, sanitasi, Tiptap, `ArticleBody`), aturan terbit baru, pratinjau dengan gambar.
- Penulis: foto profil.

### Task 5: Verifikasi dan kiriman
- Semua tes, E2E media, cek visual, dokumen (`.env.example`, setup Cloudinary), CHANGELOG, versi 0.3.0, zip.


## Hasil eksekusi (13 November 2026)

- Semua task selesai. Type check dan lint bersih; Vitest unit 74, database 35; Playwright 43 lulus (19 dilewati sengaja: alur editor hanya desktop, cek tata letak HP hanya mobile); build produksi berhasil. Spesifikasi editor dan media diulang 3 kali tanpa gagal.
- E2E mengunggah PNG sungguhan ke Cloudinary tiruan: tanda tangan diperiksa, lebar dibatasi 2560 px, `srcset` dimuat, dan hapus benar-benar menghapus aset tiruan.
- Cek visual terang, gelap, dan HP: pustaka, halaman gambar, editor dengan gambar utama dan blok gambar, pemilih (desktop dan HP), pratinjau, foto penulis, Dashboard. Perbaikan dari cek ini: ikon cari di pustaka, pemilih lebih ringkas di HP, jarak legend di form penulis.
- Temuan:
  - `lax $.**` di JSON path PostgreSQL mengunjungi isi array dua kali; `body_media_ids()` sudah memakai `distinct`, kueri tes memakai `strict`.
  - Notifikasi "Draft saved." dari simpan pertama masih tampil saat simpan kedua, jadi tes riwayat menunggu judul baru di database, bukan notifikasinya.
  - Bila semua file gagal karena alasan yang sama (Cloudinary belum tersambung), pesan ditulis sekali.
- Kredensial Cloudinary asli tidak bisa diuji dari sesi ini (jaringan dibatasi). Tanda tangan diuji dengan contoh resmi Cloudinary, dan pemilik memeriksa unggah pertama sesuai `docs/ops/setup.md` langkah E5.

## Lampiran: kode akhir

File yang dibuat atau diubah sejak v0.2.0 (tanpa `package-lock.json` dan dokumen Markdown).

### `.env.example`

```bash
# Copy this file to .env and fill in the values from the presscompass Supabase project
# (Project Settings, API Keys). The same project serves production, Vercel Preview and this computer.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
SUPABASE_SECRET_KEY=sb_secret_replace_me

# Cloudinary (images). From the Cloudinary console: Settings, API Keys. Cloud name is public (it is in image
# addresses); the API key and secret stay on the server. Without them the Newsroom runs but cannot upload.
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=replace_me
CLOUDINARY_API_SECRET=replace_me
```

### `package.json`

```json
{
  "name": "presscompass",
  "version": "0.3.0",
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
    "fake:supabase": "node tests/fake-supabase/server.mjs",
    "staff:grant": "node --env-file=.env scripts/grant-staff.mjs"
  },
  "dependencies": {
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "2.119.0",
    "@tiptap/core": "3.32.3",
    "@tiptap/extension-blockquote": "3.32.3",
    "@tiptap/extension-list": "3.32.3",
    "@tiptap/extension-table": "3.32.3",
    "@tiptap/extensions": "3.32.3",
    "@tiptap/pm": "3.32.3",
    "@tiptap/react": "3.32.3",
    "@tiptap/starter-kit": "3.32.3",
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

### `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

// E2E runs against a production build and a fake Supabase (tests/fake-supabase/server.mjs): fake Auth
// plus a Data API that runs real SQL on a fresh local PostgreSQL database, so no Supabase project is needed.
const PORT = 3100;
const MOCK_SUPABASE_PORT = 3101;
const E2E_ENV = {
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e',
  // The fake Supabase also plays Cloudinary (tests/fake-supabase/cloudinary.mjs): signed uploads, Admin API, delivery.
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'demo',
  NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}/fake-cloudinary`,
  CLOUDINARY_API_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}/fake-cloudinary`,
  CLOUDINARY_API_KEY: 'fake-key',
  CLOUDINARY_API_SECRET: 'fake-secret',
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
      command: 'node tests/fake-supabase/server.mjs',
      port: MOCK_SUPABASE_PORT,
      reuseExistingServer: false,
      env: { FAKE_SUPABASE_PORT: String(MOCK_SUPABASE_PORT), FAKE_DATABASE_NAME: 'presscompass_e2e' },
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

### `src/app/newsroom/(app)/articles/[id]/ArticleEditor.tsx`

```tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ds/Button';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import { BodyEditor, type BodyEditorHandle } from '@/components/newsroom/editor/BodyEditor';
import { CloudImage } from '@/components/media/CloudImage';
import { ImagePickerDialog } from '@/components/media/ImagePickerDialog';
import { type MediaLookup, MediaLookupContext } from '@/components/newsroom/editor/media-context';
import { CheckboxField, SelectField, TextArea, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import { StatusBadge } from '@/components/newsroom/StatusBadge';
import { Notice, ui } from '@/components/newsroom/ui';
import { slugify } from '@/lib/slug';
import { readingMinutes, wordCount } from '@/lib/doc/text';
import { formatWib, toWibInput } from '@/lib/time';
import { deleteArticle, findArticles, saveArticle } from '@/modules/editor/actions';
import { ARTICLE_TYPES, type FieldErrors, MAX, type Source, TYPE_LABELS } from '@/modules/editor/input';
import type { EditableArticle } from '@/modules/editor/queries';
import type { MediaItem } from '@/modules/media/types';
import { MIN_WORDS, UNTITLED_SLUG } from '@/modules/editor/rules';
import { type ArticleStatus, canAutosave, CONFIRMATIONS, type Intent, intentLabel, statusActions } from '@/modules/editor/status';
import styles from './editor-page.module.css';

type Option = { id: string; name: string };
type Related = { id: string; title: string };
type Found = Awaited<ReturnType<typeof findArticles>>;

const AUTOSAVE_MS = 10_000;

const DONE: Partial<Record<Intent, string>> = {
  save: 'Draft saved.',
  review: 'Sent for review.',
  draft: 'Moved back to draft.',
  publish: 'Published.',
  unschedule: 'Schedule cancelled. The article is a draft again.',
  unpublish: 'Unpublished. Readers no longer see it.',
  archive: 'Archived. Restore it to draft to edit it again.',
  restore: 'Restored to draft.',
};

const ANCHORS: Record<string, string> = {
  authorIds: 'authors',
  sectionId: 'section',
  scheduledAt: 'schedule',
  body: 'body-label',
  sources: 'sources-title',
  leadImage: 'lead-title',
  leadCaption: 'lead-caption',
  images: 'body-label',
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Headline',
  slug: 'Address',
  sectionId: 'Section',
  authorIds: 'Authors',
  standfirst: 'Standfirst',
  body: 'Article text',
  scheduledAt: 'Publish time',
  sources: 'Sources',
  kicker: 'Label',
  leadImage: 'Lead image',
  leadCaption: 'Lead image caption',
  images: 'Images',
  status: 'Status',
};

export function ArticleEditor({
  article,
  sections,
  authors,
  tags,
  media,
  notice,
}: {
  article: EditableArticle;
  /** Media items the article uses (lead image and images in the text). */
  media: MediaItem[];
  sections: (Option & { slug: string })[];
  authors: (Option & { role: string })[];
  tags: Option[];
  notice?: { tone: 'success' | 'error'; text: string } | null;
}) {
  const uid = useId();
  const id = (field: string) => `${uid}-${field}`;
  const body = useRef<BodyEditorHandle>(null);

  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [slugTouched, setSlugTouched] = useState(
    article.published_at !== null || !(UNTITLED_SLUG.test(article.slug) || article.slug === slugify(article.title)),
  );
  const [sectionId, setSectionId] = useState(article.section_id ?? '');
  const [type, setType] = useState(article.type);
  const [kicker, setKicker] = useState(article.kicker_label);
  const [standfirst, setStandfirst] = useState(article.standfirst);
  const [isBreaking, setIsBreaking] = useState(article.is_breaking);
  const [authorIds, setAuthorIds] = useState(article.authorIds);
  const [tagIds, setTagIds] = useState(article.tagIds);
  const [related, setRelated] = useState<Related[]>(article.related.map(({ id: rid, title: t }) => ({ id: rid, title: t })));
  const [sources, setSources] = useState<Source[]>(article.sources);
  const [known, setKnown] = useState(() => new Map(media.map((item) => [item.id, item])));
  const [leadMediaId, setLeadMediaId] = useState(article.lead_media_id);
  const [leadCaption, setLeadCaption] = useState(article.lead_caption);
  const [pickingLead, setPickingLead] = useState(false);
  const lookup = useMemo<MediaLookup>(
    () => ({ get: (mediaId) => known.get(mediaId), remember: (item) => setKnown((current) => new Map(current).set(item.id, item)) }),
    [known],
  );
  const leadMedia = leadMediaId ? known.get(leadMediaId) : undefined;
  const [words, setWords] = useState(article.word_count);

  const [version, setVersion] = useState(article.version);
  const [status, setStatus] = useState<ArticleStatus>(article.status);
  const [publishedAt, setPublishedAt] = useState(article.published_at);
  const [scheduledAt, setScheduledAt] = useState(article.scheduled_at);
  const [savedAt, setSavedAt] = useState(article.updated_at);
  const [scheduleInput, setScheduleInput] = useState(article.scheduled_at ? toWibInput(new Date(article.scheduled_at)) : '');
  const [scheduling, setScheduling] = useState(false);
  const [majorUpdate, setMajorUpdate] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<Intent | null>(null);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState(notice ?? null);
  const [conflict, setConflict] = useState(false);
  const changes = useRef(0);

  const readOnly = status === 'archived';
  const section = sections.find((s) => s.id === sectionId);
  const actions = statusActions(status);

  const touch = useCallback(() => {
    changes.current += 1;
    setDirty(true);
  }, []);

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      touch();
    };
  }

  const save = useCallback(
    async (intent: Intent) => {
      if (saving || conflict) return;
      const startedAt = changes.current;
      setSaving(intent);
      const sendSchedule = intent === 'schedule' || (intent === 'update' && status === 'scheduled');
      try {
        const result = await saveArticle(
          {
            id: article.id,
            version,
            title,
            slug,
            slugAuto: !slugTouched,
            sectionId: sectionId || null,
            type,
            kicker,
            standfirst,
            body: body.current?.getJSON(),
            isBreaking,
            authorIds,
            tagIds,
            relatedIds: related.map((r) => r.id),
            sources,
            scheduledAt: sendSchedule ? scheduleInput || null : null,
            majorUpdate: intent === 'update' && majorUpdate,
            leadMediaId,
            leadCaption,
          },
          intent,
        );
        if (result.ok) {
          setVersion(result.version);
          setStatus(result.status);
          setPublishedAt(result.publishedAt);
          setScheduledAt(result.scheduledAt);
          setSavedAt(result.savedAt);
          if (result.slug !== slug) setSlug(result.slug);
          setErrors({});
          setAutosaveFailed(false);
          if (changes.current === startedAt) setDirty(false);
          if (intent !== 'autosave') {
            setScheduling(false);
            setMajorUpdate(false);
            const text =
              intent === 'schedule' && result.scheduledAt
                ? `Scheduled for ${formatWib(result.scheduledAt)} WIB.`
                : intent === 'update'
                  ? result.status === 'published'
                    ? 'Update published.'
                    : 'Changes saved.'
                  : DONE[intent];
            setMessage(text ? { tone: 'success', text } : null);
          }
        } else if (result.conflict) {
          setConflict(true);
        } else {
          setErrors(result.errors ?? {});
          if (intent === 'autosave') setAutosaveFailed(true);
          else if (result.message) setMessage({ tone: 'error', text: result.message });
          else setMessage(null);
        }
      } catch {
        if (intent === 'autosave') setAutosaveFailed(true);
        else setMessage({ tone: 'error', text: 'The server could not be reached. Your changes are still here. Try again.' });
      } finally {
        setSaving(null);
      }
    },
    [
      saving,
      conflict,
      status,
      article.id,
      version,
      title,
      slug,
      slugTouched,
      sectionId,
      type,
      kicker,
      standfirst,
      isBreaking,
      authorIds,
      tagIds,
      related,
      sources,
      scheduleInput,
      majorUpdate,
      leadMediaId,
      leadCaption,
    ],
  );

  // Autosave every 10 seconds while there are changes (drafts and articles in review only).
  const autosaveTick = useEffectEvent(() => {
    if (dirty && !saving && !conflict && canAutosave(status)) void save('autosave');
  });
  useEffect(() => {
    const timer = setInterval(() => autosaveTick(), AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, []);

  // Warn before leaving with unsaved changes, and save with Ctrl+S or Cmd+S.
  const onBeforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
    if (dirty) event.preventDefault();
  });
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (status === 'draft' || status === 'review') void save('save');
      else if (status !== 'archived') void save('update');
    }
  });
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => onBeforeUnload(event);
    const keydown = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', keydown);
    };
  }, []);

  function run(intent: Intent) {
    if (intent === 'schedule' && !scheduling) {
      setScheduling(true);
      if (!scheduleInput) setScheduleInput(nextHourInput());
      return;
    }
    void save(intent);
  }

  const problems = Object.entries(errors).filter(([, text]) => text);
  const errorFor = (field: string) => errors[field];
  const minutes = readingMinutes(words);
  const saveState = conflict
    ? 'Not saved'
    : saving
      ? 'Saving…'
      : autosaveFailed
        ? 'Not saved: fix the fields marked in red'
        : dirty
          ? canAutosave(status)
            ? 'Unsaved changes'
            : 'Unsaved changes: press Update to publish them'
          : `Saved ${formatWib(savedAt, 'short')}`;

  const actionButton = (intent: Intent, variant: 'primary' | 'secondary' | 'quiet') => {
    const label = intent === 'schedule' && scheduling ? 'Confirm schedule' : intentLabel(intent, status);
    const confirm = CONFIRMATIONS[intent];
    const busy = saving === intent;
    if (confirm) {
      return (
        <ConfirmButton
          key={intent}
          variant={variant}
          fullWidth
          disabled={Boolean(saving) || conflict}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirm}
          danger={intent === 'archive' || intent === 'unpublish'}
          onConfirm={() => run(intent)}
        >
          {busy ? 'Working…' : label}
        </ConfirmButton>
      );
    }
    return (
      <Button key={intent} variant={variant} fullWidth disabled={Boolean(saving) || conflict} onClick={() => run(intent)}>
        {busy ? (intent === 'save' ? 'Saving…' : 'Working…') : label}
      </Button>
    );
  };

  const primary = scheduling && actions.primary !== 'schedule' ? 'schedule' : actions.primary;
  const others = scheduling ? [] : actions.others;
  const availableAuthors = authors.filter((a) => !authorIds.includes(a.id));
  const availableTags = tags.filter((t) => !tagIds.includes(t.id));

  return (
    <MediaLookupContext value={lookup}>
    <div className={styles.page}>
      <h1 className={ui.srOnly}>Edit article</h1>
      <div className={styles.top}>
        <Link href="/newsroom/articles" className={styles.back}>
          ← Articles
        </Link>
        <StatusBadge status={status} />
        <p className={styles.saveState} role="status" aria-live="polite">
          {saveState}
        </p>
        <div className={styles.topLinks}>
          <ButtonLink href={`/newsroom/articles/${article.id}/history`} size="sm" variant="quiet" icon="history">
            History
          </ButtonLink>
          <ButtonLink href={`/newsroom/preview/${article.id}`} size="sm" icon="eye" target="_blank">
            Preview
          </ButtonLink>
        </div>
      </div>

      {conflict && (
        <Notice tone="error">
          <span>This article changed in another window. Reload to see the latest version. Changes made here since your last save will be lost.</span>
          <span>
            <Button size="sm" variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </span>
        </Notice>
      )}
      {message && !conflict && <Notice tone={message.tone}>{message.text}</Notice>}
      {readOnly && <Notice tone="info">Archived articles are read-only. Restore it to draft to edit it.</Notice>}

      <div className={styles.grid}>
        <div className={styles.main}>
          <div className={styles.headlineField}>
            <label htmlFor={id('title')} className={styles.fieldLabel}>
              Headline
            </label>
            <textarea
              id={id('title')}
              className={styles.headline}
              rows={1}
              value={title}
              placeholder="Write the headline"
              maxLength={MAX.title + 20}
              disabled={readOnly}
              aria-invalid={errorFor('title') ? true : undefined}
              aria-describedby={errorFor('title') ? id('title-error') : undefined}
              onChange={(event) => {
                const value = event.target.value.replace(/\n/g, ' ');
                setTitle(value);
                if (!slugTouched) setSlug(slugify(value) || slug);
                touch();
              }}
            />
            {errorFor('title') && (
              <p id={id('title-error')} className={forms.error}>
                {errorFor('title')}
              </p>
            )}
          </div>
          <div className={styles.headlineField}>
            <label htmlFor={id('standfirst')} className={styles.fieldLabel}>
              Standfirst
            </label>
            <textarea
              id={id('standfirst')}
              className={styles.standfirst}
              rows={2}
              value={standfirst}
              placeholder="One or two sentences that tell the reader why this matters"
              maxLength={MAX.standfirst + 20}
              disabled={readOnly}
              aria-invalid={errorFor('standfirst') ? true : undefined}
              aria-describedby={errorFor('standfirst') ? id('standfirst-error') : undefined}
              onChange={(event) => change(setStandfirst)(event.target.value)}
            />
            {errorFor('standfirst') && (
              <p id={id('standfirst-error')} className={forms.error}>
                {errorFor('standfirst')}
              </p>
            )}
          </div>
          <div className={styles.headlineField}>
            <span className={styles.fieldLabel} id={id('body-label')}>
              Article text
            </span>
            <BodyEditor
              ref={body}
              initial={article.body}
              articleId={article.id}
              editable={!readOnly}
              invalid={Boolean(errorFor('body'))}
              describedBy={errorFor('body') ? id('body-error') : undefined}
              onChange={(text) => {
                setWords(wordCount(text));
                touch();
              }}
            />
            {errorFor('body') && (
              <p id={id('body-error')} className={forms.error}>
                {errorFor('body')}
              </p>
            )}
            <p className={styles.wordCount}>
              {words} {words === 1 ? 'word' : 'words'}
              {minutes > 0 && ` · ${minutes} min read`}
              {words < MIN_WORDS && ` · ${MIN_WORDS} needed to publish`}
            </p>
          </div>
        </div>

        <aside className={styles.panel} aria-label="Article settings">
          <section className={styles.card} aria-label="Status">
            <div className={styles.statusHead}>
              <StatusBadge status={status} />
              <span className={styles.when}>
                {status === 'scheduled' && scheduledAt
                  ? `Publishes ${formatWib(scheduledAt)} WIB`
                  : publishedAt
                    ? `First published ${formatWib(publishedAt)} WIB`
                    : 'Not published yet'}
              </span>
            </div>
            {problems.length > 0 && (
              <div className={styles.problems} role="alert">
                <p>{problems.length === 1 ? 'One thing needs attention:' : `${problems.length} things need attention:`}</p>
                <ul>
                  {problems.map(([field, text]) => (
                    <li key={field}>
                      <a href={`#${id(ANCHORS[field] ?? field)}`}>
                        {FIELD_LABELS[field] ?? field}
                      </a>
                      : {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(scheduling || status === 'scheduled') && (
              <TextField
                id={id('schedule')}
                label="Publish time (WIB)"
                type="datetime-local"
                value={scheduleInput}
                onChange={(event) => change(setScheduleInput)(event.target.value)}
                error={errorFor('scheduledAt')}
              />
            )}
            {status === 'published' && (
              <CheckboxField
                id={id('major')}
                label="Major update"
                hint="Marks the article as updated and tells search engines. Use it for new facts, not for typo fixes."
                checked={majorUpdate}
                onChange={(event) => setMajorUpdate(event.target.checked)}
              />
            )}
            <div className={styles.actions}>
              {actionButton(primary, 'primary')}
              {scheduling && (
                <Button variant="quiet" fullWidth onClick={() => setScheduling(false)}>
                  Cancel
                </Button>
              )}
              {others.map((intent) => actionButton(intent, 'secondary'))}
            </div>
          </section>

          <section className={styles.card} aria-labelledby={id('lead-title')}>
            <h2 className={styles.cardTitle} id={id('lead-title')}>
              Lead image
            </h2>
            {errorFor('leadImage') && <p className={forms.error}>{errorFor('leadImage')}</p>}
            {leadMediaId && !leadMedia && <p className={forms.hint}>The chosen image is no longer in the media library.</p>}
            {leadMedia && (
              <figure className={styles.lead}>
                <CloudImage image={leadMedia} alt="" preset="hero" sizes="300px" className={styles.leadImage} />
                <figcaption className={leadMedia.alt ? styles.leadAlt : styles.leadAltMissing}>
                  {leadMedia.alt ? `Alt text: ${leadMedia.alt}` : 'No alt text yet. Needed before publishing.'}
                </figcaption>
              </figure>
            )}
            {!readOnly && (
              <div className={styles.rowButtons}>
                <Button size="sm" icon="image" onClick={() => setPickingLead(true)}>
                  {leadMediaId ? 'Change image' : 'Choose image'}
                </Button>
                {leadMediaId && (
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => {
                      setLeadMediaId(null);
                      touch();
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            )}
            {leadMediaId && (
              <TextArea
                id={id('lead-caption')}
                label="Caption"
                optional
                rows={2}
                value={leadCaption}
                disabled={readOnly}
                maxLength={MAX.leadCaption}
                error={errorFor('leadCaption')}
                hint="Shown under the lead image. Credit comes from the media library."
                onChange={(event) => change(setLeadCaption)(event.target.value)}
              />
            )}
          </section>

          <section className={styles.card} aria-label="Details">
            <h2 className={styles.cardTitle}>Details</h2>
            <TextField
              id={id('slug')}
              label="Address"
              mono
              value={slug}
              disabled={readOnly}
              error={errorFor('slug')}
              hint={`presscompass.site/${section?.slug ?? 'section'}/${slug}${publishedAt ? ' · Changing it adds a redirect from the old address.' : ''}`}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTouched(true);
                touch();
              }}
              onBlur={() => setSlug((current) => slugify(current) || current)}
            />
            <SelectField
              id={id('section')}
              label="Section"
              value={sectionId}
              disabled={readOnly}
              error={errorFor('sectionId')}
              onChange={(event) => change(setSectionId)(event.target.value)}
            >
              <option value="">Choose a section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            {sections.length === 0 && (
              <p className={forms.hint}>
                No sections yet. <Link href="/newsroom/sections/new">Create one</Link> first.
              </p>
            )}
            <SelectField id={id('type')} label="Type" value={type} disabled={readOnly} onChange={(event) => change(setType)(event.target.value as typeof type)}>
              {ARTICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </SelectField>
            <TextField
              id={id('kicker')}
              label="Label"
              optional
              value={kicker}
              disabled={readOnly}
              maxLength={MAX.kicker}
              error={errorFor('kicker')}
              hint="Shown above the headline instead of the section name, for example Exclusive."
              onChange={(event) => change(setKicker)(event.target.value)}
            />
            <CheckboxField
              id={id('breaking')}
              label="Breaking news"
              hint="Highlights the article in the Latest strip."
              checked={isBreaking}
              disabled={readOnly}
              onChange={(event) => change(setIsBreaking)(event.target.checked)}
            />
          </section>

          <section className={styles.card} aria-labelledby={id('authors-title')}>
            <h2 className={styles.cardTitle} id={id('authors-title')}>
              Byline
            </h2>
            {errorFor('authorIds') && <p className={forms.error}>{errorFor('authorIds')}</p>}
            {authorIds.length > 0 && (
              <ol className={styles.chosenList}>
                {authorIds.map((authorId, index) => {
                  const author = authors.find((a) => a.id === authorId);
                  return (
                    <li key={authorId}>
                      <span>
                        {author?.name ?? 'Removed author'}
                        {author?.role && <small>{author.role}</small>}
                      </span>
                      {!readOnly && (
                        <span className={styles.rowButtons}>
                          <Button
                            size="sm"
                            variant="quiet"
                            icon="arrow-up"
                            aria-label={`Move ${author?.name} up`}
                            disabled={index === 0}
                            onClick={() => change(setAuthorIds)(move(authorIds, index, -1))}
                          />
                          <Button size="sm" variant="quiet" icon="x" aria-label={`Remove ${author?.name}`} onClick={() => change(setAuthorIds)(authorIds.filter((a) => a !== authorId))} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {!readOnly && (
              <SelectField
                id={id('authors')}
                label="Add an author"
                value=""
                onChange={(event) => event.target.value && change(setAuthorIds)([...authorIds, event.target.value])}
                hint={authors.length === 0 ? undefined : authorIds.length > 1 ? 'Bylines appear in this order.' : undefined}
              >
                <option value="">{availableAuthors.length ? 'Choose…' : 'Everyone is on the byline'}</option>
                {availableAuthors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </SelectField>
            )}
            {authors.length === 0 && (
              <p className={forms.hint}>
                No authors yet. <Link href="/newsroom/authors/new">Add one</Link> first.
              </p>
            )}
          </section>

          <section className={styles.card} aria-labelledby={id('tags-title')}>
            <h2 className={styles.cardTitle} id={id('tags-title')}>
              Tags
            </h2>
            {tagIds.length > 0 && (
              <ul className={styles.chips}>
                {tagIds.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId);
                  return (
                    <li key={tagId} className={styles.chip}>
                      {tag?.name ?? 'Removed tag'}
                      {!readOnly && (
                        <button type="button" aria-label={`Remove tag ${tag?.name}`} onClick={() => change(setTagIds)(tagIds.filter((t) => t !== tagId))}>
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!readOnly && (
              <SelectField id={id('tags')} label="Add a tag" value="" onChange={(event) => event.target.value && change(setTagIds)([...tagIds, event.target.value])}>
                <option value="">{availableTags.length ? 'Choose…' : 'No more tags'}</option>
                {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectField>
            )}
            <p className={forms.hint}>
              <Link href="/newsroom/tags/new" target="_blank">
                New tag
              </Link>{' '}
              opens in a new tab. Reload this page after creating it.
            </p>
          </section>

          <RelatedPicker articleId={article.id} related={related} readOnly={readOnly} onChange={change(setRelated)} uid={uid} />

          <section className={styles.card} aria-labelledby={id('sources-title')}>
            <h2 className={styles.cardTitle} id={id('sources-title')}>
              Sources
            </h2>
            {errorFor('sources') && <p className={forms.error}>{errorFor('sources')}</p>}
            {sources.map((source, index) => (
              <fieldset key={index} className={styles.source}>
                <legend className={styles.sourceLegend}>Source {index + 1}</legend>
                <TextField id={id(`source-title-${index}`)} label="Title" value={source.title} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'title', e.target.value))} />
                <TextField id={id(`source-url-${index}`)} label="Link" type="url" mono value={source.url} disabled={readOnly} placeholder="https://" onChange={(e) => change(setSources)(edit(sources, index, 'url', e.target.value))} />
                <div className={forms.row}>
                  <TextField id={id(`source-publisher-${index}`)} label="Publisher" optional value={source.publisher} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'publisher', e.target.value))} />
                  <TextField id={id(`source-accessed-${index}`)} label="Accessed" optional type="date" value={source.accessed} disabled={readOnly} onChange={(e) => change(setSources)(edit(sources, index, 'accessed', e.target.value))} />
                </div>
                {!readOnly && (
                  <Button size="sm" variant="quiet" icon="trash" onClick={() => change(setSources)(sources.filter((_, i) => i !== index))}>
                    Remove source
                  </Button>
                )}
              </fieldset>
            ))}
            {!readOnly && sources.length < MAX.sources && (
              <Button size="sm" icon="plus" onClick={() => change(setSources)([...sources, { title: '', url: '', publisher: '', accessed: toWibInput(new Date()).slice(0, 10) }])}>
                Add source
              </Button>
            )}
          </section>

          {status !== 'published' && (
            <section className={styles.card} aria-label="Delete">
              <form action={deleteArticle}>
                <input type="hidden" name="id" value={article.id} />
                <ConfirmButton
                  variant="quiet"
                  size="sm"
                  icon="trash"
                  title="Delete this article?"
                  body="The article and its history are removed for good. This cannot be undone."
                  confirmLabel="Delete article"
                  danger
                >
                  Delete article
                </ConfirmButton>
              </form>
            </section>
          )}
        </aside>
      </div>
    </div>
    {pickingLead && (
      <ImagePickerDialog
        title="Lead image"
        initial={leadMedia ?? null}
        caption={null}
        submitLabel="Use as lead image"
        onClose={() => setPickingLead(false)}
        onSave={({ media: picked }) => {
          lookup.remember(picked);
          setLeadMediaId(picked.id);
          if (!leadCaption && picked.caption) setLeadCaption(picked.caption);
          setPickingLead(false);
          touch();
        }}
      />
    )}
    </MediaLookupContext>
  );
}

function RelatedPicker({
  articleId,
  related,
  readOnly,
  onChange,
  uid,
}: {
  articleId: string;
  related: Related[];
  readOnly: boolean;
  onChange: (value: Related[]) => void;
  uid: string;
}) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    setSearching(true);
    try {
      setFound((await findArticles(query, articleId)).filter((a) => !related.some((r) => r.id === a.id)));
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby={`${uid}-related-title`}>
      <h2 className={styles.cardTitle} id={`${uid}-related-title`}>
        Related articles
      </h2>
      <p className={forms.hint}>Your picks appear first under the article. The rest fill in from the same section and tags.</p>
      {related.length > 0 && (
        <ol className={styles.chosenList}>
          {related.map((item) => (
            <li key={item.id}>
              <span>{item.title || 'Untitled'}</span>
              {!readOnly && <Button size="sm" variant="quiet" icon="x" aria-label={`Remove ${item.title || 'Untitled'}`} onClick={() => onChange(related.filter((r) => r.id !== item.id))} />}
            </li>
          ))}
        </ol>
      )}
      {!readOnly && related.length < MAX.related && (
        <>
          <div className={styles.searchRow}>
            <TextField
              id={`${uid}-related-query`}
              label="Find an article"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void search();
                }
              }}
            />
            <Button size="sm" onClick={() => void search()} disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>
          {found && (
            <ul className={styles.results} aria-label="Search results">
              {found.length === 0 && <li className={forms.hint}>No articles match.</li>}
              {found.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() => {
                      onChange([...related, { id: item.id, title: item.title }]);
                      setFound((current) => current?.filter((f) => f.id !== item.id) ?? null);
                    }}
                  >
                    <span>{item.title || 'Untitled'}</span>
                    <small>Add · {item.section?.name ?? 'No section'}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function move<T>(list: T[], index: number, by: number): T[] {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + by, 0, item);
  return next;
}

function edit(sources: Source[], index: number, key: keyof Source, value: string): Source[] {
  return sources.map((source, i) => (i === index ? { ...source, [key]: value } : source));
}

/** The next full hour in WIB, as a starting point for the schedule field. */
function nextHourInput(): string {
  return `${toWibInput(new Date(Date.now() + 60 * 60 * 1000)).slice(0, 14)}00`;
}
```

### `src/app/newsroom/(app)/articles/[id]/editor-page.module.css`

```css
/* Article editor page: writing column and settings panel. */

.page {
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.back {
  font: 500 14px/20px var(--font-sans);
  color: var(--ink-secondary);
  text-decoration: none;
}

.back:hover {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.saveState {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.topLinks {
  margin-left: auto;
  display: flex;
  gap: var(--space-2);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-6);
  align-items: start;
}

.main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.headlineField {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fieldLabel {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.headline,
.standfirst {
  width: 100%;
  padding: 8px 0;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  resize: none;
  field-sizing: content;
  overflow: hidden;
}

.headline {
  font: 500 clamp(28px, 3.2vw, 40px) / 1.15 var(--font-serif);
  letter-spacing: -0.01em;
  font-variation-settings: 'opsz' 60;
}

.standfirst {
  font: 400 20px/30px var(--font-serif);
  font-variation-settings: 'opsz' 24;
  color: var(--ink-secondary);
}

.headline::placeholder,
.standfirst::placeholder {
  color: var(--ink-muted);
}

.headline:focus-visible,
.standfirst:focus-visible {
  outline: none;
  border-bottom-color: var(--meridian);
  box-shadow: 0 1px 0 var(--meridian);
}

.headline[aria-invalid],
.standfirst[aria-invalid] {
  border-bottom-color: var(--danger);
}

.wordCount {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.cardTitle {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.statusHead {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.when {
  font: 400 13px/18px var(--font-mono);
  color: var(--ink-muted);
}

.problems {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
  font: 500 14px/20px var(--font-sans);
}

.problems ul {
  margin: 6px 0 0;
  padding-left: 18px;
  font-weight: 400;
}

.problems a {
  color: inherit;
  font-weight: 600;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.chosenList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chosenList li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 6px 4px 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  font: 500 14px/20px var(--font-sans);
}

.chosenList small {
  display: block;
  font: 400 12px/16px var(--font-sans);
  color: var(--ink-muted);
}

.rowButtons {
  display: flex;
  gap: 2px;
  flex: none;
}

.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  font: 500 14px/20px var(--font-sans);
  color: var(--ink-secondary);
}

.chip button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.chip button:hover {
  background: var(--paper-sunken);
  color: var(--ink);
}

.source {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  min-width: 0;
}

.sourceLegend {
  padding: 0 4px;
  font: 600 13px/18px var(--font-sans);
}

.searchRow {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}

.searchRow > :first-child {
  flex: 1;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--paper);
  color: var(--ink);
  text-align: left;
  font: 500 14px/20px var(--font-sans);
  cursor: pointer;
}

.result small {
  font: 400 12px/16px var(--font-sans);
  color: var(--ink-muted);
}

.result:hover {
  border-color: var(--ink-secondary);
}

@media (max-width: 1180px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .topLinks {
    margin-left: 0;
  }
}

.lead {
  margin: 0;
}

.leadImage {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  background: var(--paper-sunken);
}

.leadAlt,
.leadAltMissing {
  margin-top: 6px;
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.leadAltMissing {
  color: var(--warning);
  font-weight: 500;
}
```

### `src/app/newsroom/(app)/articles/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { bodyMediaIds } from '@/lib/doc/text';
import { requireStaff } from '@/modules/auth/staff';
import { getArticle, publishDue } from '@/modules/editor/queries';
import { mediaByIds } from '@/modules/media/queries';
import { listAuthors, listSections, listTags } from '@/modules/taxonomy/queries';
import { ArticleEditor } from './ArticleEditor';

export const metadata: Metadata = { title: 'Edit article' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  restored: { tone: 'success', text: 'Earlier version restored. The version before it is kept in History.' },
  'delete-failed': { tone: 'error', text: 'The article could not be deleted. Published articles must be unpublished or archived first.' },
};

export default async function EditArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  await publishDue();
  const [article, sections, authors, tags] = await Promise.all([getArticle(id), listSections(), listAuthors(), listTags()]);
  if (!article) notFound();
  const media = await mediaByIds([article.lead_media_id, ...bodyMediaIds(sanitizeDoc(article.body))]);

  return (
    <ArticleEditor
      key={`${article.id}-${article.version}`}
      article={article}
      sections={sections.map(({ id: sid, name, slug }) => ({ id: sid, name, slug }))}
      authors={authors.map(({ id: aid, name, role }) => ({ id: aid, name, role }))}
      tags={tags.map(({ id: tid, name }) => ({ id: tid, name }))}
      media={[...media.values()]}
      notice={notice ? (NOTICES[notice] ?? null) : null}
    />
  );
}
```

### `src/app/newsroom/(app)/authors/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { noticeFor } from '@/components/newsroom/notices';
import { TaxonomyForm } from '@/components/newsroom/TaxonomyForm';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { requireStaff } from '@/modules/auth/staff';
import { mediaByIds } from '@/modules/media/queries';
import { deleteAuthor, saveAuthor } from '@/modules/taxonomy/actions';
import { getAuthor, getUsage } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Edit author' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function EditAuthorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [author, usage] = await Promise.all([getAuthor(id), getUsage()]);
  if (!author) notFound();
  const photo = author.photo_media_id ? ((await mediaByIds([author.photo_media_id])).get(author.photo_media_id) ?? null) : null;
  const articles = usage.authors[id] ?? 0;
  const message = noticeFor('author', notice);

  return (
    <>
      <PageHeader title={author.name} back={{ href: '/newsroom/authors', label: 'Authors' }} />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <TaxonomyForm
        kind="author"
        action={saveAuthor}
        initial={{ id: author.id, name: author.name, slug: author.slug, role: author.role, bio: author.bio, links: author.links, photo }}
        cancelHref="/newsroom/authors"
      />
      <section className={forms.danger}>
        <h2 className={forms.dangerTitle}>
          Delete author
        </h2>
        {articles > 0 ? (
          <p className={forms.dangerText}>
            {articles === 1 ? 'One article credits' : `${articles} articles credit`} this author. Remove the byline from{' '}
            {articles === 1 ? 'that article' : 'those articles'} before deleting.
          </p>
        ) : (
          <form action={deleteAuthor}>
            <input type="hidden" name="id" value={author.id} />
            <ConfirmButton icon="trash" title={`Delete ${author.name}?`} body="The profile is removed. This cannot be undone." confirmLabel="Delete author" danger>
              Delete author
            </ConfirmButton>
          </form>
        )}
      </section>
    </>
  );
}
```

### `src/app/newsroom/(app)/media/[id]/MediaDetailsForm.tsx`

```tsx
'use client';

import { useActionState, useId } from 'react';
import { TextArea, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import { SubmitButton } from '@/components/newsroom/SubmitButton';
import { Notice } from '@/components/newsroom/ui';
import { type MediaFormState, updateMedia } from '@/modules/media/actions';
import type { MediaItem } from '@/modules/media/types';
import { MEDIA_LIMITS } from '@/modules/media/validate';

export function MediaDetailsForm({ media }: { media: MediaItem }) {
  const [state, action] = useActionState<MediaFormState, FormData>(updateMedia, { errors: {} });
  const uid = useId();
  const values = state.values ?? { alt: media.alt, caption: media.caption, credit: media.credit };
  return (
    <form action={action} className={forms.form} noValidate>
      {state.saved && <Notice tone="success">Details saved.</Notice>}
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <input type="hidden" name="id" value={media.id} />
      <TextArea
        id={`${uid}-alt`}
        name="alt"
        label="Alt text"
        rows={3}
        defaultValue={values.alt}
        maxLength={MEDIA_LIMITS.alt}
        error={state.errors.alt}
        hint="What the image shows, for readers who cannot see it. Needed before an article that uses it can be published."
      />
      <TextArea
        id={`${uid}-caption`}
        name="caption"
        label="Default caption"
        optional
        rows={2}
        defaultValue={values.caption}
        maxLength={MEDIA_LIMITS.caption}
        error={state.errors.caption}
        hint="Suggested when the image is added to an article. Each article can change it."
      />
      <TextField
        id={`${uid}-credit`}
        name="credit"
        label="Credit"
        optional
        defaultValue={values.credit}
        maxLength={MEDIA_LIMITS.credit}
        error={state.errors.credit}
        placeholder="Rani Prameswari/PressCompass"
      />
      <div className={forms.actions}>
        <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
      </div>
    </form>
  );
}
```

### `src/app/newsroom/(app)/media/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CloudImage } from '@/components/media/CloudImage';
import styles from '@/components/media/media.module.css';
import { ConfirmButton } from '@/components/newsroom/ConfirmButton';
import forms from '@/components/newsroom/forms.module.css';
import { Notice, PageHeader } from '@/components/newsroom/ui';
import { UUID } from '@/lib/doc/schema';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { STATUS_LABELS, type ArticleStatus } from '@/modules/editor/status';
import { deleteMedia } from '@/modules/media/actions';
import { getMedia, mediaUsage } from '@/modules/media/queries';
import { formatBytes } from '@/modules/media/types';
import { MediaDetailsForm } from './MediaDetailsForm';

export const metadata: Metadata = { title: 'Image' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, string> = {
  'in-use': 'This image is still used. Remove it from the articles and authors listed under Used in, then delete it.',
  'delete-failed': 'The image could not be deleted. Try again.',
};

const ROLE: Record<string, string> = { lead: 'Lead image', body: 'In the text', photo: 'Author photo' };

export default async function MediaItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [media, uses] = await Promise.all([getMedia(id), mediaUsage(id)]);
  if (!media) notFound();

  return (
    <>
      <PageHeader title={media.alt || media.originalName || 'Image'} back={{ href: '/newsroom/media', label: 'Media' }} />
      {notice && NOTICES[notice] && <Notice tone="error">{NOTICES[notice]}</Notice>}
      <div className={styles.detail}>
        <div>
          <CloudImage image={media} alt={media.alt} preset="original" sizes="(max-width: 900px) 100vw, 60vw" priority className={styles.detailImage} />
          <dl className={styles.facts}>
            <dt>File</dt>
            <dd>{media.originalName || '—'}</dd>
            <dt>Size</dt>
            <dd>
              {media.width}×{media.height} px · {formatBytes(media.bytes)} · {media.format.toUpperCase()}
            </dd>
            <dt>Uploaded</dt>
            <dd>{formatWib(media.createdAt)} WIB</dd>
            <dt>Cloudinary ID</dt>
            <dd>{media.publicId}</dd>
          </dl>
        </div>
        <div className={styles.side}>
          <section className={styles.card} aria-label="Details">
            <h2 className={styles.cardTitle}>Details</h2>
            <MediaDetailsForm media={media} />
          </section>
          <section className={styles.card} aria-label="Used in">
            <h2 className={styles.cardTitle}>Used in</h2>
            {uses.length === 0 ? (
              <p className={forms.hint}>Not used yet.</p>
            ) : (
              <ul className={styles.uses}>
                {uses.map((use) => (
                  <li key={`${use.kind}-${use.id}`}>
                    <Link href={use.kind === 'article' ? `/newsroom/articles/${use.id}` : `/newsroom/authors/${use.id}`}>{use.title || 'Untitled'}</Link>
                    <br />
                    <small>
                      {ROLE[use.role]}
                      {use.status && ` · ${STATUS_LABELS[use.status as ArticleStatus]}`}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={styles.card} aria-label="Delete">
            <h2 className={styles.cardTitle}>Delete</h2>
            {uses.length > 0 ? (
              <p className={forms.hint}>Images in use cannot be deleted. Remove it from the places listed above first.</p>
            ) : (
              <form action={deleteMedia}>
                <input type="hidden" name="id" value={media.id} />
                <ConfirmButton
                  icon="trash"
                  title="Delete this image?"
                  body="It is removed from the media library and from Cloudinary. This cannot be undone."
                  confirmLabel="Delete image"
                  danger
                >
                  Delete image
                </ConfirmButton>
              </form>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
```

### `src/app/newsroom/(app)/media/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { CloudImage } from '@/components/media/CloudImage';
import styles from '@/components/media/media.module.css';
import { UploadButton } from '@/components/media/UploadButton';
import { EmptyState, Notice, PageHeader } from '@/components/newsroom/ui';
import articles from '../articles/articles.module.css';
import { requireStaff } from '@/modules/auth/staff';
import { listMedia, MEDIA_PAGE_SIZE, uploadsReady } from '@/modules/media/queries';
import { formatBytes } from '@/modules/media/types';

export const metadata: Metadata = { title: 'Media' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  deleted: { tone: 'success', text: 'Image deleted, here and on Cloudinary.' },
};

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; notice?: string }> }) {
  await requireStaff();
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const { total, items } = await listMedia({ q, page });
  const pages = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE));
  const ready = uploadsReady();
  const notice = params.notice ? NOTICES[params.notice] : null;
  const href = (p: number) => `/newsroom/media?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Media"
        description="Images live on Cloudinary and are sent to readers at the right size and format. Alt text is saved with each image and is needed before an article that uses it can be published."
      />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {!ready && (
        <Notice tone="error">
          Cloudinary is not connected yet, so uploads are off. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env
          on your computer and to Vercel (docs/ops/setup.md, step E).
        </Notice>
      )}
      <UploadButton disabled={!ready} />

      <form className={articles.filters} role="search" action="/newsroom/media">
        <div className={articles.search}>
          <Icon name="search" size={18} />
          <input aria-label="Search images" className={articles.input} type="search" name="q" defaultValue={q} placeholder="Search alt text, captions, credits, file names" />
        </div>
        <Button type="submit" size="sm">
          Search
        </Button>
        {q && (
          <ButtonLink href="/newsroom/media" size="sm" variant="quiet">
            Clear
          </ButtonLink>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState icon="image" title={q ? 'No images match' : 'No images yet'}>
          <p>{q ? 'Try other words or clear the search.' : 'Upload images here, or straight from an article.'}</p>
        </EmptyState>
      ) : (
        <ul className={styles.grid} aria-label="Images">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/newsroom/media/${item.id}`} className={styles.tile}>
                <span className={styles.tileImage}>
                  <CloudImage image={item} alt="" preset="square" sizes="(max-width: 640px) 50vw, 200px" className={styles.thumb} />
                  {!item.alt && <span className={styles.noAlt}>No alt text</span>}
                </span>
                <span className={styles.tileText}>
                  <span className={styles.tileAlt}>{item.alt || item.originalName || 'Untitled image'}</span>
                  <span className={styles.tileMeta}>
                    {item.width}×{item.height} · {formatBytes(item.bytes)} · {item.uses ? `used ${item.uses}×` : 'unused'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > MEDIA_PAGE_SIZE && (
        <div className={articles.pager}>
          <span>
            Showing {(page - 1) * MEDIA_PAGE_SIZE + 1}–{Math.min(page * MEDIA_PAGE_SIZE, total)} of {total}
          </span>
          <span className={articles.pagerLinks}>
            {page > 1 && (
              <ButtonLink href={href(page - 1)} size="sm" icon="arrow-left">
                Previous
              </ButtonLink>
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && (
              <ButtonLink href={href(page + 1)} size="sm">
                Next
              </ButtonLink>
            )}
          </span>
        </div>
      )}
    </>
  );
}
```

### `src/app/newsroom/(app)/newsroom.module.css`

```css
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
  gap: var(--space-4);
}

.navGroup {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.navLabel {
  padding: 0 10px 4px;
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-muted);
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

.grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}

.side2 {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.stats {
  list-style: none;
  margin: 0 0 var(--space-5);
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.stat {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-4);
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  color: var(--ink);
  text-decoration: none;
  transition: border-color 120ms ease-out;
}

.stat:hover {
  border-color: var(--line-strong);
}

.statLabel {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 500 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.statValue {
  margin-top: 10px;
  font: 500 32px/36px var(--font-mono);
  letter-spacing: -0.02em;
}

.statNote {
  font: 400 12px/16px var(--font-mono);
  color: var(--ink-muted);
}

.recent {
  list-style: none;
  margin: 0;
  padding: 0;
}

.recent li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.recent li:last-child {
  border-bottom: 0;
}

.recent a {
  font: 500 15px/22px var(--font-sans);
  color: var(--ink);
  text-decoration: none;
  min-width: 0;
  overflow-wrap: anywhere;
}

.recent a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.recentMeta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
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

.checks a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
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
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
  }

  .grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .side {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    padding: 12px 16px;
    gap: 12px 16px;
  }

  .brandLabel {
    display: none;
  }

  .nav,
  .navGroup {
    flex-direction: row;
    gap: 2px;
  }

  .nav {
    order: 3;
    flex: 1 1 100%;
    overflow-x: auto;
    margin: 0 -16px;
    padding: 0 16px;
  }

  .navLabel {
    display: none;
  }

  .nav a {
    white-space: nowrap;
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

.loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 640px;
  padding-top: var(--space-2);
}

.loadingBar {
  display: block;
  height: 16px;
  border-radius: var(--radius-sm);
  background: var(--paper-sunken);
}

.loadingBar:first-child {
  width: 40%;
  height: 32px;
  margin-bottom: var(--space-3);
}

.loadingBar:nth-child(3) {
  width: 70%;
}

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
```

### `src/app/newsroom/(app)/page.tsx`

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ds/Icon';
import { StatusBadge } from '@/components/newsroom/StatusBadge';
import { SubmitButton } from '@/components/newsroom/SubmitButton';
import { EmptyState, PageHeader } from '@/components/newsroom/ui';
import { deployEnv } from '@/lib/env';
import { createSessionClient } from '@/lib/supabase/clients';
import { formatWib, wibDayStart } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { createArticle } from '@/modules/editor/actions';
import { getDashboard, listArticles, publishDue } from '@/modules/editor/queries';
import { uploadsReady } from '@/modules/media/queries';
import styles from './newsroom.module.css';

export const metadata: Metadata = { title: 'Dashboard' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

async function databaseCheck(): Promise<{ ok: boolean; detail: string }> {
  try {
    const supabase = await createSessionClient();
    const { count, error } = await supabase.from('sections').select('id', { count: 'exact', head: true });
    if (error) return { ok: false, detail: error.message };
    return { ok: true, detail: `Connected. ${count ?? 0} ${count === 1 ? 'section' : 'sections'}.` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

const NEXT_STEPS = [
  ['v0.4.0', 'Public site'],
  ['v0.5.0', 'Homepage, navigation, pages and site settings'],
  ['v0.6.0', 'SEO tools'],
  ['v0.7.0', 'Automatic indexing and the SEO dashboard'],
] as const;

export default async function DashboardPage() {
  const staff = await requireStaff();
  await publishDue();
  const now = new Date();
  const [stats, recent, database] = await Promise.all([getDashboard(wibDayStart(now)), listArticles({ limit: 6 }), databaseCheck()]);
  const environment = deployEnv();
  const mediaReady = uploadsReady();

  const cards: { label: string; icon: IconName; value: number; note: string; href: string }[] = [
    { label: 'Published today', icon: 'check', value: stats.published_today, note: formatWib(now, 'date'), href: '/newsroom/articles?status=published' },
    { label: 'In review', icon: 'eye', value: stats.review, note: stats.review ? 'Waiting for a final read' : 'Nothing waiting', href: '/newsroom/articles?status=review' },
    {
      label: 'Scheduled',
      icon: 'clock',
      value: stats.scheduled,
      note: stats.next_scheduled_at ? `Next ${formatWib(stats.next_scheduled_at, 'short')}` : 'Nothing scheduled',
      href: '/newsroom/articles?status=scheduled',
    },
    { label: 'Drafts', icon: 'edit', value: stats.drafts, note: 'Saved as you write', href: '/newsroom/articles?status=draft' },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <form action={createArticle}>
            <SubmitButton icon="plus" pendingLabel="Creating…">
              New article
            </SubmitButton>
          </form>
        }
      />
      <ul className={styles.stats} aria-label="Articles at a glance">
        {cards.map((card) => (
          <li key={card.label}>
            <Link href={card.href} className={styles.stat}>
              <span className={styles.statLabel}>
                <Icon name={card.icon} size={16} />
                {card.label}
              </span>
              <b className={styles.statValue}>{card.value}</b>
              <small className={styles.statNote}>{card.note}</small>
            </Link>
          </li>
        ))}
      </ul>

      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Recently updated">
          <h2 className={styles.panelTitle}>
            Recently updated
          </h2>
          {recent.rows.length === 0 ? (
            <EmptyState icon="file" title="No articles yet">
              <p>New article opens a draft that saves itself every 10 seconds.</p>
            </EmptyState>
          ) : (
            <ul className={styles.recent}>
              {recent.rows.map((row) => (
                <li key={row.id}>
                  <Link href={`/newsroom/articles/${row.id}`}>{row.title || 'Untitled'}</Link>
                  <span className={styles.recentMeta}>
                    <StatusBadge status={row.status} />
                    <time dateTime={row.updated_at}>{formatWib(row.updated_at, 'short')}</time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className={styles.side2}>
          <section className={styles.panel} aria-label="System">
            <h2 className={styles.panelTitle}>
              System
            </h2>
            <ul className={styles.checks}>
              <li>
                <Icon name={database.ok ? 'check' : 'alert'} size={16} className={database.ok ? styles.ok : styles.bad} />
                <span>
                  <b>Database</b> {database.detail}
                </span>
              </li>
              <li>
                <Icon name={mediaReady ? 'check' : 'alert'} size={16} className={mediaReady ? styles.ok : styles.bad} />
                <span>
                  <b>Media</b>{' '}
                  {mediaReady ? (
                    'Cloudinary connected.'
                  ) : (
                    <>
                      Cloudinary is not connected. <Link href="/newsroom/media">See how</Link>.
                    </>
                  )}
                </span>
              </li>
              <li>
                <Icon name="check" size={16} className={styles.ok} />
                <span>
                  <b>Deployment</b> {environment === 'production' ? 'Production' : 'Preview or local'}
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
          <section className={styles.panel} aria-label="Coming next">
            <h2 className={styles.panelTitle}>
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
      </div>
    </>
  );
}
```

### `src/app/newsroom/preview/[id]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { type Block, UUID } from '@/lib/doc/schema';
import { bodyMediaIds, docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { CloudImage } from '@/components/media/CloudImage';
import { ArticleBody, BODY_IMAGE_SIZES } from '@/modules/content/ArticleBody';
import { mediaByIds } from '@/modules/media/queries';
import { TYPE_LABELS } from '@/modules/editor/input';
import { articleLinks, getArticle, getRevision } from '@/modules/editor/queries';
import { STATUS_LABELS } from '@/modules/editor/status';
import { getSection, listAuthors } from '@/modules/taxonomy/queries';
import styles from './preview.module.css';

export const metadata: Metadata = { title: 'Preview' };

// Previews read the session and drafts on every request.
export const instant = false;

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ revision?: string }> }) {
  await requireStaff();
  const [{ id }, { revision: revisionParam }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const article = await getArticle(id);
  if (!article) notFound();

  const revisionId = Number(revisionParam);
  const revision = revisionParam && Number.isInteger(revisionId) ? await getRevision(id, revisionId) : null;
  const snap = revision?.snapshot ?? {};
  const view = {
    title: snap.title ?? article.title,
    standfirst: snap.standfirst ?? article.standfirst,
    kicker: snap.kicker_label ?? article.kicker_label,
    type: snap.type ?? article.type,
    sectionId: snap.section_id !== undefined ? snap.section_id : article.section_id,
    authorIds: snap.authors ?? article.authorIds,
    body: sanitizeDoc(snap.body ?? article.body),
    sources: snap.sources ?? article.sources,
    leadMediaId: snap.lead_media_id !== undefined ? snap.lead_media_id : article.lead_media_id,
    leadCaption: snap.lead_caption ?? article.lead_caption,
  };

  const readMoreIds = view.body.content.filter((block): block is Extract<Block, { type: 'readMore' }> => block.type === 'readMore').map((block) => block.attrs.articleId);
  const [section, authors, links, media] = await Promise.all([
    view.sectionId ? getSection(view.sectionId) : null,
    listAuthors(),
    articleLinks(readMoreIds),
    mediaByIds([view.leadMediaId, ...bodyMediaIds(view.body)]),
  ]);
  const lead = view.leadMediaId ? media.get(view.leadMediaId) : undefined;
  const byline = view.authorIds.map((authorId) => authors.find((a) => a.id === authorId)).filter((a) => a !== undefined);
  const minutes = readingMinutes(wordCount(docText(view.body)));
  const dateLine = article.published_at
    ? `${formatWib(article.published_at)} WIB`
    : article.scheduled_at
      ? `Scheduled for ${formatWib(article.scheduled_at)} WIB`
      : 'Not published yet';
  const kicker = view.kicker || section?.name || TYPE_LABELS[view.type];

  return (
    <div className={styles.page}>
      <div className={styles.bar} role="region" aria-label="Preview">
        <p>
          <b>{revision ? `Version from ${formatWib(revision.created_at)} WIB` : `Preview · ${STATUS_LABELS[article.status]}`}</b>
          <span>
            {revision
              ? 'This is an older version from the history. It is not on the site.'
              : article.status === 'published'
                ? 'Readers see this version.'
                : 'Readers cannot see this page.'}
          </span>
        </p>
        <ButtonLink href={revision ? `/newsroom/articles/${id}/history` : `/newsroom/articles/${id}`} size="sm" icon="arrow-left">
          {revision ? 'Back to history' : 'Back to editor'}
        </ButtonLink>
      </div>
      <header className={styles.masthead}>
        <Logo height={30} />
      </header>
      <main className={styles.wrap}>
        <article className={styles.article}>
          <header className={styles.head}>
            <p className={styles.kickers}>
              <span className={styles.kicker}>{kicker}</span>
              {view.type !== 'news' && kicker !== TYPE_LABELS[view.type] && <span className={styles.kickerPlain}>{TYPE_LABELS[view.type]}</span>}
            </p>
            <h1 className={styles.headline}>{view.title || 'Untitled'}</h1>
            {view.standfirst && <p className={styles.stand}>{view.standfirst}</p>}
          </header>
          <div className={styles.byline}>
            <p className={styles.who}>
              {byline.length ? (
                <>
                  By{' '}
                  {byline.map((author, index) => (
                    <span key={author.id}>
                      {index > 0 && (index === byline.length - 1 ? ' and ' : ', ')}
                      <b>{author.name}</b>
                    </span>
                  ))}
                  {byline.length === 1 && byline[0].role && <span className={styles.role}> · {byline[0].role}</span>}
                </>
              ) : (
                <span className={styles.role}>No author yet</span>
              )}
            </p>
            <p className={styles.meta}>
              {dateLine}
              {minutes > 0 && ` · ${minutes} min read`}
            </p>
          </div>
          {lead && (
            <figure className={styles.leadFig}>
              <CloudImage image={lead} alt={lead.alt} preset="hero" sizes={BODY_IMAGE_SIZES} priority className={styles.leadImage} />
              {(view.leadCaption || lead.credit) && (
                <figcaption className={styles.cap}>
                  {view.leadCaption}
                  {view.leadCaption && lead.credit && ' '}
                  {lead.credit && <span className={styles.credit}>Photo: {lead.credit}</span>}
                </figcaption>
              )}
            </figure>
          )}
          <ArticleBody doc={view.body} links={links} media={media} />
          {view.sources.length > 0 && (
            <section className={styles.sources} aria-label="Sources">
              <h2>Sources</h2>
              <ol>
                {view.sources.map((source, index) => (
                  <li key={index}>
                    {/^https?:\/\//i.test(source.url) ? (
                      <a href={source.url} rel="noopener">
                        {source.title}
                      </a>
                    ) : (
                      source.title
                    )}
                    {source.publisher && `, ${source.publisher}`}
                    {source.accessed && ` (accessed ${formatWib(`${source.accessed}T00:00:00+07:00`, 'date')})`}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </article>
      </main>
    </div>
  );
}
```

### `src/app/newsroom/preview/[id]/preview.module.css`

```css
/* Article preview in the site's article layout (locked preview: .art, .art-head, .byline). */

.page {
  min-height: 100vh;
  background: var(--paper);
  padding-bottom: var(--space-9);
}

.bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 10px var(--gutter, 24px);
  background: var(--meridian-soft);
  color: var(--meridian);
  border-bottom: 1px solid var(--line);
  font: 400 14px/20px var(--font-sans);
}

.bar p {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.bar b {
  font-weight: 600;
}

.masthead {
  display: flex;
  justify-content: center;
  padding: var(--space-5) var(--space-4);
  border-bottom: 1px solid var(--line);
  color: var(--ink);
}

.wrap {
  padding: 0 var(--space-4);
}

.article {
  max-width: 680px;
  margin: 0 auto;
  padding-top: var(--space-7);
}

.head {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: var(--space-5);
}

.kickers {
  display: flex;
  gap: 12px;
  align-items: center;
}

.kicker,
.kickerPlain {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.kickerPlain {
  color: var(--ink-muted);
}

.headline {
  font: 500 clamp(32px, 3.6vw, 44px) / 1.12 var(--font-serif);
  letter-spacing: -0.01em;
  font-variation-settings: 'opsz' 60;
  text-wrap: balance;
}

.stand {
  font: 400 21px/31px var(--font-serif);
  font-variation-settings: 'opsz' 24;
  color: var(--ink-secondary);
  text-wrap: pretty;
}

.byline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 0;
  margin-bottom: var(--space-6);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.who {
  font: 400 14px/20px var(--font-sans);
}

.who b {
  font-weight: 600;
}

.role {
  color: var(--ink-secondary);
}

.meta {
  font: 400 13px/20px var(--font-mono);
  color: var(--ink-muted);
}

.leadFig {
  margin: 0 0 var(--space-6);
}

.leadImage {
  display: block;
  width: 100%;
  height: auto;
  background: var(--paper-sunken);
}

.cap {
  margin-top: 8px;
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.credit {
  color: var(--ink-muted);
}

.sources {
  margin-top: var(--space-7);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line);
  font: 400 14px/21px var(--font-sans);
  color: var(--ink-secondary);
}

.sources h2 {
  margin-bottom: var(--space-2);
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink);
}

.sources ol {
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sources a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 640px) {
  .stand {
    font-size: 19px;
    line-height: 28px;
  }
}
```

### `src/components/media/AuthorPhotoField.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ds/Button';
import forms from '@/components/newsroom/forms.module.css';
import type { MediaItem } from '@/modules/media/types';
import { CloudImage } from './CloudImage';
import { ImagePickerDialog } from './ImagePickerDialog';
import styles from './media.module.css';

/** The author's profile photo: chosen from the media library, sent with the form as `photo_media_id`. */
export function AuthorPhotoField({ initial }: { initial: MediaItem | null }) {
  const [photo, setPhoto] = useState<MediaItem | null>(initial);
  const [picking, setPicking] = useState(false);

  return (
    <fieldset className={forms.fieldset}>
      <legend className={forms.label}>
        Photo <span className={forms.optional}>(optional)</span>
      </legend>
      <input type="hidden" name="photo_media_id" value={photo?.id ?? ''} />
      <div className={styles.photoField}>
        {photo ? (
          <CloudImage image={photo} alt="" preset="square" sizes="96px" className={styles.photo} />
        ) : (
          <span className={styles.photoEmpty} aria-hidden="true" />
        )}
        <div className={styles.photoSide}>
          <p className={photo && !photo.alt ? styles.noAltText : forms.hint}>
            {photo ? (photo.alt ? `Alt text: ${photo.alt}` : 'No alt text yet. Add it so screen readers can describe the photo.') : 'Shown on the author page and next to the byline. A square crop is made automatically.'}
          </p>
          <div className={styles.photoButtons}>
            <Button size="sm" icon="image" onClick={() => setPicking(true)}>
              {photo ? 'Change photo' : 'Choose photo'}
            </Button>
            {photo && (
              <Button size="sm" variant="quiet" onClick={() => setPhoto(null)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      {picking && (
        <ImagePickerDialog
          title="Author photo"
          initial={photo}
          caption={null}
          submitLabel="Use as photo"
          onClose={() => setPicking(false)}
          onSave={({ media }) => {
            setPhoto(media);
            setPicking(false);
          }}
        />
      )}
    </fieldset>
  );
}
```

### `src/components/media/CloudImage.tsx`

```tsx
import { delivery, type ImageRef, imageSources, type Preset } from '@/lib/media/url';

/**
 * A Cloudinary image with srcset, sizes and intrinsic width and height (no layout shift).
 * A plain <img>: Cloudinary does the resizing, so next/image would only add client JavaScript.
 * Works in Server and Client Components. Without a cloud name it renders a labelled placeholder.
 */
export function CloudImage({
  image,
  alt,
  preset = 'original',
  sizes,
  priority = false,
  className,
}: {
  image: ImageRef;
  alt: string;
  preset?: Preset;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const config = delivery();
  if (!config.cloudName) return <span className={className} role="img" aria-label={alt || 'Image'} data-cloudinary-missing="" />;
  const source = imageSources(config, image, preset);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves every size in srcset; see src/lib/media/url.ts.
    <img
      src={source.src}
      srcSet={source.srcSet}
      sizes={sizes}
      width={source.width}
      height={source.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  );
}
```

### `src/components/media/ImagePickerDialog.tsx`

```tsx
'use client';

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { TextArea, TextField } from '@/components/newsroom/Field';
import forms from '@/components/newsroom/forms.module.css';
import ui from '@/components/newsroom/ui.module.css';
import { saveMediaDetails, searchMedia } from '@/modules/media/actions';
import type { MediaItem } from '@/modules/media/types';
import { ACCEPTED_TYPES, MEDIA_LIMITS } from '@/modules/media/validate';
import { CloudImage } from './CloudImage';
import styles from './media.module.css';
import { uploadImage } from './upload';

// Choose an image from the library or upload a new one, then confirm its alt text (stored on the
// image), credit, and the caption for this use. Rendered in a portal, outside the article editor.

export type PickedImage = { media: MediaItem; caption: string };

export function ImagePickerDialog({
  title,
  initial,
  caption,
  submitLabel,
  onSave,
  onClose,
}: {
  title: string;
  initial: MediaItem | null;
  /** The caption for this use; null hides the field (it is edited elsewhere). */
  caption: string | null;
  submitLabel: string;
  onSave: (picked: PickedImage) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaItem | null>(initial);
  const [alt, setAlt] = useState(initial?.alt ?? '');
  const [credit, setCredit] = useState(initial?.credit ?? '');
  const [captionValue, setCaptionValue] = useState(caption ?? '');
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Open as a modal on mount. No close() on cleanup (React runs effects twice in development).
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const load = useCallback(async (q: string, nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchMedia(q, nextPage);
      setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
      setTotal(result.total);
      setPage(nextPage);
    } catch {
      setError('The media library could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // First page of the library when the dialog opens.
  useEffect(() => {
    let active = true;
    searchMedia('', 1)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => active && setError('The media library could not be loaded. Try again.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function choose(item: MediaItem) {
    setSelected(item);
    setAlt(item.alt);
    setCredit(item.credit);
    if (caption !== null && (!captionValue || captionValue === selected?.caption)) setCaptionValue(item.caption);
    setFieldErrors({});
  }

  async function upload(file: File) {
    setError(null);
    setUploading(0);
    try {
      const media = await uploadImage(file, setUploading);
      setItems((current) => [media, ...current.filter((item) => item.id !== media.id)]);
      setTotal((current) => current + 1);
      choose(media);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setUploading(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!selected) {
      setError('Choose an image or upload one.');
      return;
    }
    let media = selected;
    if (alt.trim() !== selected.alt || credit.trim() !== selected.credit) {
      setSaving(true);
      const result = await saveMediaDetails(selected.id, { alt, credit, caption: selected.caption });
      setSaving(false);
      if (!result.ok) {
        setFieldErrors((result.errors as Record<string, string>) ?? {});
        if (result.error) setError(result.error);
        return;
      }
      media = result.media;
    }
    onSave({ media, caption: captionValue.trim() });
  }

  return createPortal(
    <dialog ref={dialog} className={`${ui.dialog} ${styles.picker}`} aria-labelledby={`${uid}-heading`} onCancel={onClose} onClose={onClose}>
      <form className={styles.pickerForm} onSubmit={submit} noValidate>
        <h2 id={`${uid}-heading`} className={ui.dialogTitle}>
          {title}
        </h2>

        <div className={styles.pickerBar}>
          <label htmlFor={`${uid}-file`} className={styles.uploadLabel} data-disabled={uploading !== null ? '' : undefined}>
            <Icon name="plus" size={18} />
            {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : 'Upload an image'}
          </label>
          <input
            id={`${uid}-file`}
            className={styles.fileInput}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            disabled={uploading !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void upload(file);
            }}
          />
          <div className={styles.pickerSearch}>
            <input
              type="search"
              aria-label="Search the media library"
              placeholder="Search alt text, captions, file names"
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void load(query, 1);
                }
              }}
            />
            <Button size="sm" onClick={() => void load(query, 1)} disabled={loading}>
              Search
            </Button>
          </div>
        </div>

        {error && <p className={forms.error}>{error}</p>}

        <ul className={styles.pickerGrid} aria-label="Images">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.pickerItem}
                aria-pressed={selected?.id === item.id}
                aria-label={`${item.alt || item.originalName || 'Image without alt text'}${item.alt ? '' : ' (no alt text)'}`}
                onClick={() => choose(item)}
              >
                <CloudImage image={item} alt="" preset="square" sizes="120px" className={styles.thumb} />
                {!item.alt && <span className={styles.noAlt}>No alt</span>}
              </button>
            </li>
          ))}
        </ul>
        {!loading && items.length === 0 && <p className={forms.hint}>{query ? 'No images match.' : 'The library is empty. Upload the first image.'}</p>}
        {items.length < total && (
          <Button size="sm" variant="quiet" onClick={() => void load(query, page + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Show more'}
          </Button>
        )}

        {selected && (
          <div className={styles.pickerDetails}>
            <CloudImage image={selected} alt="" preset="original" sizes="200px" className={styles.preview} />
            <div className={styles.pickerFields}>
              <TextArea
                id={`${uid}-alt`}
                label="Alt text"
                rows={2}
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                maxLength={MEDIA_LIMITS.alt}
                error={fieldErrors.alt}
                hint="Describe the image for readers who cannot see it. Needed before publishing. Saved with the image."
              />
              {caption !== null && (
                <TextArea
                  id={`${uid}-caption`}
                  label="Caption"
                  optional
                  rows={2}
                  value={captionValue}
                  onChange={(event) => setCaptionValue(event.target.value)}
                  maxLength={MEDIA_LIMITS.caption}
                  hint="Shown under the image in this article."
                />
              )}
              <TextField
                id={`${uid}-credit`}
                label="Credit"
                optional
                value={credit}
                onChange={(event) => setCredit(event.target.value)}
                maxLength={MEDIA_LIMITS.credit}
                error={fieldErrors.credit}
                placeholder="Rani Prameswari/PressCompass"
              />
            </div>
          </div>
        )}

        <div className={ui.dialogActions}>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!selected || saving || uploading !== null}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
```

### `src/components/media/UploadButton.tsx`

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { Notice } from '@/components/newsroom/ui';
import { ACCEPTED_TYPES } from '@/modules/media/validate';
import styles from './media.module.css';
import { uploadImage } from './upload';

/** Upload one or more images from the media library page. */
export function UploadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const uid = useId();
  const [progress, setProgress] = useState<{ index: number; total: number; share: number } | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function upload(files: File[]) {
    setResult(null);
    const failures: { name: string; message: string }[] = [];
    let done = 0;
    for (const [index, file] of files.entries()) {
      setProgress({ index, total: files.length, share: 0 });
      try {
        await uploadImage(file, (share) => setProgress({ index, total: files.length, share }));
        done += 1;
      } catch (error) {
        failures.push({ name: file.name, message: (error as Error).message });
      }
    }
    setProgress(null);
    if (input.current) input.current.value = '';
    // One reason for every file (Cloudinary not connected, say) is said once, not per file.
    const shared = failures.length > 1 && !done && failures.every((failure) => failure.message === failures[0].message);
    setResult(
      failures.length
        ? {
            tone: 'error',
            text: shared ? failures[0].message : `${done ? `${done} uploaded. ` : ''}${failures.map((failure) => `${failure.name}: ${failure.message}`).join(' ')}`,
          }
        : { tone: 'success', text: done === 1 ? 'Image uploaded. Add its alt text before using it in a published article.' : `${done} images uploaded.` },
    );
    router.refresh();
  }

  return (
    <div className={styles.uploader}>
      <label htmlFor={`${uid}-file`} className={styles.uploadLabel} data-disabled={disabled || progress ? '' : undefined}>
        <Icon name="plus" size={18} />
        {progress ? `Uploading ${progress.index + 1} of ${progress.total}…` : 'Upload images'}
      </label>
      <input
        ref={input}
        id={`${uid}-file`}
        className={styles.fileInput}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        disabled={disabled || Boolean(progress)}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length) void upload(files);
        }}
      />
      {progress && (
        <progress className={styles.progress} max={1} value={progress.share} aria-label="Upload progress">
          {Math.round(progress.share * 100)}%
        </progress>
      )}
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
    </div>
  );
}
```

### `src/components/media/media.module.css`

```css
/* Media library, uploader and image picker. */

.uploader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.uploader > [role='status'],
.uploader > [role='alert'] {
  flex-basis: 100%;
  margin: 0;
}

.uploadLabel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  background: var(--navy);
  color: var(--on-navy);
  font: 600 14px/20px var(--font-sans);
  cursor: pointer;
  white-space: nowrap;
}

.uploadLabel:hover {
  background: var(--navy-hover, var(--navy));
}

.uploadLabel[data-disabled] {
  opacity: 0.6;
  cursor: progress;
}

.fileInput {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}

.fileInput:focus-visible + .uploadLabel,
.uploadLabel:has(+ .fileInput:focus-visible) {
  outline: 2px solid var(--focus-ring, var(--meridian));
  outline-offset: 2px;
}

.progress {
  width: 200px;
  height: 8px;
  accent-color: var(--meridian);
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-4);
}

.tile {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
  overflow: hidden;
  color: var(--ink);
  text-decoration: none;
}

.tile:hover {
  border-color: var(--line-strong);
}

.tileImage {
  position: relative;
  aspect-ratio: 1;
  background: var(--paper-sunken);
}

.thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--paper-sunken);
}

.tileText {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px 12px;
  min-width: 0;
}

.tileAlt {
  font: 500 14px/20px var(--font-sans);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tileMeta {
  font: 400 12px/16px var(--font-mono);
  color: var(--ink-muted);
}

.noAlt {
  position: absolute;
  left: 6px;
  top: 6px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  color: var(--warning);
  font: 600 11px/16px var(--font-sans);
}

.missing {
  color: var(--warning) !important;
}

.picker {
  width: min(880px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.pickerForm {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pickerBar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.pickerSearch {
  display: flex;
  gap: var(--space-2);
  flex: 1 1 280px;
}

.searchInput {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  font: 400 14px/20px var(--font-sans);
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
}

.pickerGrid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--space-2);
  max-height: 300px;
  overflow-y: auto;
}

.pickerItem {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--paper-sunken);
  overflow: hidden;
  cursor: pointer;
}

.pickerItem[aria-pressed='true'] {
  border-color: var(--meridian);
  box-shadow: 0 0 0 2px var(--meridian-soft);
}

.pickerDetails {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
}

.preview {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  background: var(--paper-sunken);
}

.pickerFields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.detail {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
  gap: var(--space-6);
  align-items: start;
}

.detailImage {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  background: var(--paper-sunken);
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  margin: var(--space-4) 0 0;
  font: 400 14px/20px var(--font-sans);
}

.facts dt {
  color: var(--ink-muted);
}

.facts dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.side {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.cardTitle {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.uses {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font: 400 14px/20px var(--font-sans);
}

.uses a {
  color: var(--ink);
  font-weight: 500;
}

.uses small {
  color: var(--ink-muted);
}

@media (max-width: 900px) {
  .detail {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .pickerGrid {
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    max-height: 200px;
  }

  .pickerDetails {
    grid-template-columns: minmax(0, 1fr);
  }

  .pickerDetails .preview {
    width: auto;
    max-width: 100%;
    max-height: 140px;
  }
}

/* Author photo field */
.photoField {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.photo,
.photoEmpty {
  flex: none;
  display: block;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--paper-sunken);
  border: 1px solid var(--line);
}

.photoSide {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.photoButtons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.noAltText {
  font: 500 13px/18px var(--font-sans);
  color: var(--warning);
}
```

### `src/components/media/upload.ts`

```ts
'use client';

import { prepareUpload, registerUpload } from '@/modules/media/actions';
import type { MediaItem } from '@/modules/media/types';
import { checkFile } from '@/modules/media/validate';

// Uploads one file: check it, get signed fields from the server, send it straight to Cloudinary
// (XMLHttpRequest, for progress), then let the server record it. Throws an Error with a message
// the Newsroom can show as is.

function send(url: string, form: FormData, onProgress: (share: number) => void): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = {};
      }
      resolve({ status: request.status, body });
    };
    request.onerror = () => reject(new Error('The upload was interrupted. Check your connection and try again.'));
    request.send(form);
  });
}

export async function uploadImage(file: File, onProgress: (share: number) => void = () => {}): Promise<MediaItem> {
  const problem = checkFile(file);
  if (problem) throw new Error(problem);
  const prepared = await prepareUpload({ name: file.name, type: file.type, size: file.size });
  if (!prepared.ok) throw new Error(prepared.error);

  const form = new FormData();
  for (const [key, value] of Object.entries(prepared.plan.fields)) form.append(key, value);
  form.append('file', file);
  const sent = await send(prepared.plan.uploadUrl, form, onProgress);
  if (sent.status < 200 || sent.status >= 300) {
    const message = (sent.body.error as { message?: string } | undefined)?.message;
    throw new Error(`Cloudinary refused the file${message ? `: ${message}` : '.'}`);
  }

  const recorded = await registerUpload({ publicId: prepared.plan.publicId, originalName: file.name });
  if (!recorded.ok) throw new Error(recorded.error ?? 'The image could not be saved.');
  return recorded.media;
}
```

### `src/components/newsroom/SideNav.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ds/Icon';

const GROUPS: { label?: string; links: { href: string; label: string; icon: IconName }[] }[] = [
  { links: [{ href: '/newsroom', label: 'Dashboard', icon: 'grid' }] },
  {
    label: 'Content',
    links: [
      { href: '/newsroom/articles', label: 'Articles', icon: 'file' },
      { href: '/newsroom/sections', label: 'Sections', icon: 'folder' },
      { href: '/newsroom/tags', label: 'Tags', icon: 'tag' },
      { href: '/newsroom/authors', label: 'Authors', icon: 'users' },
      { href: '/newsroom/media', label: 'Media', icon: 'image' },
    ],
  },
];

function isCurrent(pathname: string, href: string) {
  return href === '/newsroom' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ className, groupClassName, labelClassName }: { className: string; groupClassName: string; labelClassName: string }) {
  const pathname = usePathname();
  return (
    <nav className={className} aria-label="Newsroom sections">
      {GROUPS.map((group, index) => (
        <div key={group.label ?? index} className={groupClassName} role="group" aria-label={group.label}>
          {group.label && (
            <p className={labelClassName} aria-hidden="true">
              {group.label}
            </p>
          )}
          {group.links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}>
              <Icon name={link.icon} />
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
```

### `src/components/newsroom/TaxonomyForm.tsx`

```tsx
'use client';

import { useActionState, useId, useState } from 'react';
import { ButtonLink } from '@/components/ds/Button';
import { AuthorPhotoField } from '@/components/media/AuthorPhotoField';
import type { MediaItem } from '@/modules/media/types';
import { slugify } from '@/lib/slug';
import type { FormState } from '@/modules/taxonomy/actions';
import { AUTHOR_LINK_ROWS, type AuthorLink } from '@/modules/taxonomy/validate';
import { CheckboxField, TextArea, TextField } from './Field';
import styles from './forms.module.css';
import { SubmitButton } from './SubmitButton';
import { Notice } from './ui';

type Kind = 'section' | 'tag' | 'author';

export type TaxonomyValues = {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  inNav?: boolean;
  role?: string;
  bio?: string;
  links?: AuthorLink[];
  photo?: MediaItem | null;
};

const PREFIX: Record<Kind, string> = { section: '/', tag: '/tag/', author: '/author/' };

/** Create or edit form for a section, tag or author. The address follows the name until it is edited. */
export function TaxonomyForm({
  kind,
  action,
  initial,
  cancelHref,
}: {
  kind: Kind;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial: TaxonomyValues;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, { errors: {} });
  // Ids must be unique per mount: Next keeps recently visited pages in the DOM (hidden) for instant back navigation.
  const uid = useId();
  const editing = Boolean(initial.id);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(editing);
  const values = { ...initial, ...(state.values as Partial<TaxonomyValues> | undefined) };
  const errors = state.errors;
  const links = [...(values.links ?? [])];
  while (links.length < AUTHOR_LINK_ROWS) links.push({ label: '', url: '' });

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.message && <Notice tone="error">{state.message}</Notice>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <TextField
        id={`${uid}-name`}
        name="name"
        label="Name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (!slugTouched) setSlug(slugify(event.target.value));
        }}
        error={errors.name}
        required
        maxLength={kind === 'author' ? 80 : 60}
      />
      <TextField
        id={`${uid}-slug`}
        name="slug"
        label="Address"
        mono
        value={slug}
        onChange={(event) => {
          setSlug(event.target.value);
          setSlugTouched(true);
        }}
        onBlur={() => setSlug((current) => slugify(current) || current)}
        error={errors.slug}
        hint={
          editing
            ? `presscompass.site${PREFIX[kind]}${slug || '…'} · Changing it adds a redirect from the old address once readers can see it.`
            : `presscompass.site${PREFIX[kind]}${slug || '…'} · Fills in from the name.`
        }
      />
      {kind === 'author' && (
        <TextField id={`${uid}-role`} name="role" label="Role" optional defaultValue={values.role} error={errors.role} placeholder="Business correspondent" maxLength={80} />
      )}
      {kind === 'author' && <AuthorPhotoField initial={initial.photo ?? null} />}
      {kind === 'author' ? (
        <TextArea id={`${uid}-bio`} name="bio" label="Biography" optional rows={5} defaultValue={values.bio} error={errors.bio} maxLength={1000} />
      ) : (
        <TextArea
          id={`${uid}-description`}
          name="description"
          label="Description"
          optional
          rows={3}
          defaultValue={values.description}
          error={errors.description}
          maxLength={300}
          hint={kind === 'section' ? 'Shown on the section page and in search results.' : 'Shown on the tag page.'}
        />
      )}
      {kind === 'section' && (
        <CheckboxField id={`${uid}-in-nav`} name="in_nav" label="Show in the main navigation" defaultChecked={values.inNav ?? true} />
      )}
      {kind === 'author' && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>
            Profile links <span className={styles.optional}>(optional)</span>
          </legend>
          {errors.links && <Notice tone="error">{errors.links}</Notice>}
          {links.map((link, index) => (
            <div className={styles.row} key={index}>
              <TextField id={`${uid}-link-label-${index}`} name={`link_label_${index}`} label={`Link ${index + 1} label`} defaultValue={link.label} placeholder={index === 0 ? 'Website' : undefined} maxLength={40} />
              <TextField id={`${uid}-link-url-${index}`} name={`link_url_${index}`} label={`Link ${index + 1} address`} type="url" defaultValue={link.url} placeholder="https://" mono />
            </div>
          ))}
        </fieldset>
      )}
      <div className={styles.actions}>
        <SubmitButton pendingLabel="Saving…">{editing ? 'Save changes' : `Create ${kind}`}</SubmitButton>
        <ButtonLink href={cancelHref} variant="quiet">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
```

### `src/components/newsroom/editor/BlockCard.tsx`

```tsx
'use client';

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { createContext, useContext, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { CloudImage } from '@/components/media/CloudImage';
import { ImagePickerDialog } from '@/components/media/ImagePickerDialog';
import { BlockDialog } from './BlockDialog';
import styles from './editor.module.css';
import type { SpecialKind } from './extensions';
import { MediaLookupContext } from './media-context';
import type { MediaItem } from '@/modules/media/types';

// How a special block looks inside the editor: a labelled card with a short preview, Edit and Remove.

export const ArticleIdContext = createContext('');

const META: Record<SpecialKind, { label: string; icon: IconName }> = {
  pullQuote: { label: 'Pull quote', icon: 'quote' },
  editorNote: { label: "Editor's note", icon: 'info' },
  keyFigures: { label: 'Key figures', icon: 'chart' },
  youtube: { label: 'YouTube video', icon: 'video' },
  readMore: { label: 'Read more', icon: 'link' },
  image: { label: 'Image', icon: 'image' },
};

function summary(kind: SpecialKind, attrs: Record<string, unknown>) {
  switch (kind) {
    case 'pullQuote':
      return `“${attrs.text}”${attrs.attribution ? ` — ${attrs.attribution}` : ''}`;
    case 'editorNote':
      return `${attrs.kind === 'correction' ? 'Correction' : 'Update'}${attrs.date ? ` (${attrs.date})` : ''}: ${attrs.text}`;
    case 'keyFigures':
      return (attrs.items as { value: string; label: string }[]).map((item) => `${item.value} ${item.label}`).join(' · ');
    case 'youtube':
      return `${attrs.title} (youtube.com/watch?v=${attrs.videoId})`;
    case 'readMore':
      return String(attrs.title || 'Untitled');
    case 'image':
      return String(attrs.caption || '');
  }
}

export function BlockCard({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const kind = node.type.name as SpecialKind;
  const articleId = useContext(ArticleIdContext);
  const lookup = useContext(MediaLookupContext);
  const [editing, setEditing] = useState(false);
  const meta = META[kind];
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className={styles.card} data-selected={selected || undefined} contentEditable={false} data-drag-handle="">
      <p className={styles.cardLabel}>
        <Icon name={meta.icon} size={16} />
        {meta.label}
      </p>
      {kind === 'image' ? (
        <ImagePreview media={lookup.get(String(node.attrs.mediaId))} caption={String(node.attrs.caption ?? '')} />
      ) : (
        <p className={styles.cardText}>{summary(kind, node.attrs)}</p>
      )}
      {editable && (
        <div className={styles.cardActions}>
          <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="quiet" icon="trash" onClick={() => deleteNode()} aria-label={`Remove ${meta.label.toLowerCase()}`} />
        </div>
      )}
      {editing && kind === 'image' && (
        <ImagePickerDialog
          title="Image"
          initial={lookup.get(String(node.attrs.mediaId)) ?? null}
          caption={String(node.attrs.caption ?? '')}
          submitLabel="Save"
          onClose={() => setEditing(false)}
          onSave={({ media, caption }) => {
            lookup.remember(media);
            updateAttributes({ mediaId: media.id, caption });
            setEditing(false);
          }}
        />
      )}
      {editing && kind !== 'image' && (
        <BlockDialog
          kind={kind}
          initial={node.attrs}
          articleId={articleId}
          onClose={() => setEditing(false)}
          onRemove={() => {
            setEditing(false);
            deleteNode();
          }}
          onSave={(attrs) => {
            updateAttributes(attrs);
            setEditing(false);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}

function ImagePreview({ media, caption }: { media: MediaItem | undefined; caption: string }) {
  if (!media) return <p className={styles.cardText}>This image is no longer in the media library. Choose another or remove the block.</p>;
  return (
    <div className={styles.imageCard}>
      <CloudImage image={media} alt="" preset="card" sizes="160px" className={styles.imageThumb} />
      <div>
        <p className={styles.cardText}>{caption || <span className={styles.muted}>No caption</span>}</p>
        <p className={media.alt ? styles.altOk : styles.altMissing}>{media.alt ? `Alt text: ${media.alt}` : 'No alt text yet. Needed before publishing.'}</p>
      </div>
    </div>
  );
}
```

### `src/components/newsroom/editor/BlockDialog.tsx`

```tsx
'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ds/Button';
import { LIMITS } from '@/lib/doc/schema';
import { youtubeId } from '@/lib/doc/youtube';
import { toWibInput } from '@/lib/time';
import { findArticles } from '@/modules/editor/actions';
import { STATUS_LABELS } from '@/modules/editor/status';
import { SelectField, TextArea, TextField } from '../Field';
import forms from '../forms.module.css';
import ui from '../ui.module.css';
import styles from './editor.module.css';
import type { SpecialKind } from './extensions';

// One dialog for every special block (and for links), rendered in a portal outside the editor so
// typing in it never reaches the document. Each kind checks its own fields before saving.

export type DialogKind = SpecialKind | 'link';
type Attrs = Record<string, unknown>;

const TITLES: Record<DialogKind, string> = {
  pullQuote: 'Pull quote',
  editorNote: "Editor's note",
  keyFigures: 'Key figures',
  youtube: 'YouTube video',
  readMore: 'Read more',
  image: 'Image',
  link: 'Link',
};

const SAFE_HREF = /^(https?:\/\/\S+|mailto:\S+|\/(?!\/)\S*|#\S*)$/i;

type Found = Awaited<ReturnType<typeof findArticles>>;

export function BlockDialog({
  kind,
  mode = 'edit',
  initial,
  articleId,
  onSave,
  onRemove,
  onClose,
}: {
  kind: DialogKind;
  mode?: 'insert' | 'edit';
  initial: Attrs;
  articleId: string;
  onSave: (attrs: Attrs) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [values, setValues] = useState<Attrs>(() => ({
    ...initial,
    ...(kind === 'editorNote' && !initial.date ? { date: toWibInput(new Date()).slice(0, 10) } : {}),
    ...(kind === 'keyFigures' ? { items: padFigures(initial.items) } : {}),
    ...(kind === 'youtube' ? { link: initial.videoId ?? '' } : {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);

  // Open as a modal on mount. No close() on cleanup: in development React runs effects twice, and a
  // close event from the first cleanup would dismiss the dialog straight away.
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const set = (key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value }));
  const text = (key: string) => String(values[key] ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const problems: Record<string, string> = {};
    let attrs: Attrs = {};
    if (kind === 'pullQuote') {
      if (!text('text').trim()) problems.text = 'Write the quote.';
      attrs = { text: text('text').trim(), attribution: text('attribution').trim() };
    } else if (kind === 'editorNote') {
      if (!text('text').trim()) problems.text = 'Write what changed and why.';
      attrs = { kind: values.kind === 'correction' ? 'correction' : 'update', date: text('date'), text: text('text').trim() };
    } else if (kind === 'keyFigures') {
      const items = (values.items as { value: string; label: string }[])
        .map((item) => ({ value: item.value.trim(), label: item.label.trim() }))
        .filter((item) => item.value || item.label);
      if (items.length < 2) problems.items = 'Add at least two figures, each with a value and a label.';
      else if (items.some((item) => !item.value || !item.label)) problems.items = 'Each figure needs a value and a label.';
      attrs = { title: text('title').trim(), items, source: text('source').trim() };
    } else if (kind === 'youtube') {
      const videoId = youtubeId(text('link'));
      if (!videoId) problems.link = 'Paste a YouTube link, for example https://www.youtube.com/watch?v=…';
      if (!text('title').trim()) problems.title = 'Describe the video in a few words. Screen readers announce it.';
      attrs = { videoId, title: text('title').trim() };
    } else if (kind === 'readMore') {
      if (!values.articleId) problems.article = 'Choose an article.';
      attrs = { articleId: values.articleId, title: values.title };
    } else if (kind === 'link') {
      const href = text('href').trim();
      if (!SAFE_HREF.test(href)) problems.href = 'Use a full address starting with https://, or a site address starting with /.';
      attrs = { href };
    }
    setErrors(problems);
    if (Object.keys(problems).length) return;
    onSave(attrs);
  }

  async function search() {
    setSearching(true);
    try {
      setFound(await findArticles(query, articleId));
    } finally {
      setSearching(false);
    }
  }

  return createPortal(
    <dialog ref={dialog} className={`${ui.dialog} ${styles.blockDialog}`} aria-labelledby={`${uid}-heading`} onCancel={onClose} onClose={onClose}>
      <form className={forms.form} onSubmit={submit} noValidate>
        <h2 id={`${uid}-heading`} className={ui.dialogTitle}>
          {TITLES[kind]}
        </h2>

        {kind === 'pullQuote' && (
          <>
            <TextArea id={`${uid}-text`} label="Quote" rows={3} value={text('text')} onChange={(e) => set('text', e.target.value)} error={errors.text} maxLength={LIMITS.pullQuoteText} />
            <TextField
              id={`${uid}-attribution`}
              label="Who said it"
              optional
              value={text('attribution')}
              onChange={(e) => set('attribution', e.target.value)}
              placeholder="Sri Mulyani, finance minister"
              maxLength={LIMITS.attribution}
            />
          </>
        )}

        {kind === 'editorNote' && (
          <>
            <div className={forms.row}>
              <SelectField id={`${uid}-kind`} label="Type" value={text('kind') || 'update'} onChange={(e) => set('kind', e.target.value)}>
                <option value="update">Update</option>
                <option value="correction">Correction</option>
              </SelectField>
              <TextField id={`${uid}-date`} label="Date" type="date" value={text('date')} onChange={(e) => set('date', e.target.value)} />
            </div>
            <TextArea id={`${uid}-text`} label="Note" rows={3} value={text('text')} onChange={(e) => set('text', e.target.value)} error={errors.text} maxLength={LIMITS.noteText} hint="Say what changed. Corrections name the earlier mistake." />
          </>
        )}

        {kind === 'keyFigures' && (
          <>
            <TextField id={`${uid}-title`} label="Heading" optional value={text('title')} onChange={(e) => set('title', e.target.value)} placeholder="The harvest in numbers" maxLength={LIMITS.figuresTitle} />
            <fieldset className={forms.fieldset}>
              <legend className={forms.label}>Figures (two to four)</legend>
              {errors.items && <p className={forms.error}>{errors.items}</p>}
              {(values.items as { value: string; label: string }[]).map((item, index) => (
                <div className={styles.figureRow} key={index}>
                  <TextField
                    id={`${uid}-value-${index}`}
                    label={`Figure ${index + 1}`}
                    value={item.value}
                    onChange={(e) => set('items', updateItem(values.items, index, 'value', e.target.value))}
                    placeholder={index === 0 ? '31.5m' : undefined}
                    maxLength={LIMITS.figureValue}
                    mono
                  />
                  <TextField
                    id={`${uid}-label-${index}`}
                    label={`Label ${index + 1}`}
                    value={item.label}
                    onChange={(e) => set('items', updateItem(values.items, index, 'label', e.target.value))}
                    placeholder={index === 0 ? 'tonnes of rice this season' : undefined}
                    maxLength={LIMITS.figureLabel}
                  />
                </div>
              ))}
            </fieldset>
            <TextField id={`${uid}-source`} label="Source" optional value={text('source')} onChange={(e) => set('source', e.target.value)} placeholder="Statistics Indonesia (BPS)" maxLength={LIMITS.figuresSource} />
          </>
        )}

        {kind === 'youtube' && (
          <>
            <TextField id={`${uid}-link`} label="YouTube link" value={text('link')} onChange={(e) => set('link', e.target.value)} error={errors.link} placeholder="https://www.youtube.com/watch?v=…" mono />
            <TextField
              id={`${uid}-title`}
              label="What the video shows"
              value={text('title')}
              onChange={(e) => set('title', e.target.value)}
              error={errors.title}
              maxLength={LIMITS.videoTitle}
              hint="The player loads only when a reader presses play."
            />
          </>
        )}

        {kind === 'readMore' && (
          <>
            {Boolean(values.articleId) && (
              <p className={styles.chosen}>
                Linked: <b>{text('title') || 'Untitled'}</b>
              </p>
            )}
            <div className={styles.searchRow}>
              <TextField
                id={`${uid}-query`}
                label="Find an article"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void search();
                  }
                }}
                error={errors.article}
              />
              <Button onClick={() => void search()} disabled={searching}>
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </div>
            {found && (
              <ul className={styles.results} aria-label="Search results">
                {found.length === 0 && <li className={forms.hint}>No articles match.</li>}
                {found.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      className={styles.result}
                      aria-pressed={values.articleId === article.id}
                      onClick={() => setValues((current) => ({ ...current, articleId: article.id, title: article.title || 'Untitled' }))}
                    >
                      <span>{article.title || 'Untitled'}</span>
                      <small>
                        {article.section?.name ?? 'No section'} · {STATUS_LABELS[article.status]}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {kind === 'link' && (
          <TextField id={`${uid}-href`} label="Address" value={text('href')} onChange={(e) => set('href', e.target.value)} error={errors.href} placeholder="https://" mono />
        )}

        <div className={ui.dialogActions}>
          {onRemove && (
            <Button type="button" variant="quiet" onClick={onRemove} className={styles.remove}>
              {kind === 'link' ? 'Remove link' : 'Remove block'}
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {mode === 'insert' ? 'Insert' : 'Save'}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}

function padFigures(items: unknown) {
  const list = Array.isArray(items) ? (items as { value: string; label: string }[]).map((item) => ({ value: item.value ?? '', label: item.label ?? '' })) : [];
  while (list.length < LIMITS.figuresMax) list.push({ value: '', label: '' });
  return list;
}

function updateItem(items: unknown, index: number, key: 'value' | 'label', value: string) {
  return (items as { value: string; label: string }[]).map((item, i) => (i === index ? { ...item, [key]: value } : item));
}
```

### `src/components/newsroom/editor/BodyEditor.tsx`

```tsx
'use client';

import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { type Ref, useContext, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import type { Doc } from '@/lib/doc/schema';
import { ImagePickerDialog } from '@/components/media/ImagePickerDialog';
import { ArticleIdContext, BlockCard } from './BlockCard';
import { BlockDialog, type DialogKind } from './BlockDialog';
import styles from './editor.module.css';
import { editorExtensions, SPECIAL_DEFAULTS, type SpecialKind } from './extensions';
import { MediaLookupContext } from './media-context';

export type BodyEditorHandle = { getJSON: () => unknown; getText: () => string; focus: () => void };

type Tool = { label: string; icon?: IconName; text?: string; active?: boolean; disabled?: boolean; run: () => void };

/** The article body: Tiptap with the PressCompass blocks and a formatting toolbar. */
export function BodyEditor({
  ref,
  initial,
  articleId,
  editable,
  invalid,
  describedBy,
  onChange,
}: {
  ref: Ref<BodyEditorHandle>;
  initial: Doc;
  articleId: string;
  editable: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange: (text: string) => void;
}) {
  const extensions = useMemo(() => editorExtensions(BlockCard), []);
  const [dialog, setDialog] = useState<{ kind: DialogKind; attrs: Record<string, unknown>; mode: 'insert' | 'edit' } | null>(null);
  const [picking, setPicking] = useState(false);
  const lookup = useContext(MediaLookupContext);

  const editor = useEditor({
    extensions,
    // ProseMirror needs at least one block; a new article is stored with an empty content list.
    content: initial.content.length ? initial : { type: 'doc', content: [{ type: 'paragraph' }] },
    editable,
    immediatelyRender: false,
    editorProps: { attributes: textboxAttributes(invalid, describedBy) },
    onUpdate: ({ editor: current }) => onChange(current.getText()),
  });

  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes: textboxAttributes(invalid, describedBy) } });
  }, [editor, invalid, describedBy]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  useImperativeHandle(ref, () => ({
    // ProseMirror keeps attributes in null-prototype objects, which Server Action arguments drop.
    // A JSON round trip turns the document into plain objects.
    getJSON: () => JSON.parse(JSON.stringify(editor?.getJSON() ?? initial)),
    getText: () => editor?.getText() ?? '',
    focus: () => editor?.commands.focus(),
  }));

  // The store's editor stays null until the first transaction, so fall back to the instance itself.
  const state = useEditorState({
    editor,
    selector: ({ editor: fromStore }) => {
      const e = fromStore ?? editor;
      return e
        ? {
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            link: e.isActive('link'),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            table: e.isActive('table'),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null;
    },
  });

  if (!editor || !state) return <div className={styles.bodyLoading} aria-hidden="true" />;

  const chain = () => editor.chain().focus();
  const insert = (kind: SpecialKind) => setDialog({ kind, attrs: { ...SPECIAL_DEFAULTS[kind] }, mode: 'insert' });
  // Insert after a selected block instead of replacing it, and leave a paragraph to keep writing in.
  const insertBlock = (type: string, attrs: Record<string, unknown>) => {
    const { selection } = editor.state;
    const content = [{ type, attrs }, { type: 'paragraph' }];
    if (selection instanceof NodeSelection) chain().insertContentAt(selection.to, content).run();
    else chain().insertContent(content).run();
  };

  const groups: Tool[][] = [
    [
      { label: 'H2 heading', text: 'H2', active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: 'H3 subheading', text: 'H3', active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: 'Bold', icon: 'bold', active: state.bold, run: () => chain().toggleBold().run() },
      { label: 'Italic', icon: 'italic', active: state.italic, run: () => chain().toggleItalic().run() },
      {
        label: 'Link',
        icon: 'link',
        active: state.link,
        run: () => setDialog({ kind: 'link', attrs: { href: editor.getAttributes('link').href ?? '' }, mode: state.link ? 'edit' : 'insert' }),
      },
    ],
    [
      { label: 'Bulleted list', icon: 'list', active: state.bullet, run: () => chain().toggleBulletList().run() },
      { label: 'Numbered list', icon: 'list-ordered', active: state.ordered, run: () => chain().toggleOrderedList().run() },
      { label: 'Quote', icon: 'quote', active: state.quote, run: () => chain().toggleBlockquote().run() },
      { label: 'Divider', icon: 'minus', run: () => chain().setHorizontalRule().run() },
      { label: 'Table', icon: 'table', active: state.table, run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    ],
    [
      { label: 'Image', icon: 'image', run: () => setPicking(true) },
      { label: 'Pull quote', text: 'Pull quote', run: () => insert('pullQuote') },
      { label: 'Key figures', text: 'Figures', run: () => insert('keyFigures') },
      { label: "Editor's note", text: 'Note', run: () => insert('editorNote') },
      { label: 'YouTube video', icon: 'video', run: () => insert('youtube') },
      { label: 'Read more card', text: 'Read more', run: () => insert('readMore') },
    ],
    [
      { label: 'Undo', icon: 'undo', disabled: !state.canUndo, run: () => chain().undo().run() },
      { label: 'Redo', icon: 'redo', disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ];

  const tableTools: Tool[] = [
    { label: 'Add row', text: 'Add row', run: () => chain().addRowAfter().run() },
    { label: 'Add column', text: 'Add column', run: () => chain().addColumnAfter().run() },
    { label: 'Delete row', text: 'Delete row', run: () => chain().deleteRow().run() },
    { label: 'Delete column', text: 'Delete column', run: () => chain().deleteColumn().run() },
    { label: 'Delete table', text: 'Delete table', run: () => chain().deleteTable().run() },
  ];

  const button = (tool: Tool) => (
    <button
      key={tool.label}
      type="button"
      className={styles.tool}
      aria-label={tool.label}
      title={tool.label}
      aria-pressed={tool.active === undefined ? undefined : tool.active}
      disabled={tool.disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={tool.run}
    >
      {tool.icon ? <Icon name={tool.icon} size={18} /> : tool.text}
    </button>
  );

  return (
    <ArticleIdContext value={articleId}>
      <div className={styles.body} data-invalid={invalid || undefined}>
        {editable && (
          <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
            {groups.map((group, index) => (
              <div key={index} className={styles.toolGroup}>
                {group.map(button)}
              </div>
            ))}
            {state.table && (
              <div className={`${styles.toolGroup} ${styles.tableTools}`} role="group" aria-label="Table">
                {tableTools.map(button)}
              </div>
            )}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      {dialog && (
        <BlockDialog
          kind={dialog.kind}
          mode={dialog.mode}
          initial={dialog.attrs}
          articleId={articleId}
          onClose={() => setDialog(null)}
          onRemove={dialog.kind === 'link' && dialog.mode === 'edit' ? () => {
            chain().extendMarkRange('link').unsetLink().run();
            setDialog(null);
          } : undefined}
          onSave={(attrs) => {
            if (dialog.kind === 'link') {
              const href = String(attrs.href);
              if (editor.state.selection.empty && !state.link) chain().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
              else chain().extendMarkRange('link').setLink({ href }).run();
            } else {
              insertBlock(dialog.kind, attrs);
            }
            setDialog(null);
          }}
        />
      )}
      {picking && (
        <ImagePickerDialog
          title="Insert an image"
          initial={null}
          caption=""
          submitLabel="Insert"
          onClose={() => setPicking(false)}
          onSave={({ media, caption }) => {
            lookup.remember(media);
            insertBlock('image', { mediaId: media.id, caption });
            setPicking(false);
          }}
        />
      )}
    </ArticleIdContext>
  );
}

function textboxAttributes(invalid?: boolean, describedBy?: string): Record<string, string> {
  return {
    class: styles.prose,
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-label': 'Article text',
    ...(invalid ? { 'aria-invalid': 'true' } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };
}
```

### `src/components/newsroom/editor/editor.module.css`

```css
/* The body editor: toolbar, writing surface in the article typography, special block cards. */

.body {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
}

.body[data-invalid] {
  border-color: var(--danger);
}

.body:focus-within {
  border-color: var(--meridian);
}

.bodyLoading {
  min-height: 360px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 6px 8px;
  background: var(--paper-raised);
  border-bottom: 1px solid var(--line);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.toolGroup {
  display: flex;
  gap: 2px;
}

.tableTools {
  flex-basis: 100%;
  padding-top: 4px;
  border-top: 1px solid var(--line);
}

.tool {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-secondary);
  font: 600 13px/18px var(--font-sans);
  cursor: pointer;
  white-space: nowrap;
}

.tool:hover {
  background: var(--paper-sunken);
  color: var(--ink);
}

.tool[aria-pressed='true'] {
  background: var(--meridian-soft);
  color: var(--meridian);
}

.tool:disabled {
  color: var(--ink-muted);
  opacity: 0.5;
  cursor: default;
  background: transparent;
}

.prose {
  min-height: 420px;
  padding: var(--space-5) var(--space-5) var(--space-6);
  outline: none;
  color: var(--ink);
  font: 400 19px/31px var(--font-serif);
  font-variation-settings: 'opsz' 16;
}

.prose > * + * {
  margin-top: 20px;
}

.prose h2 {
  margin-top: 36px;
  font: 600 26px/32px var(--font-serif);
  font-variation-settings: 'opsz' 36;
}

.prose h3 {
  margin-top: 28px;
  font: 600 21px/28px var(--font-serif);
  font-variation-settings: 'opsz' 24;
}

.prose a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.prose ul,
.prose ol {
  padding-left: 26px;
}

.prose li + li {
  margin-top: 6px;
}

.prose blockquote {
  padding-left: 20px;
  border-left: 3px solid var(--line-strong);
  color: var(--ink-secondary);
}

.prose hr {
  width: 80px;
  margin: 32px auto;
  border: 0;
  border-top: 1px solid var(--line-strong);
}

.prose hr:global(.ProseMirror-selectednode) {
  outline: 2px solid var(--meridian);
  outline-offset: 6px;
}

.prose table {
  width: 100%;
  border-collapse: collapse;
  font: 400 15px/22px var(--font-sans);
  table-layout: fixed;
}

.prose th,
.prose td {
  position: relative;
  padding: 8px 10px;
  border: 1px solid var(--line);
  vertical-align: top;
  text-align: left;
}

.prose th {
  font-weight: 600;
  background: var(--paper-sunken);
}

.prose :global(.selectedCell)::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--meridian-soft);
  opacity: 0.5;
  pointer-events: none;
}

.prose :global(p.is-editor-empty:first-child)::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--ink-muted);
  pointer-events: none;
}

.card {
  margin: 24px 0;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--meridian);
  border-radius: var(--radius-sm);
  background: var(--paper);
  font: 400 15px/22px var(--font-sans);
  cursor: grab;
}

.card[data-selected] {
  outline: 2px solid var(--meridian);
  outline-offset: 2px;
}

.cardLabel {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.cardText {
  margin-top: 6px;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.cardActions {
  display: flex;
  gap: 4px;
  margin-top: 10px;
}

.blockDialog {
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

.figureRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: var(--space-3);
}

.searchRow {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}

.searchRow > :first-child {
  flex: 1;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}

.result {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
  color: var(--ink);
  text-align: left;
  font: 500 15px/20px var(--font-sans);
  cursor: pointer;
}

.result small {
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-muted);
}

.result:hover {
  border-color: var(--ink-secondary);
}

.result[aria-pressed='true'] {
  border-color: var(--meridian);
  background: var(--meridian-soft);
}

.chosen {
  font: 400 14px/20px var(--font-sans);
  color: var(--ink-secondary);
}

.remove {
  margin-right: auto;
  color: var(--danger);
}

@media (max-width: 640px) {
  .prose {
    padding: var(--space-4);
    font-size: 18px;
    line-height: 29px;
  }

  .figureRow {
    grid-template-columns: 1fr;
  }
}

.imageCard {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 14px;
  margin-top: 8px;
}

.imageThumb {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  background: var(--paper-sunken);
}

.muted {
  color: var(--ink-muted);
}

.altOk,
.altMissing {
  margin-top: 4px;
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.altMissing {
  color: var(--warning);
  font-weight: 500;
}

@media (max-width: 640px) {
  .imageCard {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

### `src/components/newsroom/editor/extensions.ts`

```ts
import { Node } from '@tiptap/core';
import { Blockquote } from '@tiptap/extension-blockquote';
import { ListItem } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { ComponentType } from 'react';

// The editor schema matches src/lib/doc/schema.ts exactly, so what you see is what is saved.
// Special blocks are atoms edited through a dialog (BlockCard + BlockDialog).

export const SPECIAL_DEFAULTS = {
  pullQuote: { text: '', attribution: '' },
  editorNote: { kind: 'update', date: '', text: '' },
  keyFigures: { title: '', items: [], source: '' },
  youtube: { videoId: '', title: '' },
  readMore: { articleId: '', title: '' },
  image: { mediaId: '', caption: '' },
} as const;

export type SpecialKind = keyof typeof SPECIAL_DEFAULTS;

function special(name: SpecialKind, view: ComponentType<ReactNodeViewProps>) {
  const defaults = SPECIAL_DEFAULTS[name] as Record<string, unknown>;
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
      return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { default: value, rendered: false }]));
    },
    parseHTML() {
      return [
        {
          tag: `div[data-block="${name}"]`,
          getAttrs: (element) => {
            try {
              return JSON.parse((element as HTMLElement).getAttribute('data-attrs') ?? '{}');
            } catch {
              return false;
            }
          },
        },
      ];
    },
    renderHTML({ node }) {
      return ['div', { 'data-block': name, 'data-attrs': JSON.stringify(node.attrs) }];
    },
    addNodeView() {
      return ReactNodeViewRenderer(view);
    },
  });
}

export function editorExtensions(view: ComponentType<ReactNodeViewProps>) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      blockquote: false,
      listItem: false,
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noopener', target: null },
      },
    }),
    Blockquote.extend({ content: 'paragraph+' }),
    ListItem.extend({ content: 'paragraph (paragraph | bulletList | orderedList)*' }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend({ content: 'paragraph+' }),
    TableCell.extend({ content: 'paragraph+' }),
    Placeholder.configure({ placeholder: 'Start writing. Use H2 for section headings.' }),
    ...(Object.keys(SPECIAL_DEFAULTS) as SpecialKind[]).map((name) => special(name, view)),
  ];
}
```

### `src/components/newsroom/editor/media-context.ts`

```ts
'use client';

import { createContext } from 'react';
import type { MediaItem } from '@/modules/media/types';

/** Media items the editor knows about (loaded with the article, picked or uploaded since), by id. */
export type MediaLookup = { get: (id: string) => MediaItem | undefined; remember: (item: MediaItem) => void };

export const MediaLookupContext = createContext<MediaLookup>({ get: () => undefined, remember: () => {} });
```

### `src/components/newsroom/forms.module.css`

```css
/* Newsroom form controls (design system: TextField). */

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 640px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.label {
  font: 500 14px/20px var(--font-sans);
  color: var(--ink);
}

.optional {
  font-weight: 400;
  color: var(--ink-muted);
}

.input,
.select,
.textarea {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  font: 400 15px/22px var(--font-sans);
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  transition: border-color 120ms ease-out;
}

.input::placeholder,
.textarea::placeholder {
  color: var(--ink-muted);
}

.input:hover,
.select:hover,
.textarea:hover {
  border-color: var(--ink-secondary);
}

.input:focus-visible,
.select:focus-visible,
.textarea:focus-visible {
  border-color: var(--meridian);
}

.input:disabled,
.select:disabled,
.textarea:disabled {
  color: var(--ink-muted);
  background: var(--paper-sunken);
  cursor: not-allowed;
}

.textarea {
  resize: vertical;
}

.mono {
  font-family: var(--font-mono);
  font-size: 14px;
}

.select {
  appearance: none;
  padding-right: 36px;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-muted) 50%),
    linear-gradient(135deg, var(--ink-muted) 50%, transparent 50%);
  background-position: calc(100% - 18px) 18px, calc(100% - 13px) 18px;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}

.invalid {
  border-color: var(--danger);
}

.invalid:hover {
  border-color: var(--danger);
}

.hint {
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-muted);
}

.error {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font: 500 13px/18px var(--font-sans);
  color: var(--danger);
}

.error svg {
  flex: none;
  margin-top: 1px;
}

.check {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 2px 10px;
  align-items: start;
}

.check input {
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: var(--navy);
}

.check .hint {
  grid-column: 2;
}

.fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

/* A legend is not a flex item, so it gets its own spacing. */
.fieldset > legend {
  padding: 0;
  margin-bottom: var(--space-3);
}

.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding-top: var(--space-2);
}

.danger {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
  max-width: 640px;
}

.dangerTitle {
  font: 600 15px/22px var(--font-sans);
}

.dangerText {
  font: 400 14px/20px var(--font-sans);
  color: var(--ink-secondary);
}
```

### `src/lib/doc/sanitize.ts`

```ts
import {
  type Block,
  type Doc,
  EMPTY_DOC,
  type Inline,
  type KeyFigure,
  LIMITS,
  type ListItem,
  type Mark,
  type Paragraph,
  type TableCell,
  type TableRow,
  UUID,
  YOUTUBE_ID,
} from './schema';

// Rebuilds an editor document from scratch, keeping only the nodes, marks and attributes in
// schema.ts. Blocks that are not allowed where they appear become paragraphs, so text is not lost;
// empty or invalid special blocks are dropped. Runs on every save, whatever the browser sent.

type Raw = Record<string, unknown>;
type Context = 'doc' | 'quote' | 'item' | 'cell';

const TEXT_MAX = 20_000;
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SPECIAL = new Set(['pullQuote', 'editorNote', 'keyFigures', 'youtube', 'readMore', 'image']);

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const kids = (node: Raw): Raw[] => (Array.isArray(node.content) ? node.content.filter(isObject) : []);
const attrs = (node: Raw): Raw => (isObject(node.attrs) ? node.attrs : {});
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max).trim() : '');
const int = (value: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : fallback;
const isInlineNode = (node: Raw) => node.type === 'text' || node.type === 'hardBreak';

function cleanMarks(raw: unknown): Mark[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const marks: Mark[] = [];
  const seen = new Set<string>();
  for (const mark of raw) {
    if (!isObject(mark) || typeof mark.type !== 'string' || seen.has(mark.type)) continue;
    if (mark.type === 'bold' || mark.type === 'italic') {
      marks.push({ type: mark.type });
      seen.add(mark.type);
    } else if (mark.type === 'link') {
      const href = typeof attrs(mark).href === 'string' ? (attrs(mark).href as string).trim() : '';
      if (href.length <= 2000 && SAFE_HREF.test(href)) {
        marks.push({ type: 'link', attrs: { href } });
        seen.add('link');
      }
    }
  }
  return marks.length ? marks : undefined;
}

function cleanInline(nodes: Raw[]): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string' && node.text.length > 0) {
      const marks = cleanMarks(node.marks);
      out.push(marks ? { type: 'text', text: node.text.slice(0, TEXT_MAX), marks } : { type: 'text', text: node.text.slice(0, TEXT_MAX) });
    } else if (node.type === 'hardBreak') {
      out.push({ type: 'hardBreak' });
    } else {
      out.push(...cleanInline(kids(node)));
    }
  }
  return out;
}

function paragraph(nodes: Raw[]): Paragraph {
  const content = cleanInline(nodes);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function cleanItem(node: Raw): ListItem {
  const content = cleanBlocks(kids(node), 'item') as ListItem['content'];
  if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
  return { type: 'listItem', content };
}

function cleanList(node: Raw): Block | null {
  const items = kids(node)
    .filter((child) => child.type === 'listItem')
    .map(cleanItem);
  if (!items.length) return null;
  if (node.type === 'orderedList') return { type: 'orderedList', attrs: { start: int(attrs(node).start, 1, 100_000, 1) }, content: items };
  return { type: 'bulletList', content: items };
}

function cleanTable(node: Raw): Block | null {
  const rows: TableRow[] = [];
  for (const row of kids(node).filter((child) => child.type === 'tableRow').slice(0, 100)) {
    const cells: TableCell[] = kids(row)
      .filter((cell) => cell.type === 'tableCell' || cell.type === 'tableHeader')
      .slice(0, 20)
      .map((cell) => {
        const content = cleanBlocks(kids(cell), 'cell') as Paragraph[];
        return {
          type: cell.type as TableCell['type'],
          attrs: { colspan: int(attrs(cell).colspan, 1, 20, 1), rowspan: int(attrs(cell).rowspan, 1, 100, 1) },
          content: content.length ? content : [{ type: 'paragraph' }],
        };
      });
    if (cells.length) rows.push({ type: 'tableRow', content: cells });
  }
  return rows.length ? { type: 'table', content: rows } : null;
}

function cleanSpecial(node: Raw): Block | null {
  const a = attrs(node);
  switch (node.type) {
    case 'pullQuote': {
      const quote = text(a.text, LIMITS.pullQuoteText);
      return quote ? { type: 'pullQuote', attrs: { text: quote, attribution: text(a.attribution, LIMITS.attribution) } } : null;
    }
    case 'editorNote': {
      const note = text(a.text, LIMITS.noteText);
      const date = typeof a.date === 'string' && DATE.test(a.date) ? a.date : '';
      return note ? { type: 'editorNote', attrs: { kind: a.kind === 'correction' ? 'correction' : 'update', date, text: note } } : null;
    }
    case 'keyFigures': {
      const items: KeyFigure[] = (Array.isArray(a.items) ? a.items.filter(isObject) : [])
        .map((item) => ({ value: text(item.value, LIMITS.figureValue), label: text(item.label, LIMITS.figureLabel) }))
        .filter((item) => item.value || item.label)
        .slice(0, LIMITS.figuresMax);
      if (!items.length) return null;
      return { type: 'keyFigures', attrs: { title: text(a.title, LIMITS.figuresTitle), items, source: text(a.source, LIMITS.figuresSource) } };
    }
    case 'youtube':
      return typeof a.videoId === 'string' && YOUTUBE_ID.test(a.videoId)
        ? { type: 'youtube', attrs: { videoId: a.videoId, title: text(a.title, LIMITS.videoTitle) } }
        : null;
    case 'readMore':
      return typeof a.articleId === 'string' && UUID.test(a.articleId)
        ? { type: 'readMore', attrs: { articleId: a.articleId.toLowerCase(), title: text(a.title, LIMITS.readMoreTitle) } }
        : null;
    case 'image':
      return typeof a.mediaId === 'string' && UUID.test(a.mediaId)
        ? { type: 'image', attrs: { mediaId: a.mediaId.toLowerCase(), caption: text(a.caption, LIMITS.imageCaption) } }
        : null;
    default:
      return null;
  }
}

function cleanBlocks(nodes: Raw[], context: Context): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    const type = node.type;
    const inDoc = context === 'doc';
    if (type === 'paragraph') {
      out.push(paragraph(kids(node)));
    } else if (type === 'heading' && inDoc) {
      const level = Number(attrs(node).level);
      const content = cleanInline(kids(node));
      out.push({ type: 'heading', attrs: { level: level <= 2 ? 2 : 3 }, ...(content.length ? { content } : {}) });
    } else if ((type === 'bulletList' || type === 'orderedList') && (inDoc || context === 'item')) {
      const list = cleanList(node);
      if (list) out.push(list);
    } else if (type === 'blockquote' && inDoc) {
      const content = cleanBlocks(kids(node), 'quote') as Paragraph[];
      if (content.length) out.push({ type: 'blockquote', content });
    } else if (type === 'horizontalRule' && inDoc) {
      out.push({ type: 'horizontalRule' });
    } else if (type === 'table' && inDoc) {
      const table = cleanTable(node);
      if (table) out.push(table);
    } else if (typeof type === 'string' && SPECIAL.has(type) && inDoc) {
      const block = cleanSpecial(node);
      if (block) out.push(block);
    } else {
      // Not allowed here: keep its text as a paragraph, or its blocks in this context.
      const children = kids(node);
      if (children.length && children.every(isInlineNode)) {
        const content = paragraph(children);
        if (content.content) out.push(content);
      } else if (children.length) {
        out.push(...cleanBlocks(children, context));
      }
    }
  }
  return out;
}

export function sanitizeDoc(input: unknown): Doc {
  if (!isObject(input) || input.type !== 'doc') return EMPTY_DOC;
  return { type: 'doc', content: cleanBlocks(kids(input), 'doc') };
}
```

### `src/lib/doc/schema.ts`

```ts
// The article body is stored as the editor's JSON document (Tiptap/ProseMirror) restricted to these nodes.
// src/lib/doc/sanitize.ts enforces this shape on every save; the site renders it with ArticleBody.

export type Mark = { type: 'bold' } | { type: 'italic' } | { type: 'link'; attrs: { href: string } };

export type TextNode = { type: 'text'; text: string; marks?: Mark[] };
export type HardBreak = { type: 'hardBreak' };
export type Inline = TextNode | HardBreak;

export type Paragraph = { type: 'paragraph'; content?: Inline[] };
export type Heading = { type: 'heading'; attrs: { level: 2 | 3 }; content?: Inline[] };
export type ListItem = { type: 'listItem'; content: (Paragraph | BulletList | OrderedList)[] };
export type BulletList = { type: 'bulletList'; content: ListItem[] };
export type OrderedList = { type: 'orderedList'; attrs: { start: number }; content: ListItem[] };
export type Blockquote = { type: 'blockquote'; content: Paragraph[] };
export type HorizontalRule = { type: 'horizontalRule' };
export type TableCell = { type: 'tableCell' | 'tableHeader'; attrs: { colspan: number; rowspan: number }; content: Paragraph[] };
export type TableRow = { type: 'tableRow'; content: TableCell[] };
export type Table = { type: 'table'; content: TableRow[] };

export type PullQuote = { type: 'pullQuote'; attrs: { text: string; attribution: string } };
export type EditorNote = { type: 'editorNote'; attrs: { kind: 'update' | 'correction'; date: string; text: string } };
export type KeyFigure = { value: string; label: string };
export type KeyFigures = { type: 'keyFigures'; attrs: { title: string; items: KeyFigure[]; source: string } };
export type YouTube = { type: 'youtube'; attrs: { videoId: string; title: string } };
export type ReadMore = { type: 'readMore'; attrs: { articleId: string; title: string } };
/** An image from the media library. Alt text and credit come from the media item; the caption is per use. */
export type ImageBlock = { type: 'image'; attrs: { mediaId: string; caption: string } };

export type Block =
  | Paragraph
  | Heading
  | BulletList
  | OrderedList
  | Blockquote
  | HorizontalRule
  | Table
  | PullQuote
  | EditorNote
  | KeyFigures
  | YouTube
  | ReadMore
  | ImageBlock;

export type Doc = { type: 'doc'; content: Block[] };

export const EMPTY_DOC: Doc = { type: 'doc', content: [] };

/** Character limits for the special blocks, shared by the editor dialogs and the sanitizer. */
export const LIMITS = {
  pullQuoteText: 500,
  attribution: 120,
  noteText: 1000,
  figuresTitle: 120,
  figureValue: 24,
  figureLabel: 120,
  figuresSource: 200,
  figuresMax: 4,
  videoTitle: 200,
  readMoreTitle: 200,
  imageCaption: 300,
} as const;

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

### `src/lib/doc/text.ts`

```ts
import type { Block, Doc, Inline, ListItem } from './schema';

const WORD = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;
const WORDS_PER_MINUTE = 230;

function inlineText(nodes: Inline[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (node.type === 'text' ? node.text : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function collect(blocks: (Block | ListItem)[], lines: string[]): void {
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        lines.push(inlineText(block.content));
        break;
      case 'bulletList':
      case 'orderedList':
      case 'listItem':
      case 'blockquote':
        collect(block.content as (Block | ListItem)[], lines);
        break;
      case 'table':
        for (const row of block.content) for (const cell of row.content) collect(cell.content, lines);
        break;
      case 'pullQuote':
      case 'editorNote':
        lines.push(block.attrs.text);
        break;
      case 'keyFigures':
        lines.push(block.attrs.title, ...block.attrs.items.map((item) => `${item.value} ${item.label}`.trim()));
        break;
      case 'image':
        lines.push(block.attrs.caption);
        break;
      default:
        break;
    }
  }
}

/** Plain text of the body, one line per block, for search and word counts. */
export function docText(doc: Doc): string {
  const lines: string[] = [];
  collect(doc.content, lines);
  return lines.filter(Boolean).join('\n');
}

export function wordCount(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

export function readingMinutes(words: number): number {
  return words > 0 ? Math.ceil(words / WORDS_PER_MINUTE) : 0;
}

/** Media ids of the images in the text, in order, each once. */
export function bodyMediaIds(doc: Doc): string[] {
  const ids: string[] = [];
  for (const block of doc.content) if (block.type === 'image' && !ids.includes(block.attrs.mediaId)) ids.push(block.attrs.mediaId);
  return ids;
}
```

### `src/lib/media/url.ts`

```ts
// Cloudinary delivery URLs for images. Pure, so it runs on the server and in the browser.
// Every URL asks for f_auto,q_auto (AVIF or WebP when the browser supports it) at a capped width.

export type Preset = 'original' | 'hero' | 'card' | 'square';
export type Delivery = { cloudName: string; deliveryUrl: string };
export type ImageRef = { publicId: string; width: number; height: number };

/** Width ÷ height of the cropped presets. `original` keeps the image's own shape. */
const RATIO: Record<Exclude<Preset, 'original'>, { ar: string; value: number }> = {
  hero: { ar: '16:9', value: 16 / 9 },
  card: { ar: '3:2', value: 3 / 2 },
  square: { ar: '1:1', value: 1 },
};

/** Widths offered in srcset. Few on purpose: each one is a Cloudinary transformation (Free: 25 credits a month). */
export const WIDTHS = [320, 640, 960, 1280, 1920] as const;

export function delivery(): Delivery {
  return {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
    deliveryUrl: process.env.NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL || 'https://res.cloudinary.com',
  };
}

export function cloudinaryUrl(config: Delivery, { publicId, preset, width }: { publicId: string; preset: Preset; width: number }): string {
  const crop = preset === 'original' ? 'c_limit' : `c_fill,g_auto,ar_${RATIO[preset].ar}`;
  return `${config.deliveryUrl}/${config.cloudName}/image/upload/${crop},w_${Math.round(width)},f_auto,q_auto/${publicId}`;
}

/** src, srcset and the intrinsic width and height (for layout without shifts) of an image in a preset. */
export function imageSources(config: Delivery, image: ImageRef, preset: Preset) {
  const largest = Math.min(image.width, WIDTHS[WIDTHS.length - 1]);
  const widths: number[] = WIDTHS.filter((w) => w <= largest);
  if (!widths.includes(largest)) widths.push(largest);
  const fallback = widths.filter((w) => w <= 1280).at(-1) ?? widths[0];
  const height = preset === 'original' ? (largest * image.height) / image.width : largest / RATIO[preset].value;
  return {
    src: cloudinaryUrl(config, { publicId: image.publicId, preset, width: fallback }),
    srcSet: widths.map((w) => `${cloudinaryUrl(config, { publicId: image.publicId, preset, width: w })} ${w}w`).join(', '),
    width: largest,
    height: Math.round(height),
  };
}
```

### `src/modules/content/ArticleBody.tsx`

```tsx
import type { ReactNode } from 'react';
import { CloudImage } from '@/components/media/CloudImage';
import type { Block, Doc, Inline, ListItem, Mark, TableRow } from '@/lib/doc/schema';
import styles from './article.module.css';
import { YouTubeEmbed } from './YouTubeEmbed';

// Renders a sanitized editor document as React elements (no raw HTML). Used by the Newsroom preview
// now and by the public article page later. Read more cards resolve through `links`; a card whose
// article no longer exists is left out.

export type ArticleLinks = Map<string, { title: string; href: string }>;
/** Media library items used by image blocks, by id. An image whose item was deleted is left out. */
export type ArticleMedia = Map<string, { publicId: string; width: number; height: number; alt: string; credit: string }>;

/** Images fill the article column: full width on phones, at most 680 px elsewhere. */
export const BODY_IMAGE_SIZES = '(max-width: 720px) 100vw, 680px';

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function noteDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return year ? ` · ${day} ${MONTHS[month - 1]} ${year}` : '';
}

function withMark(node: ReactNode, mark: Mark, key: number): ReactNode {
  if (mark.type === 'bold') return <strong key={key}>{node}</strong>;
  if (mark.type === 'italic') return <em key={key}>{node}</em>;
  if (mark.type === 'link' && SAFE_HREF.test(mark.attrs.href)) {
    return (
      <a key={key} href={mark.attrs.href} rel={/^https?:/i.test(mark.attrs.href) ? 'noopener' : undefined}>
        {node}
      </a>
    );
  }
  return node;
}

function inline(nodes: Inline[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    if (node.type === 'hardBreak') return <br key={index} />;
    const marks = [...(node.marks ?? [])].sort((a, b) => Number(a.type === 'link') - Number(b.type === 'link'));
    return marks.reduce<ReactNode>((child, mark) => withMark(child, mark, index), node.text);
  });
}

function rows(table: TableRow[]) {
  return table.map((row, r) => (
    <tr key={r}>
      {row.content.map((cell, c) => {
        const Cell = cell.type === 'tableHeader' ? 'th' : 'td';
        return (
          <Cell
            key={c}
            colSpan={cell.attrs.colspan > 1 ? cell.attrs.colspan : undefined}
            rowSpan={cell.attrs.rowspan > 1 ? cell.attrs.rowspan : undefined}
            scope={cell.type === 'tableHeader' ? (r === 0 ? 'col' : 'row') : undefined}
          >
            {blocks(cell.content, undefined)}
          </Cell>
        );
      })}
    </tr>
  ));
}

function blocks(content: (Block | ListItem)[], links: ArticleLinks | undefined, media?: ArticleMedia): ReactNode[] {
  return content.map((block, index) => {
    switch (block.type) {
      case 'paragraph':
        return block.content?.length ? <p key={index}>{inline(block.content)}</p> : null;
      case 'heading':
        return block.attrs.level === 2 ? <h2 key={index}>{inline(block.content)}</h2> : <h3 key={index}>{inline(block.content)}</h3>;
      case 'bulletList':
        return <ul key={index}>{blocks(block.content, links)}</ul>;
      case 'orderedList':
        return (
          <ol key={index} start={block.attrs.start > 1 ? block.attrs.start : undefined}>
            {blocks(block.content, links)}
          </ol>
        );
      case 'listItem':
        return <li key={index}>{blocks(block.content, links)}</li>;
      case 'blockquote':
        return <blockquote key={index}>{blocks(block.content, links)}</blockquote>;
      case 'horizontalRule':
        return <hr key={index} />;
      case 'table':
        return (
          <div key={index} className={styles.tableWrap}>
            <table>
              <tbody>{rows(block.content)}</tbody>
            </table>
          </div>
        );
      case 'pullQuote':
        return (
          <figure key={index} className={styles.pq}>
            <span className={styles.pqRule} aria-hidden="true" />
            <blockquote>
              <p>{block.attrs.text}</p>
            </blockquote>
            {block.attrs.attribution && <figcaption>{block.attrs.attribution}</figcaption>}
          </figure>
        );
      case 'editorNote':
        return (
          <aside key={index} className={styles.note}>
            <p>
              <b>
                {block.attrs.kind === 'correction' ? 'Correction' : 'Update'}
                {noteDate(block.attrs.date)}.
              </b>{' '}
              {block.attrs.text}
            </p>
          </aside>
        );
      case 'keyFigures':
        return (
          <section key={index} className={styles.facts} aria-label={block.attrs.title || 'Key figures'}>
            <p className={styles.factsKicker}>Key figures</p>
            {block.attrs.title && <h3 className={styles.factsTitle}>{block.attrs.title}</h3>}
            <dl className={styles.figs}>
              {block.attrs.items.map((item, i) => (
                <div key={i} className={styles.fig}>
                  <dt className={styles.figLabel}>{item.label}</dt>
                  <dd className={styles.figValue}>{item.value}</dd>
                </div>
              ))}
            </dl>
            {block.attrs.source && <p className={styles.source}>Source: {block.attrs.source}</p>}
          </section>
        );
      case 'youtube':
        return <YouTubeEmbed key={index} videoId={block.attrs.videoId} title={block.attrs.title} />;
      case 'image': {
        const item = media?.get(block.attrs.mediaId);
        if (!item) return null;
        return (
          <figure key={index} className={styles.figure}>
            <CloudImage image={item} alt={item.alt} sizes={BODY_IMAGE_SIZES} className={styles.image} />
            {(block.attrs.caption || item.credit) && (
              <figcaption>
                {block.attrs.caption}
                {block.attrs.caption && item.credit && ' '}
                {item.credit && <span className={styles.credit}>Photo: {item.credit}</span>}
              </figcaption>
            )}
          </figure>
        );
      }
      case 'readMore': {
        const link = links?.get(block.attrs.articleId);
        if (!link) return null;
        return (
          <aside key={index} className={styles.readMore}>
            <span className={styles.readMoreLabel}>Read more</span>
            <a href={link.href}>{link.title}</a>
          </aside>
        );
      }
      default:
        return null;
    }
  });
}

export function ArticleBody({ doc, links, media }: { doc: Doc; links?: ArticleLinks; media?: ArticleMedia }) {
  return <div className={styles.body}>{blocks(doc.content, links, media)}</div>;
}
```

### `src/modules/content/article.module.css`

```css
/* Article body typography (locked preview: .body, .pq, .facts, .note). */

.body {
  color: var(--ink);
}

.body > p,
.body li p,
.body blockquote p {
  font: 400 19px/31px var(--font-serif);
  font-variation-settings: 'opsz' 16;
  text-wrap: pretty;
}

.body > p {
  margin: 0 0 24px;
}

.body h2 {
  margin: 40px 0 16px;
  font: 600 26px/32px var(--font-serif);
  font-variation-settings: 'opsz' 36;
  text-wrap: balance;
}

.body h3 {
  margin: 32px 0 12px;
  font: 600 21px/28px var(--font-serif);
  font-variation-settings: 'opsz' 24;
  text-wrap: balance;
}

.body a {
  color: var(--link);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

.body ul,
.body ol {
  margin: 0 0 24px;
  padding-left: 26px;
}

.body li {
  margin-bottom: 8px;
}

.body li p {
  margin: 0;
}

.body li ul,
.body li ol {
  margin: 8px 0 0;
}

.body > blockquote {
  margin: 0 0 24px;
  padding-left: 20px;
  border-left: 3px solid var(--line-strong);
  color: var(--ink-secondary);
}

.body > blockquote p + p {
  margin-top: 12px;
}

.body hr {
  margin: 40px auto;
  width: 80px;
  border: 0;
  border-top: 1px solid var(--line-strong);
}

.tableWrap {
  margin: 32px 0;
  overflow-x: auto;
}

.tableWrap table {
  width: 100%;
  border-collapse: collapse;
  font: 400 15px/22px var(--font-sans);
}

.tableWrap th,
.tableWrap td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

.tableWrap th {
  font-weight: 600;
  border-bottom-color: var(--ink);
}

.tableWrap p {
  margin: 0;
}

.pq {
  margin: 40px 0;
}

.pqRule {
  display: block;
  width: 32px;
  height: 3px;
  margin-bottom: 16px;
  background: var(--compass-mark);
}

.pq blockquote {
  margin: 0;
}

.pq blockquote p {
  margin: 0;
  font: italic 400 28px/38px var(--font-serif);
  font-variation-settings: 'opsz' 36;
  text-wrap: pretty;
}

.pq figcaption {
  margin-top: 12px;
  font: 600 13px/18px var(--font-sans);
}

.note {
  margin: 32px 0;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.note p {
  font: 400 15px/22px var(--font-sans);
  color: var(--ink-secondary);
}

.note b {
  color: var(--ink);
  font-weight: 600;
}

.facts {
  margin: 32px 0;
  padding: var(--space-5);
  background: var(--paper-sunken);
  border-top: var(--rule-heavy) solid var(--ink);
}

.factsKicker {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.factsTitle {
  margin-top: 6px;
  font: 600 19px/25px var(--font-serif);
  font-variation-settings: 'opsz' 20;
}

.figs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin: 16px 0 0;
}

.fig {
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-end;
  gap: 4px;
}

.figValue {
  margin: 0;
  font: 500 30px/34px var(--font-mono);
  letter-spacing: -0.02em;
  color: var(--ink);
}

.figLabel {
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.source {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font: 400 12px/18px var(--font-mono);
  color: var(--ink-muted);
}

.readMore {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 32px 0;
  padding: 14px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.readMoreLabel {
  font: 600 12px/16px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--meridian);
}

.readMore a {
  font: 600 19px/25px var(--font-serif);
  color: var(--ink);
  text-decoration: none;
}

.readMore a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.video {
  margin: 32px 0;
  aspect-ratio: 16 / 9;
  background: var(--navy);
}

.video iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.videoButton {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  background: transparent;
  color: var(--on-navy);
  font: 500 16px/22px var(--font-sans);
  cursor: pointer;
  padding: var(--space-4);
}

.videoButton svg {
  color: var(--compass);
}

.videoButton small {
  font: 400 13px/18px var(--font-sans);
  opacity: 0.75;
}

.figure {
  margin: 32px 0;
}

.image {
  display: block;
  width: 100%;
  height: auto;
  background: var(--paper-sunken);
}

.figure figcaption,
.leadCaption {
  margin-top: 8px;
  font: 400 13px/18px var(--font-sans);
  color: var(--ink-secondary);
}

.credit {
  color: var(--ink-muted);
}
```

### `src/modules/editor/actions.ts`

```ts
'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { bodyMediaIds, docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { createSessionClient } from '@/lib/supabase/clients';
import { formatWib } from '@/lib/time';
import { requireStaff } from '@/modules/auth/staff';
import { mediaByIds } from '@/modules/media/queries';
import { type FieldErrors, parseArticleInput } from './input';
import { type ArticleListRow, getRevision, listArticles } from './queries';
import { publishProblems } from './rules';
import { prepareSave } from './save';
import type { ArticleStatus, Intent } from './status';

// Server Actions for articles. Each checks the session; the database checks it again (RLS + is_staff).

const INTENTS: Intent[] = ['autosave', 'save', 'review', 'draft', 'publish', 'schedule', 'update', 'unschedule', 'unpublish', 'archive', 'restore'];
const MAX_REQUEST = 1_000_000;

export type SaveResult =
  | {
      ok: true;
      version: number;
      slug: string;
      status: ArticleStatus;
      publishedAt: string | null;
      scheduledAt: string | null;
      savedAt: string;
    }
  | { ok: false; errors?: FieldErrors; conflict?: boolean; message?: string };

/** Creates an empty draft and opens it in the editor. A form action, so a link prefetch never creates drafts. */
export async function createArticle() {
  await requireStaff();
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('articles')
    .insert({ title: '', slug: `untitled-${crypto.randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (error || !data) throw new Error(`The article could not be created. ${error?.message ?? ''}`);
  redirect(`/newsroom/articles/${(data as { id: string }).id}`);
}

export async function saveArticle(raw: unknown, intent: Intent): Promise<SaveResult> {
  await requireStaff();
  if (!INTENTS.includes(intent)) return { ok: false, message: 'Unknown action.' };
  if (JSON.stringify(raw ?? null).length > MAX_REQUEST) {
    return { ok: false, message: 'This article is too long to save in one go. Split it into two articles.' };
  }
  const input = parseArticleInput(raw);
  if (!input.ok) return { ok: false, message: input.error };

  const supabase = await createSessionClient();
  const { data: current, error: readError } = await supabase
    .from('articles')
    .select('status,published_at,scheduled_at')
    .eq('id', input.value.id)
    .maybeSingle();
  if (readError) return { ok: false, message: `The article could not be saved. ${readError.message}` };
  if (!current) return { ok: false, message: 'This article no longer exists.' };

  const media = await mediaByIds([input.value.leadMediaId, ...bodyMediaIds(sanitizeDoc(input.value.body))]);
  const plan = prepareSave({
    input,
    current: current as { status: ArticleStatus; published_at: string | null; scheduled_at: string | null },
    intent,
    now: new Date(),
    media,
  });
  if (!plan.ok) return { ok: false, errors: plan.errors };

  const { data, error } = await supabase.rpc('save_article', {
    p_id: input.value.id,
    p_version: input.value.version,
    p_fields: plan.fields,
    p_authors: plan.authors,
    p_tags: plan.tags,
    p_related: plan.related,
    p_revision: intent === 'autosave' ? 'Autosaved' : plan.revision,
    p_throttle: plan.throttle,
  });
  if (error) {
    if (error.message.includes('version_conflict')) return { ok: false, conflict: true };
    if (error.message.includes('slug_taken') || error.code === '23505') {
      return { ok: false, errors: { slug: 'Another article already uses this address. Change it, for example by adding a keyword.' } };
    }
    return { ok: false, message: `The article could not be saved. ${error.message}` };
  }
  const saved = data as { version: number; slug: string; status: ArticleStatus; published_at: string | null; scheduled_at: string | null; updated_at: string };
  return {
    ok: true,
    version: saved.version,
    slug: saved.slug,
    status: saved.status,
    publishedAt: saved.published_at,
    scheduledAt: saved.scheduled_at,
    savedAt: saved.updated_at,
  };
}

/** Deletes an article that is not published. Published articles must be unpublished or archived first. */
export async function deleteArticle(form: FormData) {
  await requireStaff();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/newsroom/articles');
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('articles').delete().eq('id', id).neq('status', 'published').select('id');
  if (error || !(data as unknown[] | null)?.length) redirect(`/newsroom/articles/${id}?notice=delete-failed`);
  redirect('/newsroom/articles?notice=deleted');
}

export type BulkState = { tone?: 'success' | 'error'; message?: string; problems?: { title: string; reasons: string[] }[] };

const BULK = ['publish', 'unpublish', 'archive', 'delete'] as const;
type BulkAction = (typeof BULK)[number];
const PAST: Record<BulkAction, string> = { publish: 'published', unpublish: 'unpublished', archive: 'archived', delete: 'deleted' };
const count = (n: number) => (n === 1 ? '1 article' : `${n} articles`);

export async function bulkArticles(_prev: BulkState, form: FormData): Promise<BulkState> {
  await requireStaff();
  const action = form.get('action') as BulkAction;
  const ids = form.getAll('ids').map(String).filter((id) => UUID.test(id));
  if (!BULK.includes(action)) return { tone: 'error', message: 'Choose what to do with the selected articles.' };
  if (!ids.length) return { tone: 'error', message: 'Select at least one article first.' };
  const supabase = await createSessionClient();

  if (action === 'delete') {
    const { data, error } = await supabase.from('articles').delete().in('id', ids).neq('status', 'published').select('id');
    if (error) return { tone: 'error', message: `Nothing was deleted. ${error.message}` };
    const deleted = (data as unknown[]).length;
    refresh();
    const skipped = ids.length - deleted;
    return {
      tone: 'success',
      message: `${count(deleted)} deleted.${skipped ? ` ${count(skipped)} skipped: published articles must be unpublished or archived first.` : ''}`,
    };
  }

  let ready = ids;
  const problems: { title: string; reasons: string[] }[] = [];
  if (action === 'publish') {
    const [{ data: rows }, { data: bylines }] = await Promise.all([
      supabase.from('articles').select('id,title,slug,section_id,standfirst,word_count,status,lead_media_id,body').in('id', ids),
      supabase.from('article_authors').select('article_id,author_id').in('article_id', ids),
    ]);
    type Row = { id: string; title: string; slug: string; section_id: string | null; standfirst: string; word_count: number; lead_media_id: string | null; body: unknown };
    const list = (rows ?? []) as Row[];
    const images = new Map(list.map((row) => [row.id, bodyMediaIds(sanitizeDoc(row.body))]));
    const media = await mediaByIds(list.flatMap((row) => [row.lead_media_id, ...(images.get(row.id) ?? [])]));
    ready = [];
    for (const row of list) {
      const found = publishProblems({
        leadImage: row.lead_media_id ? (media.get(row.lead_media_id) ?? null) : null,
        imagesWithoutAlt: (images.get(row.id) ?? []).filter((id) => !media.get(id)?.alt.trim()).length,
        title: row.title,
        slug: row.slug,
        sectionId: row.section_id,
        authorIds: ((bylines ?? []) as { article_id: string; author_id: string }[]).filter((b) => b.article_id === row.id).map((b) => b.author_id),
        standfirst: row.standfirst,
        wordCount: row.word_count,
      });
      if (Object.keys(found).length) problems.push({ title: row.title || 'Untitled', reasons: Object.values(found) as string[] });
      else ready.push(row.id);
    }
  }

  let moved = 0;
  if (ready.length) {
    const { data, error } = await supabase.rpc('set_article_status', { p_ids: ready, p_action: action });
    if (error) return { tone: 'error', message: `Nothing changed. ${error.message}` };
    moved = Number(data ?? 0);
  }
  refresh();
  return {
    tone: problems.length ? 'error' : 'success',
    message: `${count(moved)} ${PAST[action]}.${problems.length ? ` ${problems.length === 1 ? '1 article needs' : `${problems.length} articles need`} work before publishing:` : ''}`,
    problems,
  };
}

/** Puts a stored version back into the article. The current state is kept in history first. */
export async function restoreRevision(form: FormData) {
  await requireStaff();
  const articleId = String(form.get('articleId') ?? '');
  const revisionId = Number(form.get('revisionId'));
  if (!UUID.test(articleId) || !Number.isInteger(revisionId)) redirect('/newsroom/articles');
  const revision = await getRevision(articleId, revisionId);
  if (!revision) redirect(`/newsroom/articles/${articleId}/history?notice=missing`);
  const supabase = await createSessionClient();
  const { data: current } = await supabase.from('articles').select('version').eq('id', articleId).maybeSingle();
  if (!current) redirect('/newsroom/articles');

  await supabase.rpc('record_revision', { p_id: articleId, p_note: 'Before restore' });
  const snap = revision.snapshot;
  const fields: Record<string, unknown> = {};
  for (const key of ['title', 'standfirst', 'body', 'type', 'kicker_label', 'is_breaking', 'sources', 'section_id', 'lead_media_id', 'lead_caption'] as const) {
    if (key in snap) fields[key] = (snap as Record<string, unknown>)[key];
  }
  const body = sanitizeDoc(snap.body);
  const text = docText(body);
  Object.assign(fields, { body, body_text: text, word_count: wordCount(text), reading_minutes: readingMinutes(wordCount(text)) });
  const { error } = await supabase.rpc('save_article', {
    p_id: articleId,
    p_version: (current as { version: number }).version,
    p_fields: fields,
    p_authors: snap.authors ?? null,
    p_tags: snap.tags ?? null,
    p_related: snap.related ?? null,
    p_revision: `Restored the version from ${formatWib(revision.created_at)} WIB`,
  });
  if (error) redirect(`/newsroom/articles/${articleId}/history?notice=restore-failed`);
  redirect(`/newsroom/articles/${articleId}?notice=restored`);
}

/** Articles for the Related and Read more pickers. */
export async function findArticles(query: string, excludeId: string): Promise<Pick<ArticleListRow, 'id' | 'title' | 'status' | 'section'>[]> {
  await requireStaff();
  const { rows } = await listArticles({ q: query.slice(0, 100), limit: 8 });
  return rows.filter((row) => row.id !== excludeId).map(({ id, title, status, section }) => ({ id, title, status, section }));
}
```

### `src/modules/editor/input.ts`

```ts
import { UUID } from '@/lib/doc/schema';
import { isSlug } from '@/lib/slug';

// Checks what the editor in the browser sends before anything is saved. Shape problems (wrong
// types, unknown ids) reject the request; content problems come back as messages per field.

export const ARTICLE_TYPES = ['news', 'analysis', 'explainer', 'opinion', 'feature'] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const TYPE_LABELS: Record<ArticleType, string> = {
  news: 'News',
  analysis: 'Analysis',
  explainer: 'Explainer',
  opinion: 'Opinion',
  feature: 'Feature',
};

export const MAX = { title: 200, kicker: 40, standfirst: 400, authors: 10, tags: 30, related: 6, sources: 30, leadCaption: 300 } as const;

export type Source = { title: string; url: string; publisher: string; accessed: string };

export type ArticleInput = {
  id: string;
  version: number;
  title: string;
  slug: string;
  slugAuto: boolean;
  sectionId: string | null;
  type: ArticleType;
  kicker: string;
  standfirst: string;
  body: unknown;
  isBreaking: boolean;
  authorIds: string[];
  tagIds: string[];
  relatedIds: string[];
  sources: Source[];
  scheduledAt: string | null;
  majorUpdate: boolean;
  leadMediaId: string | null;
  leadCaption: string;
};

export type InputField = 'title' | 'slug' | 'kicker' | 'standfirst' | 'sources';
export type FieldErrors = Partial<Record<string, string>>;

export type ParseResult = { ok: true; value: ArticleInput; errors: FieldErrors } | { ok: false; error: string };

const UNEXPECTED = 'The editor sent something unexpected. Reload the page and try again.';
const HTTP = /^https?:\/\/\S+$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isIdList = (value: unknown, max: number): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every((id) => typeof id === 'string' && UUID.test(id)) && new Set(value).size === value.length;

export function parseArticleInput(raw: unknown): ParseResult {
  if (!isObject(raw)) return { ok: false, error: UNEXPECTED };
  const r = raw;
  const strings = ['title', 'slug', 'kicker', 'standfirst'] as const;
  if (
    typeof r.id !== 'string' ||
    !UUID.test(r.id) ||
    !Number.isInteger(r.version) ||
    (r.version as number) < 1 ||
    strings.some((key) => typeof r[key] !== 'string') ||
    typeof r.slugAuto !== 'boolean' ||
    typeof r.isBreaking !== 'boolean' ||
    typeof r.majorUpdate !== 'boolean' ||
    !(r.sectionId === null || (typeof r.sectionId === 'string' && UUID.test(r.sectionId))) ||
    !ARTICLE_TYPES.includes(r.type as ArticleType) ||
    !isIdList(r.authorIds, MAX.authors) ||
    !isIdList(r.tagIds, MAX.tags) ||
    !isIdList(r.relatedIds, MAX.related) ||
    !Array.isArray(r.sources) ||
    r.sources.length > MAX.sources ||
    !r.sources.every(isObject) ||
    !(r.scheduledAt === null || typeof r.scheduledAt === 'string') ||
    !(r.leadMediaId === null || (typeof r.leadMediaId === 'string' && UUID.test(r.leadMediaId))) ||
    typeof r.leadCaption !== 'string'
  ) {
    return { ok: false, error: UNEXPECTED };
  }

  const errors: FieldErrors = {};
  const title = (r.title as string).trim();
  const slug = (r.slug as string).trim();
  const kicker = (r.kicker as string).trim();
  const standfirst = (r.standfirst as string).trim();
  if (title.length > MAX.title) errors.title = `Keep the headline under ${MAX.title} characters.`;
  if (!isSlug(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  if (kicker.length > MAX.kicker) errors.kicker = `Keep the label under ${MAX.kicker} characters.`;
  if (standfirst.length > MAX.standfirst) errors.standfirst = `Keep the standfirst under ${MAX.standfirst} characters.`;
  const leadCaption = (r.leadCaption as string).trim();
  if (leadCaption.length > MAX.leadCaption) errors.leadCaption = `Keep the caption under ${MAX.leadCaption} characters.`;

  const sources: Source[] = [];
  let badSource = false;
  for (const item of r.sources as Record<string, unknown>[]) {
    const source = {
      title: typeof item.title === 'string' ? item.title.trim().slice(0, 200) : '',
      url: typeof item.url === 'string' ? item.url.trim().slice(0, 2000) : '',
      publisher: typeof item.publisher === 'string' ? item.publisher.trim().slice(0, 120) : '',
      accessed: typeof item.accessed === 'string' ? item.accessed.trim() : '',
    };
    if (!source.title && !source.url && !source.publisher && !source.accessed) continue;
    if (!source.title || !HTTP.test(source.url) || (source.accessed && !DATE.test(source.accessed))) badSource = true;
    sources.push(source);
  }
  if (badSource) errors.sources = 'Each source needs a title and a link that starts with https:// or http://. Dates use YYYY-MM-DD.';

  return {
    ok: true,
    errors,
    value: {
      id: (r.id as string).toLowerCase(),
      version: r.version as number,
      title,
      slug,
      slugAuto: r.slugAuto as boolean,
      sectionId: (r.sectionId as string | null)?.toLowerCase() ?? null,
      type: r.type as ArticleType,
      kicker,
      standfirst,
      body: r.body,
      isBreaking: r.isBreaking as boolean,
      authorIds: (r.authorIds as string[]).map((id) => id.toLowerCase()),
      tagIds: (r.tagIds as string[]).map((id) => id.toLowerCase()),
      relatedIds: (r.relatedIds as string[]).map((id) => id.toLowerCase()),
      sources,
      scheduledAt: r.scheduledAt as string | null,
      majorUpdate: r.majorUpdate as boolean,
      leadMediaId: (r.leadMediaId as string | null)?.toLowerCase() ?? null,
      leadCaption,
    },
  };
}
```

### `src/modules/editor/queries.ts`

```ts
import 'server-only';
import type { Doc } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import type { ArticleType, Source } from './input';
import type { ArticleStatus } from './status';

// Reads for the Articles list, the editor, history and preview (Newsroom session, RLS applies).

export const PAGE_SIZE = 25;

export type ArticleListRow = {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  type: ArticleType;
  is_breaking: boolean;
  word_count: number;
  updated_at: string;
  published_at: string | null;
  scheduled_at: string | null;
  section: { id: string; name: string; slug: string } | null;
  authors: string[];
};

export type ArticleFilter = { status?: ArticleStatus; q?: string; section?: string; author?: string; page?: number; limit?: number };

export type EditableArticle = {
  id: string;
  version: number;
  title: string;
  slug: string;
  section_id: string | null;
  type: ArticleType;
  kicker_label: string;
  standfirst: string;
  body: Doc;
  lead_media_id: string | null;
  lead_caption: string;
  status: ArticleStatus;
  published_at: string | null;
  scheduled_at: string | null;
  major_update_at: string | null;
  is_breaking: boolean;
  sources: Source[];
  word_count: number;
  updated_at: string;
  authorIds: string[];
  tagIds: string[];
  related: { id: string; title: string; status: ArticleStatus }[];
};

export type Revision = { id: number; note: string; created_at: string };
export type RevisionSnapshot = Revision & {
  snapshot: Partial<Omit<EditableArticle, 'related' | 'authorIds' | 'tagIds'>> & { authors?: string[]; tags?: string[]; related?: string[] };
};

function check<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listArticles(filter: ArticleFilter = {}): Promise<{ total: number; rows: ArticleListRow[] }> {
  const supabase = await createSessionClient();
  const limit = filter.limit ?? PAGE_SIZE;
  return check(
    await supabase.rpc('newsroom_articles', {
      p_status: filter.status ?? null,
      p_query: filter.q || null,
      p_section: filter.section ?? null,
      p_author: filter.author ?? null,
      p_limit: limit,
      p_offset: Math.max(0, (filter.page ?? 1) - 1) * limit,
    }),
  );
}

export async function statusCounts(): Promise<Partial<Record<ArticleStatus, number>>> {
  const supabase = await createSessionClient();
  return check(await supabase.rpc('article_status_counts'));
}

/** Publishes scheduled articles whose time has passed. Never blocks a page: failures are logged. */
export async function publishDue(): Promise<number> {
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.rpc('publish_due_articles');
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  } catch (error) {
    console.error('Scheduled publishing check failed:', (error as Error).message);
    return 0;
  }
}

export async function getArticle(id: string): Promise<EditableArticle | null> {
  const supabase = await createSessionClient();
  const article = check<Omit<EditableArticle, 'authorIds' | 'tagIds' | 'related'> | null>(
    await supabase
      .from('articles')
      .select(
        'id,version,title,slug,section_id,type,kicker_label,standfirst,body,lead_media_id,lead_caption,status,published_at,scheduled_at,major_update_at,is_breaking,sources,word_count,updated_at',
      )
      .eq('id', id)
      .maybeSingle(),
  );
  if (!article) return null;
  const [authors, tags, related] = await Promise.all([
    supabase.from('article_authors').select('author_id,position').eq('article_id', id).order('position'),
    supabase.from('article_tags').select('tag_id').eq('article_id', id),
    supabase.from('article_related').select('related_id,position').eq('article_id', id).order('position'),
  ]);
  const relatedIds = check<{ related_id: string }[]>(related).map((row) => row.related_id);
  let relatedArticles: { id: string; title: string; status: ArticleStatus }[] = [];
  if (relatedIds.length) {
    const rows = check<{ id: string; title: string; status: ArticleStatus }[]>(
      await supabase.from('articles').select('id,title,status').in('id', relatedIds),
    );
    relatedArticles = relatedIds.map((rid) => rows.find((row) => row.id === rid)).filter((row) => row !== undefined);
  }
  return {
    ...article,
    authorIds: check<{ author_id: string }[]>(authors).map((row) => row.author_id),
    tagIds: check<{ tag_id: string }[]>(tags).map((row) => row.tag_id),
    related: relatedArticles,
  };
}

export async function listRevisions(articleId: string): Promise<Revision[]> {
  const supabase = await createSessionClient();
  return check(await supabase.from('article_revisions').select('id,note,created_at').eq('article_id', articleId).order('id', { ascending: false }));
}

export async function getRevision(articleId: string, revisionId: number): Promise<RevisionSnapshot | null> {
  const supabase = await createSessionClient();
  return check(
    await supabase.from('article_revisions').select('id,note,created_at,snapshot').eq('article_id', articleId).eq('id', revisionId).maybeSingle(),
  );
}

export type Dashboard = {
  published_today: number;
  review: number;
  scheduled: number;
  drafts: number;
  next_scheduled_at: string | null;
};

export async function getDashboard(dayStart: Date): Promise<Dashboard> {
  const supabase = await createSessionClient();
  return check(await supabase.rpc('newsroom_dashboard', { p_day_start: dayStart.toISOString() }));
}

/** Titles and addresses of articles linked from a body (Read more cards) or chosen as related. */
export async function articleLinks(ids: string[]): Promise<Map<string, { title: string; href: string; status: ArticleStatus }>> {
  const links = new Map<string, { title: string; href: string; status: ArticleStatus }>();
  if (!ids.length) return links;
  const supabase = await createSessionClient();
  const rows = check<{ id: string; title: string; slug: string; status: ArticleStatus; section_id: string | null }[]>(
    await supabase.from('articles').select('id,title,slug,status,section_id').in('id', ids),
  );
  const sectionIds = [...new Set(rows.map((row) => row.section_id).filter((id) => id !== null))];
  const sections = sectionIds.length
    ? check<{ id: string; slug: string }[]>(await supabase.from('sections').select('id,slug').in('id', sectionIds))
    : [];
  for (const row of rows) {
    const section = sections.find((s) => s.id === row.section_id);
    links.set(row.id, { title: row.title || 'Untitled', href: section ? `/${section.slug}/${row.slug}` : `/${row.slug}`, status: row.status });
  }
  return links;
}
```

### `src/modules/editor/rules.ts`

```ts
// What an article needs before readers can see it (Publish, Schedule, Update). Anything else the
// SEO panel checks later is a warning, not a block.

export const MIN_WORDS = 150;
export const UNTITLED_SLUG = /^untitled-[0-9a-f]{8}$/;

export type PublishCheck = {
  title: string;
  slug: string;
  sectionId: string | null;
  authorIds: string[];
  standfirst: string;
  wordCount: number;
  /** The chosen lead image (its alt text), or null when none is chosen. */
  leadImage: { alt: string } | null;
  /** Images in the text whose media item has no alt text. */
  imagesWithoutAlt: number;
};

export type PublishField = 'title' | 'slug' | 'sectionId' | 'authorIds' | 'standfirst' | 'body' | 'leadImage' | 'images';

export function publishProblems(article: PublishCheck): Partial<Record<PublishField, string>> {
  const problems: Partial<Record<PublishField, string>> = {};
  if (!article.title.trim()) problems.title = 'Add a headline before publishing.';
  if (!article.slug || UNTITLED_SLUG.test(article.slug)) problems.slug = 'Set the address before publishing. It fills in from the headline.';
  if (!article.sectionId) problems.sectionId = 'Choose a section.';
  if (!article.authorIds.length) problems.authorIds = 'Add at least one author.';
  if (!article.standfirst.trim()) problems.standfirst = 'Add a standfirst: one or two sentences under the headline.';
  if (article.wordCount < MIN_WORDS) problems.body = `The article needs at least ${MIN_WORDS} words. It has ${article.wordCount}.`;
  if (!article.leadImage) problems.leadImage = 'Choose a lead image.';
  else if (!article.leadImage.alt.trim()) problems.leadImage = 'Add alt text to the lead image: describe what it shows.';
  if (article.imagesWithoutAlt === 1) problems.images = 'One image in the text needs alt text.';
  else if (article.imagesWithoutAlt > 1) problems.images = `${article.imagesWithoutAlt} images in the text need alt text.`;
  return problems;
}
```

### `src/modules/editor/save.ts`

```ts
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { bodyMediaIds, docText, readingMinutes, wordCount } from '@/lib/doc/text';
import { parseWibInput } from '@/lib/time';
import type { ArticleInput, FieldErrors } from './input';
import { publishProblems } from './rules';
import { type Intent, type Timing, transition } from './status';

// Turns a checked editor input and the article's current status into exactly what save_article
// stores: the fields, the relations and the revision note. Pure, so the whole decision is tested.

export type SavePlan =
  | {
      ok: true;
      fields: Record<string, unknown>;
      authors: string[];
      tags: string[];
      related: string[];
      revision: string;
      throttle: boolean;
    }
  | { ok: false; errors: FieldErrors };

export function prepareSave({
  input,
  current,
  intent,
  now,
  media,
}: {
  input: { value: ArticleInput; errors: FieldErrors };
  current: Timing;
  intent: Intent;
  now: Date;
  /** Alt text of the media items this article uses (lead image and images in the text), by id. */
  media: Map<string, { alt: string }>;
}): SavePlan {
  if (Object.keys(input.errors).length) return { ok: false, errors: input.errors };
  const article = input.value;

  let scheduledAt: Date | null = null;
  if (article.scheduledAt) {
    scheduledAt = parseWibInput(article.scheduledAt);
    if (!scheduledAt) return { ok: false, errors: { scheduledAt: 'Enter a valid date and time.' } };
  }

  const step = transition(current, intent, { now, scheduledAt, majorUpdate: article.majorUpdate });
  if (!step.ok) return { ok: false, errors: { [step.field ?? 'status']: step.error } };

  const body = sanitizeDoc(article.body);
  const text = docText(body);
  const words = wordCount(text);

  if (step.needsRules) {
    const problems = publishProblems({
      title: article.title,
      slug: article.slug,
      sectionId: article.sectionId,
      authorIds: article.authorIds,
      standfirst: article.standfirst,
      wordCount: words,
      leadImage: article.leadMediaId ? (media.get(article.leadMediaId) ?? null) : null,
      imagesWithoutAlt: bodyMediaIds(body).filter((id) => !media.get(id)?.alt.trim()).length,
    });
    if (Object.keys(problems).length) return { ok: false, errors: problems };
  }

  const fields: Record<string, unknown> = {
    title: article.title,
    slug: article.slug,
    slug_auto: article.slugAuto,
    section_id: article.sectionId,
    type: article.type,
    kicker_label: article.kicker,
    standfirst: article.standfirst,
    body,
    body_text: text,
    word_count: words,
    reading_minutes: readingMinutes(words),
    is_breaking: article.isBreaking,
    lead_media_id: article.leadMediaId,
    lead_caption: article.leadCaption,
    sources: article.sources,
    status: step.status,
    published_at: step.published_at,
    scheduled_at: step.scheduled_at,
  };
  if (step.major_update_at) fields.major_update_at = step.major_update_at;

  return {
    ok: true,
    fields,
    authors: article.authorIds,
    tags: article.tagIds,
    related: article.relatedIds.filter((id) => id !== article.id),
    revision: step.note,
    throttle: step.throttle,
  };
}
```

### `src/modules/media/actions.ts`

```ts
'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { cloudinaryConfig, destroyAsset, FOLDER, fetchResource, type UploadPlan, uploadPlan } from './cloudinary';
import { listMedia, mediaUsage } from './queries';
import { MEDIA_COLUMNS, type MediaItem, type MediaRow, toMediaItem } from './types';
import { checkFile, type MediaDetails, parseMediaDetails } from './validate';

// Server Actions for media. Uploads go browser → Cloudinary directly; the server signs the request
// first and checks the result with the Admin API afterwards, so only real uploads are recorded.

const NOT_CONNECTED = 'Cloudinary is not connected yet. Add the three Cloudinary keys to .env on your computer and to Vercel, then try again.';

export type PrepareResult = { ok: true; plan: UploadPlan } | { ok: false; error: string };

export async function prepareUpload(file: { name: string; type: string; size: number }): Promise<PrepareResult> {
  await requireStaff();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: NOT_CONNECTED };
  const problem = checkFile({ type: String(file?.type ?? ''), size: Number(file?.size ?? 0) });
  if (problem) return { ok: false, error: problem };
  return { ok: true, plan: uploadPlan(config, { fileName: String(file.name ?? 'image'), now: Math.floor(Date.now() / 1000) }) };
}

export type MediaResult = { ok: true; media: MediaItem } | { ok: false; error?: string; errors?: Partial<Record<keyof MediaDetails, string>> };

/** Records an upload after Cloudinary confirms it has the image. Sizes come from Cloudinary, not the browser. */
export async function registerUpload(input: { publicId: string; originalName: string } & Partial<MediaDetails>): Promise<MediaResult> {
  await requireStaff();
  const config = cloudinaryConfig();
  if (!config) return { ok: false, error: NOT_CONNECTED };
  const publicId = String(input?.publicId ?? '');
  if (!publicId.startsWith(`${FOLDER}/`) || publicId.includes('..')) return { ok: false, error: 'This upload cannot be recorded.' };
  const { values, errors } = parseMediaDetails(input as Record<string, unknown>);
  if (Object.keys(errors).length) return { ok: false, errors };

  let resource;
  try {
    resource = await fetchResource(config, publicId);
  } catch (error) {
    return { ok: false, error: `Cloudinary could not be reached. ${(error as Error).message}` };
  }
  if (!resource) return { ok: false, error: 'The file did not reach Cloudinary. Upload it again.' };

  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('media')
    .upsert(
      {
        public_id: resource.publicId,
        format: resource.format,
        width: resource.width,
        height: resource.height,
        bytes: resource.bytes,
        original_name: String(input.originalName ?? '').slice(0, 200),
        ...values,
      },
      { onConflict: 'public_id' },
    )
    .select(MEDIA_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: `The image is on Cloudinary but could not be saved here. ${error?.message ?? ''}` };
  return { ok: true, media: toMediaItem(data as MediaRow) };
}

/** Saves alt text, caption and credit (used by the image picker). */
export async function saveMediaDetails(id: string, details: Partial<MediaDetails>): Promise<MediaResult> {
  await requireStaff();
  if (!UUID.test(String(id))) return { ok: false, error: 'Unknown image.' };
  const { values, errors } = parseMediaDetails(details as Record<string, unknown>);
  if (Object.keys(errors).length) return { ok: false, errors };
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('media').update(values).eq('id', id).select(MEDIA_COLUMNS).single();
  if (error || !data) return { ok: false, error: `The details could not be saved. ${error?.message ?? ''}` };
  return { ok: true, media: toMediaItem(data as MediaRow) };
}

export type MediaFormState = { errors: Partial<Record<keyof MediaDetails, string>>; values?: MediaDetails; message?: string; saved?: boolean };

/** The details form on a media page. */
export async function updateMedia(_prev: MediaFormState, form: FormData): Promise<MediaFormState> {
  const result = await saveMediaDetails(String(form.get('id') ?? ''), Object.fromEntries(form) as Partial<MediaDetails>);
  if (result.ok) {
    refresh();
    return { errors: {}, values: { alt: result.media.alt, caption: result.media.caption, credit: result.media.credit }, saved: true };
  }
  return { errors: result.errors ?? {}, values: parseMediaDetails(Object.fromEntries(form)).values, message: result.error };
}

/** Deletes an unused image: the record first, then the file on Cloudinary. */
export async function deleteMedia(form: FormData) {
  await requireStaff();
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/newsroom/media');
  if ((await mediaUsage(id)).length) redirect(`/newsroom/media/${id}?notice=in-use`);
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('media').delete().eq('id', id).select('public_id');
  const row = (data as { public_id: string }[] | null)?.[0];
  if (error || !row) redirect(`/newsroom/media/${id}?notice=delete-failed`);
  const config = cloudinaryConfig();
  if (config) {
    const removed = await destroyAsset(config, row.public_id, Math.floor(Date.now() / 1000)).catch(() => false);
    if (!removed) console.error(`Cloudinary did not delete ${row.public_id}. Remove it in the Cloudinary Media Library.`);
  }
  redirect('/newsroom/media?notice=deleted');
}

/** Pages of the library for the image picker. */
export async function searchMedia(query: string, page = 1): Promise<{ total: number; items: MediaItem[] }> {
  await requireStaff();
  return listMedia({ q: String(query ?? '').slice(0, 100), page: Math.max(1, Math.floor(Number(page) || 1)), limit: 12 });
}
```

### `src/modules/media/cloudinary.ts`

```ts
import { createHash, randomBytes } from 'node:crypto';
import { slugify } from '@/lib/slug';

// Cloudinary over plain HTTP: signed direct uploads from the browser, reading an uploaded image back
// through the Admin API, and deleting it. No SDK. Server only: this module handles the API secret.

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string; apiUrl: string };

export const FOLDER = 'presscompass/images';
export const ALLOWED_FORMATS = 'jpg,png,webp,avif,gif';
/** Incoming transformation: images are stored at most 2560 px wide, at automatic quality. */
export const INCOMING = 'c_limit,w_2560,q_auto';

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Reads the Cloudinary keys from the environment, or null when uploads are not set up. */
export function cloudinaryConfig(env: Record<string, string | undefined> = process.env): CloudinaryConfig | null {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, apiUrl: env.CLOUDINARY_API_URL?.trim() || 'https://api.cloudinary.com' };
}

/**
 * The Cloudinary signature: parameters sorted by name, `name=value` joined with `&`, the API secret
 * appended, SHA-1 hex. Empty values are left out. https://cloudinary.com/documentation/authentication_signatures
 */
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(serialized + apiSecret).digest('hex');
}

const suffix8 = () => randomBytes(4).toString('hex');

/** `presscompass/images/<name-from-file>-<8 hex>`. The suffix keeps uploads from overwriting each other. */
export function publicIdFor(fileName: string, suffix: () => string = suffix8): string {
  const base = slugify(fileName.replace(/\.[^.]*$/, ''), 60) || 'image';
  return `${FOLDER}/${base}-${suffix()}`;
}

export type UploadPlan = { publicId: string; uploadUrl: string; fields: Record<string, string> };

/** Everything the browser needs to upload one file straight to Cloudinary. */
export function uploadPlan(config: CloudinaryConfig, input: { fileName: string; now: number; suffix?: () => string }): UploadPlan {
  const publicId = publicIdFor(input.fileName, input.suffix);
  const signed = {
    allowed_formats: ALLOWED_FORMATS,
    overwrite: 'false',
    public_id: publicId,
    timestamp: String(input.now),
    transformation: INCOMING,
  };
  return {
    publicId,
    uploadUrl: `${config.apiUrl}/v1_1/${config.cloudName}/image/upload`,
    fields: { ...signed, api_key: config.apiKey, signature: signParams(signed, config.apiSecret) },
  };
}

export type CloudinaryResource = { publicId: string; format: string; width: number; height: number; bytes: number };

const pathOf = (publicId: string) => publicId.split('/').map(encodeURIComponent).join('/');

/** Reads an uploaded image (Admin API). Null when Cloudinary does not have it. */
export async function fetchResource(config: CloudinaryConfig, publicId: string, fetcher: Fetcher = fetch): Promise<CloudinaryResource | null> {
  const response = await fetcher(`${config.apiUrl}/v1_1/${config.cloudName}/resources/image/upload/${pathOf(publicId)}`, {
    headers: { authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  const body = (await response.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(`Cloudinary: ${body.error?.message ?? response.statusText}`);
  return {
    publicId: String(body.public_id),
    format: String(body.format),
    width: Number(body.width),
    height: Number(body.height),
    bytes: Number(body.bytes),
  };
}

/** Deletes an image and clears its CDN copies. True when Cloudinary removed it or never had it. */
export async function destroyAsset(config: CloudinaryConfig, publicId: string, now: number, fetcher: Fetcher = fetch): Promise<boolean> {
  const signed = { invalidate: 'true', public_id: publicId, timestamp: String(now) };
  const body = new URLSearchParams({ ...signed, api_key: config.apiKey, signature: signParams(signed, config.apiSecret) });
  const response = await fetcher(`${config.apiUrl}/v1_1/${config.cloudName}/image/destroy`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { result?: string };
  return result.result === 'ok' || result.result === 'not found';
}
```

### `src/modules/media/queries.ts`

```ts
import 'server-only';
import { createSessionClient } from '@/lib/supabase/clients';
import { cloudinaryConfig } from './cloudinary';
import { MEDIA_COLUMNS, type MediaItem, type MediaRow, type MediaUse, toMediaItem } from './types';

// Reads for the media library, the image picker and articles that show images (Newsroom session).

export const MEDIA_PAGE_SIZE = 24;

function check<T>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Whether uploads can work: the three Cloudinary keys are set. */
export function uploadsReady(): boolean {
  return cloudinaryConfig() !== null;
}

export async function listMedia({ q = '', page = 1, limit = MEDIA_PAGE_SIZE }: { q?: string; page?: number; limit?: number } = {}) {
  const supabase = await createSessionClient();
  const result = check<{ total: number; rows: MediaRow[] }>(
    await supabase.rpc('newsroom_media', { p_query: q || null, p_limit: limit, p_offset: Math.max(0, page - 1) * limit }),
  );
  return { total: Number(result.total), items: result.rows.map(toMediaItem) };
}

export async function getMedia(id: string): Promise<MediaItem | null> {
  const supabase = await createSessionClient();
  const row = check<MediaRow | null>(await supabase.from('media').select(MEDIA_COLUMNS).eq('id', id).maybeSingle());
  return row ? toMediaItem(row) : null;
}

export async function mediaUsage(id: string): Promise<MediaUse[]> {
  const supabase = await createSessionClient();
  return check(await supabase.rpc('media_usage', { p_id: id }));
}

/** Media by id, for articles and previews that show several images. */
export async function mediaByIds(ids: (string | null | undefined)[]): Promise<Map<string, MediaItem>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const supabase = await createSessionClient();
  const rows = check<MediaRow[]>(await supabase.from('media').select(MEDIA_COLUMNS).in('id', unique));
  return new Map(rows.map((row) => [row.id, toMediaItem(row)]));
}
```

### `src/modules/media/types.ts`

```ts
// A media library item as the Newsroom uses it (camelCase), and the conversion from a database row.

export type MediaItem = {
  id: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  alt: string;
  caption: string;
  credit: string;
  originalName: string;
  createdAt: string;
  uses?: number;
};

export type MediaRow = {
  id: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  alt: string;
  caption: string;
  credit: string;
  original_name: string;
  created_at: string;
  uses?: number;
};

export const MEDIA_COLUMNS = 'id,public_id,format,width,height,bytes,alt,caption,credit,original_name,created_at';

export function toMediaItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    publicId: row.public_id,
    format: row.format,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    alt: row.alt,
    caption: row.caption,
    credit: row.credit,
    originalName: row.original_name,
    createdAt: row.created_at,
    ...(row.uses !== undefined ? { uses: Number(row.uses) } : {}),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type MediaUse = { kind: 'article' | 'author'; id: string; title: string; status: string | null; role: 'lead' | 'body' | 'photo' };
```

### `src/modules/media/validate.ts`

```ts
// Checks for files before upload (in the browser and on the server) and for media details.

export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'] as const;
export const MEDIA_LIMITS = { alt: 300, caption: 300, credit: 120 } as const;

/** A message when the file cannot be uploaded, or null. */
export function checkFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'Use a JPEG, PNG, WebP, AVIF or GIF image.';
  if (file.size <= 0) return 'The file is empty.';
  if (file.size > MAX_BYTES) return 'The file is larger than 10 MB. Make it smaller and try again.';
  return null;
}

export type MediaDetails = { alt: string; caption: string; credit: string };

export function parseMediaDetails(input: Record<string, unknown>): { values: MediaDetails; errors: Partial<Record<keyof MediaDetails, string>> } {
  const read = (key: keyof MediaDetails) => (typeof input[key] === 'string' ? (input[key] as string).trim() : '');
  const values = { alt: read('alt'), caption: read('caption'), credit: read('credit') };
  const errors: Partial<Record<keyof MediaDetails, string>> = {};
  if (values.alt.length > MEDIA_LIMITS.alt) errors.alt = `Keep the alt text under ${MEDIA_LIMITS.alt} characters.`;
  if (values.caption.length > MEDIA_LIMITS.caption) errors.caption = `Keep the caption under ${MEDIA_LIMITS.caption} characters.`;
  if (values.credit.length > MEDIA_LIMITS.credit) errors.credit = `Keep the credit under ${MEDIA_LIMITS.credit} characters.`;
  return { values, errors };
}
```

### `src/modules/taxonomy/actions.ts`

```ts
'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { UUID } from '@/lib/doc/schema';
import { createSessionClient } from '@/lib/supabase/clients';
import { requireStaff } from '@/modules/auth/staff';
import { type Errors, parseAuthor, parseSection, parseTag } from './validate';

// Server Actions for Sections, Tags and Authors. Each one checks the session itself.

export type FormState = { errors: Errors; values?: Record<string, unknown>; message?: string };

type Kind = 'section' | 'tag' | 'author';
const TABLE: Record<Kind, 'sections' | 'tags' | 'authors'> = { section: 'sections', tag: 'tags', author: 'authors' };
const LIST: Record<Kind, string> = { section: '/newsroom/sections', tag: '/newsroom/tags', author: '/newsroom/authors' };

function idFrom(form: FormData): string | null {
  const id = form.get('id');
  return typeof id === 'string' && UUID.test(id) ? id : null;
}

async function store(kind: Kind, id: string | null, row: Record<string, unknown>, values: Record<string, unknown>): Promise<FormState> {
  const supabase = await createSessionClient();
  let error: { code?: string; message: string } | null;
  if (id) {
    ({ error } = await supabase.from(TABLE[kind]).update(row).eq('id', id));
  } else {
    let position = {};
    if (kind === 'section') {
      const { count } = await supabase.from('sections').select('id', { count: 'exact', head: true });
      position = { position: count ?? 0 };
    }
    ({ error } = await supabase.from(TABLE[kind]).insert({ ...row, ...position }));
  }
  if (error?.code === '23505') return { errors: { slug: `Another ${kind} already uses this address.` }, values };
  if (error) return { errors: {}, values, message: `The ${kind} could not be saved. ${error.message}` };
  redirect(`${LIST[kind]}?notice=${id ? 'updated' : 'created'}`);
}

export async function saveSection(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseSection(form);
  if (Object.keys(errors).length) return { errors, values };
  const supabase = await createSessionClient();
  const { data: page } = await supabase.from('pages').select('id').eq('slug', values.slug).maybeSingle();
  if (page) return { errors: { slug: 'A page already uses this address. Choose another.' }, values };
  return store('section', idFrom(form), { name: values.name, slug: values.slug, description: values.description, in_nav: values.inNav }, values);
}

export async function saveTag(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseTag(form);
  if (Object.keys(errors).length) return { errors, values };
  return store('tag', idFrom(form), values, values);
}

export async function saveAuthor(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();
  const { values, errors } = parseAuthor(form);
  if (Object.keys(errors).length) return { errors, values };
  const { photoMediaId, ...rest } = values;
  return store('author', idFrom(form), { ...rest, photo_media_id: photoMediaId }, values);
}

async function remove(kind: Kind, form: FormData) {
  await requireStaff();
  const id = idFrom(form);
  if (!id) redirect(LIST[kind]);
  const supabase = await createSessionClient();
  const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id);
  if (error) redirect(`${LIST[kind]}/${id}?notice=${error.code === '23503' ? 'in-use' : 'failed'}`);
  redirect(`${LIST[kind]}?notice=deleted`);
}

export async function deleteSection(form: FormData) {
  await remove('section', form);
}

export async function deleteTag(form: FormData) {
  await remove('tag', form);
}

export async function deleteAuthor(form: FormData) {
  await remove('author', form);
}

/** Moves a section one place up or down in the navigation order. */
export async function moveSection(form: FormData) {
  await requireStaff();
  const id = idFrom(form);
  const direction = form.get('direction') === 'up' ? -1 : 1;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from('sections').select('id,position').order('position').order('name');
  if (error || !data || !id) return;
  const order = (data as { id: string; position: number }[]).map((row) => row.id);
  const from = order.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  const current = new Map((data as { id: string; position: number }[]).map((row) => [row.id, row.position]));
  for (const [position, sectionId] of order.entries()) {
    if (current.get(sectionId) !== position) await supabase.from('sections').update({ position }).eq('id', sectionId);
  }
  refresh();
}
```

### `src/modules/taxonomy/queries.ts`

```ts
import 'server-only';
import { createSessionClient } from '@/lib/supabase/clients';
import type { AuthorLink } from './validate';

// Reads for the Sections, Tags and Authors pages and the article editor's pickers (Newsroom session).

export type Section = { id: string; name: string; slug: string; description: string; position: number; in_nav: boolean };
export type Tag = { id: string; name: string; slug: string; description: string };
export type Author = { id: string; name: string; slug: string; role: string; bio: string; links: AuthorLink[]; photo_media_id: string | null };
export type Usage = { sections: Record<string, number>; tags: Record<string, number>; authors: Record<string, number> };

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

export async function listSections(): Promise<Section[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('sections').select('id,name,slug,description,position,in_nav').order('position').order('name'));
}

export async function getSection(id: string): Promise<Section | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('sections').select('id,name,slug,description,position,in_nav').eq('id', id).maybeSingle());
}

export async function listTags(): Promise<Tag[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('tags').select('id,name,slug,description').order('name'));
}

export async function getTag(id: string): Promise<Tag | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('tags').select('id,name,slug,description').eq('id', id).maybeSingle());
}

export async function listAuthors(): Promise<Author[]> {
  const supabase = await createSessionClient();
  return rows(supabase.from('authors').select('id,name,slug,role,bio,links,photo_media_id').order('name'));
}

export async function getAuthor(id: string): Promise<Author | null> {
  const supabase = await createSessionClient();
  return rows(supabase.from('authors').select('id,name,slug,role,bio,links,photo_media_id').eq('id', id).maybeSingle());
}

/** How many articles (any status) use each section, tag and author. */
export async function getUsage(): Promise<Usage> {
  const supabase = await createSessionClient();
  return rows(supabase.rpc('newsroom_usage'));
}
```

### `src/modules/taxonomy/validate.ts`

```ts
import { UUID } from '@/lib/doc/schema';
import { isSlug, RESERVED_SLUGS, slugify } from '@/lib/slug';

// Checks the Section, Tag and Author forms. Empty addresses are filled in from the name.

export type Errors = Partial<Record<string, string>>;
export type SectionValues = { name: string; slug: string; description: string; inNav: boolean };
export type TagValues = { name: string; slug: string; description: string };
export type AuthorLink = { label: string; url: string };
export type AuthorValues = { name: string; slug: string; role: string; bio: string; links: AuthorLink[]; photoMediaId: string | null };

export const AUTHOR_LINK_ROWS = 4;
const HTTP = /^https?:\/\/\S+$/i;

const read = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

function nameAndSlug(form: FormData, noun: string, maxName: number, errors: Errors) {
  const name = read(form, 'name');
  const typed = read(form, 'slug');
  const slug = (typed || slugify(name)).toLowerCase();
  if (!name) errors.name = `Give the ${noun} a name.`;
  else if (name.length > maxName) errors.name = `Keep the name under ${maxName} characters.`;
  if ((name || typed) && !isSlug(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  return { name, slug };
}

function limit(value: string, max: number, field: string, label: string, errors: Errors) {
  if (value.length > max) errors[field] = `Keep the ${label} under ${max} characters.`;
  return value;
}

export function parseSection(form: FormData): { values: SectionValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'section', 60, errors);
  if (!errors.slug && (RESERVED_SLUGS as readonly string[]).includes(slug)) {
    errors.slug = `The site already uses /${slug}. Choose another address.`;
  }
  const description = limit(read(form, 'description'), 300, 'description', 'description', errors);
  return { values: { name, slug, description, inNav: form.get('in_nav') === 'on' }, errors };
}

export function parseTag(form: FormData): { values: TagValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'tag', 60, errors);
  const description = limit(read(form, 'description'), 300, 'description', 'description', errors);
  return { values: { name, slug, description }, errors };
}

export function parseAuthor(form: FormData): { values: AuthorValues; errors: Errors } {
  const errors: Errors = {};
  const { name, slug } = nameAndSlug(form, 'author', 80, errors);
  const role = limit(read(form, 'role'), 80, 'role', 'role', errors);
  const bio = limit(read(form, 'bio'), 1000, 'bio', 'biography', errors);
  const links: AuthorLink[] = [];
  for (let i = 0; i < AUTHOR_LINK_ROWS; i++) {
    const label = read(form, `link_label_${i}`).slice(0, 40);
    const url = read(form, `link_url_${i}`).slice(0, 500);
    if (!label && !url) continue;
    if (!label || !HTTP.test(url)) errors.links = 'Each link needs a label and an address that starts with https:// or http://.';
    links.push({ label, url });
  }
  const photo = read(form, 'photo_media_id');
  return { values: { name, slug, role, bio, links, photoMediaId: UUID.test(photo) ? photo.toLowerCase() : null }, errors };
}
```

### `supabase/migrations/20261115000100_media.sql`

```sql
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
```

### `tests/db/media.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './database';

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: TestDatabase;
let lead: string;
let inline: string;
let photo: string;
let unused: string;
let first: string;
let second: string;
let author: string;

const image = (mediaId: string) => ({ type: 'image', attrs: { mediaId, caption: '' } });

beforeAll(async () => {
  db = await createTestDatabase();
  const q = db.client;
  await q.query(`insert into auth.users (id, email) values ($1, 'owner@example.com'), ($2, 'stranger@example.com')`, [OWNER, STRANGER]);
  await q.query(`insert into public.staff (user_id) values ($1)`, [OWNER]);
  const media = async (name: string, alt: string, created: string) =>
    (
      await q.query(
        `insert into public.media (public_id, format, width, height, bytes, alt, original_name, created_at)
         values ($1, 'png', 1600, 900, 1000, $2, $3, $4) returning id`,
        [`presscompass/images/${name}`, alt, `${name}.png`, created],
      )
    ).rows[0].id as string;
  lead = await media('lead', 'Farmers in Karawang', '2026-11-13T01:00:00Z');
  inline = await media('inline', 'A rice warehouse', '2026-11-13T02:00:00Z');
  photo = await media('photo', 'Portrait', '2026-11-13T03:00:00Z');
  unused = await media('unused', '', '2026-11-13T04:00:00Z');
  const section = (await q.query(`insert into public.sections (name, slug) values ('Business', 'business') returning id`)).rows[0].id;
  const body = (blocks: unknown[]) => JSON.stringify({ type: 'doc', content: blocks });
  first = (
    await q.query(
      `insert into public.articles (title, slug, section_id, lead_media_id, body) values ('First', 'first', $1, $2, $3) returning id`,
      [section, lead, body([{ type: 'paragraph' }, image(inline), { type: 'table', content: [] }])],
    )
  ).rows[0].id;
  second = (
    await q.query(`insert into public.articles (title, slug, section_id, body) values ('Second', 'second', $1, $2) returning id`, [
      section,
      body([image(inline), { type: 'blockquote', content: [image(inline)] }, image('not-a-uuid')]),
    ])
  ).rows[0].id;
  author = (await q.query(`insert into public.authors (name, slug, photo_media_id) values ('Rani', 'rani', $1) returning id`, [photo])).rows[0].id;
});

afterAll(async () => {
  await db?.close();
});

describe('media usage', () => {
  it('finds lead images, images in article text and author photos', async () => {
    await db.as('authenticated', OWNER, async (q) => {
      const usage = async (id: string) => (await q<{ u: unknown[] }>(`select public.media_usage($1) as u`, [id]))[0].u;
      expect(await usage(lead)).toEqual([{ kind: 'article', id: first, title: 'First', status: 'draft', role: 'lead' }]);
      expect(await usage(inline)).toEqual([
        { kind: 'article', id: first, title: 'First', status: 'draft', role: 'body' },
        { kind: 'article', id: second, title: 'Second', status: 'draft', role: 'body' },
      ]);
      expect(await usage(photo)).toEqual([{ kind: 'author', id: author, title: 'Rani', status: null, role: 'photo' }]);
      expect(await usage(unused)).toEqual([]);
    });
  });

  it('lists the library newest first with use counts, search and pages', async () => {
    await db.as('authenticated', OWNER, async (q) => {
      const list = async (args = '') =>
        (await q<{ r: { total: number; rows: { id: string; uses: number; alt: string }[] } }>(`select public.newsroom_media(${args}) as r`))[0].r;
      const all = await list();
      expect(all.total).toBe(4);
      expect(all.rows.map((row) => [row.id, row.uses])).toEqual([
        [unused, 0],
        [photo, 1],
        [inline, 2],
        [lead, 1],
      ]);
      expect((await list(`p_query => 'karawang'`)).rows.map((row) => row.id)).toEqual([lead]);
      expect((await list(`p_query => 'inline.png'`)).rows.map((row) => row.id)).toEqual([inline]);
      expect(await list(`p_limit => 2, p_offset => 2`)).toMatchObject({ total: 4, rows: [{ id: inline }, { id: lead }] });
    });
  });

  it('is only for Newsroom staff', async () => {
    await expect(db.as('anon', null, (q) => q(`select public.newsroom_media()`))).rejects.toThrow(/permission denied/);
    await expect(db.as('anon', null, (q) => q(`select public.media_usage($1)`, [lead]))).rejects.toThrow(/permission denied/);
    await expect(db.as('authenticated', STRANGER, (q) => q(`select public.media_usage($1)`, [lead]))).rejects.toThrow('not_staff');
  });
});
```

### `tests/e2e/articles.spec.ts`

```ts
import { expect, type Page, test } from '@playwright/test';
import { expectNoAxeViolations, seedArticle, seedMedia, seedTaxonomy, signIn, sql, unique } from './helpers';

// Locators use roles, not labels: Next keeps visited pages hidden in the DOM, and roles skip hidden elements.

const main = (page: Page) => page.getByRole('main');
const saveState = (page: Page) => main(page).locator('p[role="status"]');

async function newArticle(page: Page) {
  await page.goto('/newsroom/articles');
  await page.getByRole('button', { name: 'New article' }).click();
  await page.waitForURL(/\/newsroom\/articles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: 'Article text' })).toBeVisible();
  return page.url().split('/').pop() as string;
}

async function typeBody(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Article text' }).click();
  await page.keyboard.insertText(text);
}

test.describe('articles', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Editor flows run on desktop; the phone layout is checked separately.');
    await signIn(page);
  });

  test('writes a draft that saves itself, explains what blocks publishing, then publishes', async ({ page }) => {
    test.setTimeout(60_000);
    const { section, author, tag } = await seedTaxonomy('Write');
    const leadAlt = unique('Rice terraces in Bali');
    await seedMedia(leadAlt);
    const headline = unique('Rice prices climb');
    const id = await newArticle(page);

    await page.getByRole('textbox', { name: 'Headline' }).fill(headline);
    await page.getByRole('textbox', { name: 'Standfirst' }).fill('Farmers expect a smaller harvest.');
    await page.getByRole('button', { name: 'H2 heading' }).click();
    await page.keyboard.type('What changed');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('Prices rose again this week. '.repeat(32).trim());
    await expect(saveState(page)).toHaveText('Unsaved changes');
    await expect(saveState(page)).toHaveText(/^Saved /, { timeout: 15_000 });
    await expect(main(page).getByText(/^\d+ words · 1 min read$/)).toBeVisible();

    await page.getByRole('button', { name: 'Publish now' }).click();
    const problems = main(page).getByRole('alert');
    await expect(problems).toContainText('3 things need attention');
    await expect(problems).toContainText('Choose a section.');
    await expect(problems).toContainText('Add at least one author.');
    await expect(problems).toContainText('Choose a lead image.');

    await page.getByRole('button', { name: 'Choose image' }).click();
    const picker = page.getByRole('dialog', { name: 'Lead image' });
    await picker.getByRole('searchbox', { name: 'Search the media library' }).fill(leadAlt);
    await picker.getByRole('button', { name: 'Search' }).click();
    await picker.getByRole('button', { name: leadAlt }).click();
    await picker.getByRole('button', { name: 'Use as lead image' }).click();
    await expect(picker).toBeHidden();
    await expect(main(page).getByText(`Alt text: ${leadAlt}`)).toBeVisible();

    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('combobox', { name: 'Add an author' }).selectOption({ label: author.name });
    await page.getByRole('combobox', { name: 'Add a tag' }).selectOption({ label: tag.name });
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Published.' })).toBeVisible();
    await expect(main(page).getByText(/^First published /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Address' })).toHaveValue(headline.toLowerCase().replace(/ /g, '-'));

    const [row] = await sql<{ status: string; word_count: number; tags: number; heading: number }>(
      `select status, word_count,
              (select count(*)::int from public.article_tags where article_id = a.id) as tags,
              (body -> 'content' -> 0 -> 'attrs' ->> 'level')::int as heading
         from public.articles a where id = $1`,
      [id],
    );
    expect(row).toMatchObject({ status: 'published', tags: 1, heading: 2 });
    expect(row.word_count).toBeGreaterThanOrEqual(150);

    await page.goto(`/newsroom/preview/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(headline);
    await expect(page.getByRole('heading', { level: 2, name: 'What changed' })).toBeVisible();
    await expect(page.getByText(`By ${author.name}`)).toBeVisible();
    await expect(page.getByText('Readers see this version.')).toBeVisible();

    await page.goto(`/newsroom/articles/${id}/history`);
    await expect(page.getByRole('cell', { name: /^Published/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Autosaved' })).toBeVisible();
  });

  test('adds the special blocks and shows them in the preview', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Blocks');
    const target = await seedArticle({ title: unique('Earlier story'), sectionId: section.id, authorId: author.id, ready: true, status: 'published' });
    const [{ title: targetTitle }] = await sql<{ title: string }>(`select title from public.articles where id = $1`, [target]);
    const id = await newArticle(page);
    await page.getByRole('textbox', { name: 'Headline' }).fill(unique('Blocks'));
    await typeBody(page, 'Opening paragraph.');

    await page.getByRole('button', { name: 'Pull quote' }).click();
    let dialog = page.getByRole('dialog', { name: 'Pull quote' });
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(dialog.getByText('Write the quote.')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Quote' }).fill('We are not done with this season yet.');
    await dialog.getByRole('textbox', { name: /Who said it/ }).fill('Head of Bulog');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'Key figures' }).click();
    dialog = page.getByRole('dialog', { name: 'Key figures' });
    await dialog.getByRole('textbox', { name: 'Figure 1' }).fill('31.5m');
    await dialog.getByRole('textbox', { name: 'Label 1' }).fill('tonnes expected');
    await dialog.getByRole('textbox', { name: 'Figure 2' }).fill('−2.4%');
    await dialog.getByRole('textbox', { name: 'Label 2' }).fill('on last year');
    await dialog.getByRole('textbox', { name: /Source/ }).fill('BPS');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'YouTube video' }).click();
    dialog = page.getByRole('dialog', { name: 'YouTube video' });
    await dialog.getByRole('textbox', { name: 'YouTube link' }).fill('https://vimeo.com/123');
    await dialog.getByRole('textbox', { name: 'What the video shows' }).fill('Harvest in Karawang');
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(dialog.getByText(/Paste a YouTube link/)).toBeVisible();
    await dialog.getByRole('textbox', { name: 'YouTube link' }).fill('https://youtu.be/dQw4w9WgXcQ');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await page.getByRole('button', { name: 'Read more card' }).click();
    dialog = page.getByRole('dialog', { name: 'Read more' });
    await dialog.getByRole('searchbox', { name: 'Find an article' }).fill(targetTitle);
    await dialog.getByRole('button', { name: 'Search' }).click();
    await dialog.getByRole('button', { name: new RegExp(targetTitle) }).click();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(page.getByText('PULL QUOTE', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();

    await page.goto(`/newsroom/preview/${id}`);
    await expect(page.getByText('We are not done with this season yet.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Key figures' })).toContainText('31.5m');
    await expect(page.getByText('Source: BPS')).toBeVisible();
    await expect(page.getByRole('link', { name: targetTitle })).toHaveAttribute('href', `/${section.slug}/${targetTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Play video: Harvest in Karawang' }).click();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toBeAttached();
  });

  test('schedules in WIB and publishes once the time has passed', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Schedule');
    const id = await seedArticle({ title: unique('Scheduled story'), sectionId: section.id, authorId: author.id, ready: true });
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await page.getByLabel('Publish time (WIB)').fill('2099-01-02T09:30');
    await page.getByRole('button', { name: 'Confirm schedule' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Scheduled for 2 Jan 2099, 09:30 WIB.' })).toBeVisible();
    const [row] = await sql<{ status: string; scheduled_at: Date }>(`select status, scheduled_at from public.articles where id = $1`, [id]);
    expect(row.status).toBe('scheduled');
    expect(row.scheduled_at.toISOString()).toBe('2099-01-02T02:30:00.000Z');

    await sql(`update public.articles set scheduled_at = now() - interval '1 minute' where id = $1`, [id]);
    await page.goto('/newsroom/articles?status=published');
    await expect(page.getByRole('row', { name: /Scheduled story/ }).filter({ hasText: 'Published' }).first()).toBeVisible();
  });

  test('unpublishes and archives after confirming, and archived articles are read-only', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Archive');
    const id = await seedArticle({ title: unique('Live story'), sectionId: section.id, authorId: author.id, ready: true, status: 'published' });
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Unpublish this article?' });
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await confirm.getByRole('button', { name: 'Unpublish' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Unpublished. Readers no longer see it.' })).toBeVisible();

    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByRole('dialog', { name: 'Archive this article?' }).getByRole('button', { name: 'Archive' }).click();
    await expect(main(page).getByText('Archived articles are read-only.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Headline' })).toBeDisabled();
    await page.getByRole('button', { name: 'Restore to draft' }).click();
    await expect(page.getByRole('textbox', { name: 'Headline' })).toBeEnabled();
  });

  test('refuses a save from a window that is out of date', async ({ page, context }) => {
    const id = await seedArticle({ title: unique('Two windows') });
    const other = await context.newPage();
    await other.goto(`/newsroom/articles/${id}`);
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('textbox', { name: 'Headline' }).fill('Saved in the first window');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();

    await other.getByRole('textbox', { name: 'Headline' }).fill('Typed in the second window');
    await other.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(other).getByRole('alert').filter({ hasText: 'This article changed in another window.' })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Reload' })).toBeVisible();
    const [row] = await sql<{ title: string }>(`select title from public.articles where id = $1`, [id]);
    expect(row.title).toBe('Saved in the first window');
  });

  test('restores an earlier version from the history', async ({ page }) => {
    const id = await newArticle(page);
    await page.getByRole('textbox', { name: 'Headline' }).fill('First headline');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Draft saved.' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Headline' }).fill('Second headline');
    await page.getByRole('button', { name: 'Save draft' }).click();
    // The first save's notice is still on screen, so wait for the second save in the database itself.
    await expect.poll(async () => (await sql<{ title: string }>(`select title from public.articles where id = $1`, [id]))[0].title).toBe('Second headline');

    await page.goto(`/newsroom/articles/${id}/history`);
    await page.getByRole('row').nth(2).getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('dialog', { name: 'Restore this version?' }).getByRole('button', { name: 'Restore' }).click();
    await page.waitForURL(`**/newsroom/articles/${id}?notice=restored`);
    await expect(page.getByRole('textbox', { name: 'Headline' })).toHaveValue('First headline');
    await expect(main(page).getByText('Earlier version restored.')).toBeVisible();
    await page.goto(`/newsroom/articles/${id}/history`);
    await expect(page.getByRole('cell', { name: /^Restored the version from/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Before restore' })).toBeVisible();
  });

  test('filters the list and publishes several articles at once, naming what blocks the rest', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Bulk');
    const ready = unique('Bulk ready');
    const thin = unique('Bulk thin');
    await seedArticle({ title: ready, sectionId: section.id, authorId: author.id, ready: true });
    await seedArticle({ title: thin, sectionId: section.id, authorId: author.id });

    await page.goto('/newsroom/articles');
    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByRole('searchbox', { name: 'Search articles' }).fill(ready);
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(2);
    await page.getByRole('link', { name: 'Clear' }).click();

    await page.getByRole('combobox', { name: 'Section' }).selectOption({ label: section.name });
    await page.getByRole('button', { name: 'Filter' }).click();
    await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByRole('checkbox', { name: 'Select all articles on this page' }).check();
    await page.getByRole('combobox', { name: 'Action for selected articles' }).selectOption('publish');
    await page.getByRole('button', { name: 'Apply' }).click();
    const notice = main(page).getByRole('alert');
    await expect(notice).toContainText('1 article published. 1 article needs work before publishing:');
    await expect(notice).toContainText(thin);
    await expect(notice).toContainText('Add a standfirst');
    await expect(page.getByRole('row', { name: new RegExp(ready) })).toContainText('Published');

    await page.getByRole('checkbox', { name: `Select ${thin}` }).check();
    await page.getByRole('combobox', { name: 'Action for selected articles' }).selectOption('delete');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('dialog', { name: 'Delete 1 article?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(main(page).getByRole('status')).toContainText('1 article deleted.');
    await expect(page.getByRole('row', { name: new RegExp(thin) })).toHaveCount(0);
  });

  test('editor, list, history and preview are accessible in both themes', async ({ page }) => {
    const { section, author } = await seedTaxonomy('Axe');
    const id = await seedArticle({ title: unique('Accessible story'), sectionId: section.id, authorId: author.id, ready: true });
    for (const path of [`/newsroom/articles/${id}`, '/newsroom/articles', `/newsroom/articles/${id}/history`, `/newsroom/preview/${id}`, '/newsroom']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
      await page.waitForLoadState('networkidle');
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'light' });
    }
  });
});

test('the editor fits a phone screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone layout only.');
  const id = await seedArticle({ title: unique('Phone story') });
  await signIn(page, `/newsroom/articles/${id}`);
  await expect(page.getByRole('textbox', { name: 'Article text' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
```

### `tests/e2e/helpers.ts`

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { Client } from 'pg';

// Password the fake Supabase accepts (tests/fake-supabase/auth.mjs).
export const PASSWORD = 'correct-horse-battery-staple';

export async function signIn(page: Page, next = '/newsroom') {
  await page.goto(`/newsroom/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill('owner@example.com');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === next);
}

/** A name no other test (or parallel project) uses, so tests can share one database. */
export function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

// Direct access to the fake Supabase database (tests/fake-supabase), to set up data quickly.
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const url = new URL(ADMIN_URL);
  url.pathname = '/presscompass_e2e';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export const READY_BODY = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Prices of medium-grade rice rose for a third week as the dry season cut yields across Java.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Traders in Jakarta said supplies were thin. '.repeat(20).trim() }] },
  ],
};

/** A section, an author and a tag with unique names, created straight in the database. */
export async function seedTaxonomy(label: string) {
  const key = unique(label).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const [section] = await sql<{ id: string; name: string; slug: string }>(
    `insert into public.sections (name, slug) values ($1, $2) returning id, name, slug`,
    [`Section ${key}`, `s-${key}`],
  );
  const [author] = await sql<{ id: string; name: string }>(`insert into public.authors (name, slug, role) values ($1, $2, 'Reporter') returning id, name`, [
    `Author ${key}`,
    `a-${key}`,
  ]);
  const [tag] = await sql<{ id: string; name: string }>(`insert into public.tags (name, slug) values ($1, $2) returning id, name`, [`Tag ${key}`, `t-${key}`]);
  return { section, author, tag, key };
}

/** A media library row straight in the database (no file on the fake Cloudinary, so it shows as a blank image). */
export async function seedMedia(alt = 'Farmers plant rice seedlings in a flooded field.') {
  const key = unique('seed').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const [media] = await sql<{ id: string }>(
    `insert into public.media (public_id, format, width, height, bytes, alt, original_name) values ($1, 'jpg', 1600, 900, 120000, $2, $3) returning id`,
    [`presscompass/images/${key}`, alt, `${key}.jpg`],
  );
  return media.id;
}

/** An article straight in the database; `ready` fills everything publishing needs (including a lead image with alt text). */
export async function seedArticle(options: { title: string; sectionId?: string; authorId?: string; ready?: boolean; status?: string }) {
  const slug = options.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const leadMediaId = options.ready ? await seedMedia() : null;
  const [article] = await sql<{ id: string }>(
    `insert into public.articles (title, slug, section_id, standfirst, body, body_text, word_count, status, published_at, lead_media_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::public.article_status, case when $8::text = 'published' then now() else null end, $9) returning id`,
    [
      options.title,
      slug,
      options.sectionId ?? null,
      options.ready ? 'Why it matters for households.' : '',
      JSON.stringify(options.ready ? READY_BODY : { type: 'doc', content: [] }),
      '',
      options.ready ? 160 : 0,
      options.status ?? 'draft',
      leadMediaId,
    ],
  );
  if (options.authorId) await sql(`insert into public.article_authors (article_id, author_id) values ($1, $2)`, [article.id, options.authorId]);
  return article.id;
}
```

### `tests/e2e/media.spec.ts`

```ts
import { crc32, deflateSync } from 'node:zlib';
import { expect, type Page, test } from '@playwright/test';
import { expectNoAxeViolations, seedArticle, seedMedia, seedTaxonomy, signIn, sql, unique } from './helpers';

// Media runs against the fake Cloudinary inside the fake Supabase (tests/fake-supabase/cloudinary.mjs), which checks
// upload and delete signatures like the real one and serves the uploaded bytes back.

const FAKE_CLOUDINARY = 'http://127.0.0.1:3101/fake-cloudinary';
const main = (page: Page) => page.getByRole('main');

/** A solid-colour PNG of the given size. */
function png(width: number, height: number, [r, g, b]: [number, number, number]) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

const fileName = (label: string) => `${unique(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;

async function storedAssets(): Promise<string[]> {
  return (await fetch(`${FAKE_CLOUDINARY}/__assets`)).json();
}

async function mediaRow(originalName: string) {
  const [row] = await sql<{ id: string; public_id: string; width: number; height: number; alt: string }>(
    `select id, public_id, width, height, alt from public.media where original_name = $1`,
    [originalName],
  );
  return row;
}

test('uploads to the library, describes the image, and deletes it once it is unused', async ({ page }) => {
  const name = fileName('Harbour');
  await signIn(page, '/newsroom/media');
  await main(page)
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: 'image/png', buffer: png(3000, 1500, [32, 96, 160]) });
  await expect(main(page).getByText('Image uploaded. Add its alt text before using it in a published article.')).toBeVisible();

  // Signed upload with the incoming limit: stored at most 2560 px wide, under the site's folder.
  const row = await mediaRow(name);
  expect(row.public_id).toMatch(/^presscompass\/images\/harbour-[a-z0-9-]+-[0-9a-f]{8}$/);
  expect(row).toMatchObject({ width: 2560, height: 1280, alt: '' });
  expect(await storedAssets()).toContain(row.public_id);

  await main(page).getByRole('link', { name: new RegExp(name.replace('.png', '')) }).click();
  await page.waitForURL(`**/newsroom/media/${row.id}`);
  await expect(main(page).getByText(row.public_id)).toBeVisible();
  const alt = 'Fishing boats moored at Sunda Kelapa harbour.';
  await page.getByRole('textbox', { name: 'Alt text' }).fill(alt);
  await page.getByRole('textbox', { name: 'Credit' }).fill('Rani Prameswari/PressCompass');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(main(page).getByText('Details saved.')).toBeVisible();
  expect((await mediaRow(name)).alt).toBe(alt);

  const image = main(page).getByRole('img', { name: alt });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  expect(await image.getAttribute('srcset')).toContain(`${FAKE_CLOUDINARY}/demo/image/upload/c_limit,w_320,f_auto,q_auto/${row.public_id}`);

  await page.getByRole('button', { name: 'Delete image' }).click();
  await page.getByRole('dialog', { name: 'Delete this image?' }).getByRole('button', { name: 'Delete image' }).click();
  await page.waitForURL('**/newsroom/media?notice=deleted');
  await expect(main(page).getByText('Image deleted, here and on Cloudinary.')).toBeVisible();
  expect(await mediaRow(name)).toBeUndefined();
  expect(await storedAssets()).not.toContain(row.public_id);
});

test('refuses files that are not images before uploading', async ({ page }) => {
  await signIn(page, '/newsroom/media');
  await main(page)
    .locator('input[type="file"]')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(main(page).getByText('notes.txt: Use a JPEG, PNG, WebP, AVIF or GIF image.')).toBeVisible();
});

test.describe('images in articles', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Editor flows run on desktop.');
    await signIn(page);
  });

  test('every image needs alt text before publishing, and the preview shows the images', async ({ page }) => {
    test.setTimeout(60_000);
    const { section, author } = await seedTaxonomy('Images');
    const title = unique('Harbour story');
    const id = await seedArticle({ title, sectionId: section.id, authorId: author.id, ready: true });
    const name = fileName('Boats');
    await page.goto(`/newsroom/articles/${id}`);

    await page.getByRole('textbox', { name: 'Article text' }).click();
    await page.keyboard.press('Control+End');
    await page.getByRole('button', { name: 'Image', exact: true }).click();
    let picker = page.getByRole('dialog', { name: 'Insert an image' });
    await picker.locator('input[type="file"]').setInputFiles({ name, mimeType: 'image/png', buffer: png(1200, 800, [200, 120, 40]) });
    await expect(picker.getByRole('textbox', { name: 'Alt text' })).toBeVisible();
    await picker.getByRole('textbox', { name: /Caption/ }).fill('Boats wait for the tide.');
    await picker.getByRole('textbox', { name: /Credit/ }).fill('Rani Prameswari/PressCompass');
    await picker.getByRole('button', { name: 'Insert' }).click();
    await expect(picker).toBeHidden();
    await expect(main(page).getByText('Boats wait for the tide.')).toBeVisible();

    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('alert')).toContainText('One image in the text needs alt text.');

    await main(page).getByRole('button', { name: 'Edit', exact: true }).click();
    picker = page.getByRole('dialog', { name: 'Image' });
    await picker.getByRole('textbox', { name: 'Alt text' }).fill('Wooden boats tied up in a row at low tide.');
    await picker.getByRole('button', { name: 'Save' }).click();
    await expect(picker).toBeHidden();
    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Published.' })).toBeVisible();

    const upload = await mediaRow(name);
    const [stored] = await sql<{ images: { mediaId: string; caption: string }[] }>(
      `select jsonb_path_query_array(body, 'strict $.** ? (@.type == "image").attrs') as images from public.articles where id = $1`,
      [id],
    );
    expect(stored.images).toEqual([{ mediaId: upload.id, caption: 'Boats wait for the tide.' }]);

    await page.goto(`/newsroom/preview/${id}`);
    await expect(page.getByRole('img', { name: 'Farmers plant rice seedlings in a flooded field.' })).toBeVisible();
    const figure = page.getByRole('figure').filter({ has: page.getByRole('img', { name: 'Wooden boats tied up in a row at low tide.' }) });
    await expect(figure).toContainText('Boats wait for the tide.');
    await expect(figure).toContainText('Photo: Rani Prameswari/PressCompass');

    await page.goto(`/newsroom/media/${upload.id}`);
    const usedIn = main(page).getByRole('region', { name: 'Used in' });
    await expect(usedIn.getByRole('link', { name: title })).toBeVisible();
    await expect(usedIn).toContainText('In the text');
    await expect(main(page).getByText('Images in use cannot be deleted.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete image' })).toHaveCount(0);
  });

  test('gives an author a profile photo', async ({ page }) => {
    const { author } = await seedTaxonomy('Photo');
    const alt = unique('Portrait of a reporter');
    const mediaId = await seedMedia(alt);
    await page.goto(`/newsroom/authors/${author.id}`);
    await page.getByRole('button', { name: 'Choose photo' }).click();
    const picker = page.getByRole('dialog', { name: 'Author photo' });
    await picker.getByRole('searchbox', { name: 'Search the media library' }).fill(alt);
    await picker.getByRole('button', { name: 'Search' }).click();
    await picker.getByRole('button', { name: alt }).click();
    await picker.getByRole('button', { name: 'Use as photo' }).click();
    await expect(main(page).getByText(`Alt text: ${alt}`)).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL('**/newsroom/authors?notice=updated');
    const [row] = await sql<{ photo_media_id: string }>(`select photo_media_id from public.authors where id = $1`, [author.id]);
    expect(row.photo_media_id).toBe(mediaId);

    await page.goto(`/newsroom/media/${mediaId}`);
    await expect(main(page).getByRole('region', { name: 'Used in' })).toContainText('Author photo');
  });

  test('media pages and the picker are accessible in both themes', async ({ page }) => {
    const mediaId = await seedMedia(unique('Accessible image'));
    const id = await seedArticle({ title: unique('Accessible images') });
    const check = async () => {
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await expectNoAxeViolations(page);
      await page.emulateMedia({ colorScheme: 'light' });
    };
    for (const path of ['/newsroom/media', `/newsroom/media/${mediaId}`]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await check();
    }
    await page.goto(`/newsroom/articles/${id}`);
    await page.getByRole('button', { name: 'Choose image' }).click();
    await expect(page.getByRole('dialog', { name: 'Lead image' }).getByRole('list', { name: 'Images' }).getByRole('button').first()).toBeVisible();
    await check();
  });
});

test('the media library fits a phone screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone layout only.');
  await seedMedia(unique('Phone image'));
  await signIn(page, '/newsroom/media');
  await expect(main(page).getByRole('list', { name: 'Images' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
```

### `tests/fake-supabase/cloudinary.mjs`

```js
// Stand-in for Cloudinary under /fake-cloudinary: signed direct uploads (multipart), the Admin API
// resource read, signed destroy, and image delivery. It checks signatures exactly like Cloudinary,
// so a wrong signature in the app fails the E2E tests. Images live in memory for the run.
import { createHash } from 'node:crypto';

export const FAKE_KEY = process.env.FAKE_CLOUDINARY_KEY ?? 'fake-key';
export const FAKE_SECRET = process.env.FAKE_CLOUDINARY_SECRET ?? 'fake-secret';
const PREFIX = '/fake-cloudinary';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };

const assets = new Map();

function sign(params) {
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(serialized + FAKE_SECRET).digest('hex');
}

/** Format and size from the file header (PNG, JPEG, GIF, WebP VP8X), or null. */
function probe(bytes) {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length > 10 && bytes.toString('ascii', 0, 4) === 'GIF8') return { format: 'gif', width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (bytes.length > 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 16) === 'WEBPVP8X') {
    return { format: 'webp', width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { format: 'jpg', height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

const resourceJson = (publicId, asset) => ({
  public_id: publicId,
  format: asset.format,
  version: asset.version,
  resource_type: 'image',
  type: 'upload',
  width: asset.width,
  height: asset.height,
  bytes: asset.bytes,
  secure_url: `https://res.cloudinary.com/demo/image/upload/v${asset.version}/${publicId}.${asset.format}`,
});

async function upload(req, raw, send) {
  const form = await new Request('http://fake/upload', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: raw }).formData();
  const fields = {};
  let file = null;
  for (const [key, value] of form.entries()) {
    if (key === 'file') file = value;
    else fields[key] = String(value);
  }
  const { api_key: apiKey, signature, ...signed } = fields;
  if (apiKey !== FAKE_KEY) return send(401, { error: { message: 'Unknown API key' } });
  if (signature !== sign(signed)) return send(401, { error: { message: `Invalid Signature ${signature}. String to sign - '${Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join('&')}'.` } });
  if (Math.abs(Date.now() / 1000 - Number(signed.timestamp)) > 3600) return send(400, { error: { message: 'Stale request' } });
  if (!file || typeof file === 'string') return send(400, { error: { message: 'Missing required parameter - file' } });
  const bytes = Buffer.from(await file.arrayBuffer());
  const found = probe(bytes);
  if (!found) return send(400, { error: { message: 'Invalid image file' } });
  if (signed.allowed_formats && !signed.allowed_formats.split(',').includes(found.format)) {
    return send(400, { error: { message: `Image format ${found.format} not allowed` } });
  }
  const publicId = signed.public_id;
  if (assets.has(publicId) && signed.overwrite === 'false') return send(200, { ...resourceJson(publicId, assets.get(publicId)), existing: true });
  let { width, height } = found;
  const limit = /c_limit,w_(\d+)/.exec(signed.transformation ?? '');
  if (limit && width > Number(limit[1])) {
    height = Math.round((height * Number(limit[1])) / width);
    width = Number(limit[1]);
  }
  const asset = { format: found.format, width, height, bytes: bytes.length, data: bytes, version: Math.floor(Date.now() / 1000) };
  assets.set(publicId, asset);
  send(200, { ...resourceJson(publicId, asset), signature: sign({ public_id: publicId, version: String(asset.version) }) });
}

/** Handles /fake-cloudinary/* requests. Returns false for other paths. */
export async function handleCloudinary(req, url, raw, res) {
  if (!url.pathname.startsWith(PREFIX)) return false;
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...CORS, ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const path = url.pathname.slice(PREFIX.length);
  if (req.method === 'OPTIONS') return send(204), true;

  let match;
  if (req.method === 'POST' && (match = /^\/v1_1\/[^/]+\/image\/upload$/.exec(path))) {
    await upload(req, raw, send);
  } else if (req.method === 'GET' && (match = /^\/v1_1\/[^/]+\/resources\/image\/upload\/(.+)$/.exec(path))) {
    if (req.headers.authorization !== `Basic ${Buffer.from(`${FAKE_KEY}:${FAKE_SECRET}`).toString('base64')}`) {
      send(401, { error: { message: 'Invalid credentials' } });
    } else {
      const publicId = match[1].split('/').map(decodeURIComponent).join('/');
      const asset = assets.get(publicId);
      if (asset) send(200, resourceJson(publicId, asset));
      else send(404, { error: { message: `Resource not found - ${publicId}` } });
    }
  } else if (req.method === 'POST' && /^\/v1_1\/[^/]+\/image\/destroy$/.test(path)) {
    const fields = Object.fromEntries(new URLSearchParams(raw.toString()));
    const { api_key: apiKey, signature, ...signed } = fields;
    if (apiKey !== FAKE_KEY || signature !== sign(signed)) send(401, { error: { message: 'Invalid Signature' } });
    else send(200, { result: assets.delete(signed.public_id) ? 'ok' : 'not found' });
  } else if (req.method === 'GET' && path === '/__assets') {
    send(200, [...assets.keys()]);
  } else if (req.method === 'GET' && (match = /^\/[^/]+\/image\/upload\/(.+)$/.exec(path))) {
    const segments = match[1].split('/');
    if (segments[0].includes(',') || /^[a-z]{1,2}_/.test(segments[0])) segments.shift();
    const asset = assets.get(segments.map(decodeURIComponent).join('/'));
    if (!asset) send(404, { error: { message: 'Not found' } });
    else {
      res.writeHead(200, { 'content-type': TYPES[asset.format], 'cache-control': 'public, max-age=60', ...CORS });
      res.end(asset.data);
    }
  } else {
    send(404, { error: { message: `Fake Cloudinary has no route for ${req.method} ${path}` } });
  }
  return true;
}
```

### `tests/fake-supabase/server.mjs`

```js
// Fake Supabase (and Cloudinary) for E2E tests and local previews without the real services (no Docker):
// Auth for two test users, a Data API that runs real SQL on a fresh PostgreSQL database, and
// Cloudinary uploads, Admin API and image delivery under /fake-cloudinary.
//   FAKE_SUPABASE_PORT   port to listen on (3101)
//   FAKE_DATABASE_URL    a PostgreSQL server where the user may create databases
//   FAKE_DATABASE_NAME   database to (re)create on start (presscompass_e2e)
import { createServer } from 'node:http';
import { handleAuth, requestClaims } from './auth.mjs';
import { handleCloudinary } from './cloudinary.mjs';
import { createDatabase } from './database.mjs';
import { handleRest } from './rest.mjs';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 3101);
const ADMIN_URL = process.env.FAKE_DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';
const NAME = process.env.FAKE_DATABASE_NAME ?? 'presscompass_e2e';

const pool = await createDatabase({ adminUrl: ADMIN_URL, name: NAME });
const typeCache = new Map();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  if (await handleCloudinary(req, url, raw, res)) return;
  let body = {};
  try {
    body = raw.length ? JSON.parse(raw.toString()) : {};
  } catch {
    return send(400, { message: 'Invalid JSON body' });
  }
  req.claims = requestClaims(req);
  if (handleAuth(req, url, body, send)) return;
  if (await handleRest(pool, typeCache, req, url, body, send)) return;
  send(404, { message: `Fake Supabase has no route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Fake Supabase on http://127.0.0.1:${PORT} (database ${NAME})`));
```

### `tests/unit/article-body.test.tsx`

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Doc } from '@/lib/doc/schema';
import { ArticleBody } from '@/modules/content/ArticleBody';

const doc = (content: unknown[]) => ({ type: 'doc', content }) as Doc;

const IMAGE = '2c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';

describe('ArticleBody', () => {
  it('renders images from the media library with caption and credit, and skips deleted ones', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo';
    const html = renderToStaticMarkup(
      <ArticleBody
        media={new Map([[IMAGE, { publicId: 'presscompass/images/rice-abcd1234', width: 1600, height: 900, alt: 'Farmers in Karawang', credit: 'Rani/PressCompass' }]])}
        doc={doc([
          { type: 'image', attrs: { mediaId: IMAGE, caption: 'The harvest came early.' } },
          { type: 'image', attrs: { mediaId: '3c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d', caption: 'Gone' } },
        ])}
      />,
    );
    expect(html).toContain('alt="Farmers in Karawang"');
    expect(html).toContain('width="1600" height="900"');
    expect(html).toContain('srcSet="https://res.cloudinary.com/demo/image/upload/c_limit,w_320,f_auto,q_auto/presscompass/images/rice-abcd1234 320w');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('<figcaption>The harvest came early. <span class="credit">Photo: Rani/PressCompass</span></figcaption>');
    expect(html).not.toContain('Gone');
  });

  it('renders text blocks with their marks', () => {
    const html = renderToStaticMarkup(
      <ArticleBody
        doc={doc([
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changed' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Prices ' },
              { type: 'text', text: 'rose', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://bps.go.id' } }] },
              { type: 'hardBreak' },
              { type: 'text', text: 'again', marks: [{ type: 'italic' }] },
            ],
          },
          { type: 'paragraph' },
          { type: 'orderedList', attrs: { start: 2 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Two' }] }] }] },
        ])}
      />,
    );
    expect(html).toContain('<h2>What changed</h2>');
    expect(html).toContain('<a href="https://bps.go.id" rel="noopener"><strong>rose</strong></a><br/><em>again</em>');
    expect(html).toContain('<ol start="2"><li><p>Two</p></li></ol>');
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it('never renders a link it does not trust', () => {
    const html = renderToStaticMarkup(
      <ArticleBody doc={doc([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }])} />,
    );
    expect(html).toBe('<div class="body"><p>x</p></div>');
  });

  it('renders the special blocks', () => {
    const id = '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e';
    const html = renderToStaticMarkup(
      <ArticleBody
        links={new Map([[id, { title: 'Earlier story', href: '/business/earlier-story' }]])}
        doc={doc([
          { type: 'pullQuote', attrs: { text: 'We are not done.', attribution: 'Finance minister' } },
          { type: 'editorNote', attrs: { kind: 'correction', date: '2026-11-13', text: 'An earlier version misstated the figure.' } },
          { type: 'keyFigures', attrs: { title: 'Harvest', items: [{ value: '31.5m', label: 'tonnes' }], source: 'BPS' } },
          { type: 'readMore', attrs: { articleId: id, title: 'Old title' } },
          { type: 'readMore', attrs: { articleId: '1b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e', title: 'Deleted story' } },
          { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Briefing' } },
        ])}
      />,
    );
    expect(html).toContain('<blockquote><p>We are not done.</p></blockquote><figcaption>Finance minister</figcaption>');
    expect(html).toContain('<b>Correction · 13 Nov 2026.</b> An earlier version misstated the figure.');
    expect(html).toContain('<dd class="figValue">31.5m</dd>');
    expect(html).toContain('Source: BPS');
    expect(html).toContain('<a href="/business/earlier-story">Earlier story</a>');
    expect(html).not.toContain('Deleted story');
    expect(html).toContain('Play video: Briefing');
    expect(html).not.toContain('<iframe');
  });
});
```

### `tests/unit/doc.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { EMPTY_DOC } from '@/lib/doc/schema';
import { sanitizeDoc } from '@/lib/doc/sanitize';
import { bodyMediaIds, docText, readingMinutes, wordCount } from '@/lib/doc/text';

const p = (text: string, marks?: unknown[]) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] });

describe('sanitizeDoc', () => {
  it('keeps the blocks and marks the editor supports', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changed' }] },
        p('Prices rose ', [{ type: 'bold' }]),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('One')] }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p('Three')] }] },
        { type: 'blockquote', content: [p('Quoted')] },
        { type: 'horizontalRule' },
        { type: 'pullQuote', attrs: { text: 'We are not done.', attribution: 'Sri Mulyani, finance minister' } },
        { type: 'editorNote', attrs: { kind: 'correction', date: '2026-11-13', text: 'An earlier version misstated the figure.' } },
        { type: 'keyFigures', attrs: { title: 'Harvest', items: [{ value: '31.5m', label: 'tonnes' }, { value: '−2.4%', label: 'on year' }], source: 'BPS' } },
        { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Briefing' } },
        { type: 'readMore', attrs: { articleId: '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e', title: 'Earlier story' } },
        { type: 'image', attrs: { mediaId: '2c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d', caption: 'Farmers in Karawang' } },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 1, rowspan: 1 }, content: [p('Year')] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2, rowspan: 1 }, content: [p('2026')] }] },
          ],
        },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual(doc);
  });

  it('drops unknown attributes, unsafe links and marks it does not know', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { class: 'x' },
          content: [
            { type: 'text', text: 'safe', marks: [{ type: 'link', attrs: { href: 'https://bps.go.id', target: '_blank', onclick: 'x' } }] },
            { type: 'text', text: ' bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'italic' }] },
            { type: 'text', text: ' struck', marks: [{ type: 'strike' }, { type: 'bold' }, { type: 'bold' }] },
            { type: 'hardBreak' },
          ],
        },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'safe', marks: [{ type: 'link', attrs: { href: 'https://bps.go.id' } }] },
            { type: 'text', text: ' bad', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' struck', marks: [{ type: 'bold' }] },
            { type: 'hardBreak' },
          ],
        },
      ],
    });
  });

  it('turns blocks it does not allow in a place into paragraphs instead of losing their text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Too big' }] },
        { type: 'heading', attrs: { level: 5 }, content: [{ type: 'text', text: 'Too small' }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'let x = 1' }] },
        { type: 'blockquote', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Inside' }] }] },
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Too big' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Too small' }] },
        p('let x = 1'),
        { type: 'blockquote', content: [p('Inside')] },
      ],
    });
  });

  it('drops special blocks that are empty or invalid', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'pullQuote', attrs: { text: '   ', attribution: 'Nobody' } },
        { type: 'youtube', attrs: { videoId: 'too-short', title: 'x' } },
        { type: 'readMore', attrs: { articleId: 'nope', title: 'x' } },
        { type: 'image', attrs: { mediaId: 'nope', caption: 'x' } },
        { type: 'keyFigures', attrs: { title: 'x', items: [], source: '' } },
        { type: 'editorNote', attrs: { kind: 'rumour', date: 'yesterday', text: 'Still kept as an update' } },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual({
      type: 'doc',
      content: [{ type: 'editorNote', attrs: { kind: 'update', date: '', text: 'Still kept as an update' } }],
    });
  });

  it('returns an empty document for anything that is not a document', () => {
    expect(sanitizeDoc(null)).toEqual(EMPTY_DOC);
    expect(sanitizeDoc({ type: 'paragraph' })).toEqual(EMPTY_DOC);
    expect(sanitizeDoc('<p>hi</p>')).toEqual(EMPTY_DOC);
  });

  it('limits key figures to four and trims overlong text', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ value: String(i), label: 'x'.repeat(300) }));
    const clean = sanitizeDoc({ type: 'doc', content: [{ type: 'keyFigures', attrs: { title: '', items, source: '' } }] });
    const block = clean.content[0] as { attrs: { items: { label: string }[] } };
    expect(block.attrs.items).toHaveLength(4);
    expect(block.attrs.items[0].label).toHaveLength(120);
  });
});

describe('bodyMediaIds', () => {
  it('lists the images in the text once each', () => {
    const a = '2c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
    const b = '3c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
    const doc = sanitizeDoc({
      type: 'doc',
      content: [
        { type: 'image', attrs: { mediaId: a, caption: '' } },
        p('Text'),
        { type: 'image', attrs: { mediaId: b, caption: '' } },
        { type: 'image', attrs: { mediaId: a, caption: 'Again' } },
      ],
    });
    expect(bodyMediaIds(doc)).toEqual([a, b]);
  });
});

describe('document text', () => {
  it('collects readable text for search and counting', () => {
    const doc = sanitizeDoc({
      type: 'doc',
      content: [
        p('Rice prices rose.'),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('Java')] }, { type: 'listItem', content: [p('Bali')] }] },
        { type: 'pullQuote', attrs: { text: 'Not done yet.', attribution: 'Minister' } },
        { type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ', title: 'Video title' } },
      ],
    });
    expect(docText(doc)).toBe('Rice prices rose.\nJava\nBali\nNot done yet.');
  });

  it('counts words, including numbers and contractions, and estimates reading time', () => {
    expect(wordCount('Indonesia’s GDP grew 5.1% in Q3, didn’t it?')).toBe(8);
    expect(wordCount('')).toBe(0);
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(460)).toBe(2);
    expect(readingMinutes(461)).toBe(3);
  });
});
```

### `tests/unit/editor.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseArticleInput } from '@/modules/editor/input';
import { publishProblems } from '@/modules/editor/rules';
import { prepareSave } from '@/modules/editor/save';
import { intentLabel, statusActions, transition } from '@/modules/editor/status';

const NOW = new Date('2026-11-13T03:00:00Z');
const ID = '0b8a6f5e-58a8-4d5c-9b8e-0a5b8a1c2d3e';
const SECTION = '1c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
const AUTHOR = '2d0f8b3c-4e5a-4b6c-9d7e-8f9a0b1c2d3e';
const LEAD = '4e1f9c3d-5f6a-4c7d-8e9f-0a1b2c3d4e5f';
const INLINE = '5f2a0d4e-6a7b-4d8e-9f0a-1b2c3d4e5f60';
const MEDIA = new Map([
  [LEAD, { alt: 'Farmers in Karawang' }],
  [INLINE, { alt: '' }],
]);
const longBody = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'word '.repeat(160).trim() }] }] };

const raw = (over: Record<string, unknown> = {}) => ({
  id: ID,
  version: 3,
  title: 'Rice prices climb',
  slug: 'rice-prices-climb',
  slugAuto: true,
  sectionId: SECTION,
  type: 'news',
  kicker: '',
  standfirst: 'Why it matters for households.',
  body: longBody,
  isBreaking: false,
  authorIds: [AUTHOR],
  tagIds: [],
  relatedIds: [],
  sources: [],
  scheduledAt: null,
  majorUpdate: false,
  leadMediaId: LEAD,
  leadCaption: '',
  ...over,
});

describe('status actions', () => {
  it('offers one next step per status, with the rest as secondary actions', () => {
    expect(statusActions('draft')).toEqual({ primary: 'review', others: ['save', 'publish', 'schedule', 'archive'] });
    expect(statusActions('review')).toEqual({ primary: 'publish', others: ['save', 'schedule', 'draft', 'archive'] });
    expect(statusActions('scheduled')).toEqual({ primary: 'update', others: ['publish', 'unschedule', 'archive'] });
    expect(statusActions('published')).toEqual({ primary: 'update', others: ['unpublish', 'archive'] });
    expect(statusActions('archived')).toEqual({ primary: 'restore', others: [] });
  });

  it('labels actions in plain words', () => {
    expect(intentLabel('publish', 'review')).toBe('Publish');
    expect(intentLabel('publish', 'draft')).toBe('Publish now');
    expect(intentLabel('update', 'published')).toBe('Update');
    expect(intentLabel('update', 'scheduled')).toBe('Save changes');
    expect(intentLabel('unschedule', 'scheduled')).toBe('Cancel schedule');
  });
});

describe('transition', () => {
  const draft = { status: 'draft' as const, published_at: null, scheduled_at: null };

  it('publishes now, keeping the first publication time when there is one', () => {
    expect(transition(draft, 'publish', { now: NOW })).toMatchObject({
      ok: true,
      status: 'published',
      published_at: NOW.toISOString(),
      scheduled_at: null,
      note: 'Published',
      needsRules: true,
    });
    const before = { status: 'draft' as const, published_at: '2026-10-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(before, 'publish', { now: NOW })).toMatchObject({ published_at: '2026-10-01T00:00:00.000Z' });
  });

  it('schedules only for a time at least a minute ahead', () => {
    const at = new Date('2026-11-14T02:00:00Z');
    expect(transition(draft, 'schedule', { now: NOW, scheduledAt: at })).toMatchObject({
      ok: true,
      status: 'scheduled',
      scheduled_at: at.toISOString(),
      note: 'Scheduled for 14 Nov 2026, 09:00 WIB',
    });
    expect(transition(draft, 'schedule', { now: NOW })).toEqual({ ok: false, field: 'scheduledAt', error: 'Choose a date and time to publish.' });
    expect(transition(draft, 'schedule', { now: NOW, scheduledAt: new Date(NOW.getTime() + 30_000) })).toEqual({
      ok: false,
      field: 'scheduledAt',
      error: 'Choose a time at least a minute from now.',
    });
  });

  it('marks a major update on a published article', () => {
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'update', { now: NOW })).toMatchObject({ ok: true, status: 'published', note: 'Updated' });
    expect(transition(live, 'update', { now: NOW }).ok && 'major_update_at' in transition(live, 'update', { now: NOW })).toBe(false);
    expect(transition(live, 'update', { now: NOW, majorUpdate: true })).toMatchObject({ major_update_at: NOW.toISOString(), note: 'Major update' });
  });

  it('autosaves drafts with a throttled revision and refuses actions a status does not offer', () => {
    expect(transition(draft, 'autosave', { now: NOW })).toMatchObject({ ok: true, status: 'draft', note: 'Autosaved', throttle: true, needsRules: false });
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'autosave', { now: NOW })).toEqual({ ok: false, error: 'This action is not available for a published article.' });
    expect(transition({ ...draft, status: 'archived' }, 'publish', { now: NOW })).toEqual({ ok: false, error: 'This action is not available for an archived article.' });
  });

  it('cancels a schedule, unpublishes and archives', () => {
    const scheduled = { status: 'scheduled' as const, published_at: null, scheduled_at: '2026-11-20T00:00:00.000Z' };
    expect(transition(scheduled, 'unschedule', { now: NOW })).toMatchObject({ status: 'draft', scheduled_at: null, note: 'Schedule cancelled' });
    expect(transition(scheduled, 'archive', { now: NOW })).toMatchObject({ status: 'archived', scheduled_at: null });
    const live = { status: 'published' as const, published_at: '2026-11-01T00:00:00.000Z', scheduled_at: null };
    expect(transition(live, 'unpublish', { now: NOW })).toMatchObject({ status: 'draft', published_at: '2026-11-01T00:00:00.000Z', note: 'Unpublished' });
  });
});

describe('publish rules', () => {
  const ready = {
    title: 'Rice prices climb',
    slug: 'rice-prices-climb',
    sectionId: SECTION,
    authorIds: [AUTHOR],
    standfirst: 'Why.',
    wordCount: 150,
    leadImage: { alt: 'Farmers in Karawang' },
    imagesWithoutAlt: 0,
  };

  it('passes a complete article', () => {
    expect(publishProblems(ready)).toEqual({});
  });

  it('names every missing piece next to its field', () => {
    expect(
      publishProblems({ title: ' ', slug: 'untitled-0a1b2c3d', sectionId: null, authorIds: [], standfirst: '', wordCount: 149, leadImage: null, imagesWithoutAlt: 2 }),
    ).toEqual({
      leadImage: 'Choose a lead image.',
      images: '2 images in the text need alt text.',
      title: 'Add a headline before publishing.',
      slug: 'Set the address before publishing. It fills in from the headline.',
      sectionId: 'Choose a section.',
      authorIds: 'Add at least one author.',
      standfirst: 'Add a standfirst: one or two sentences under the headline.',
      body: 'The article needs at least 150 words. It has 149.',
    });
    expect(publishProblems({ ...ready, leadImage: { alt: ' ' }, imagesWithoutAlt: 1 })).toEqual({
      leadImage: 'Add alt text to the lead image: describe what it shows.',
      images: 'One image in the text needs alt text.',
    });
  });
});

describe('parseArticleInput', () => {
  it('accepts a well-formed article and trims the text fields', () => {
    const result = parseArticleInput(raw({ title: '  Rice prices climb  ', sources: [{ title: 'BPS', url: 'https://bps.go.id', publisher: '', accessed: '' }, { title: '', url: '', publisher: '', accessed: '' }] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Rice prices climb');
    expect(result.value.sources).toEqual([{ title: 'BPS', url: 'https://bps.go.id', publisher: '', accessed: '' }]);
    expect(result.errors).toEqual({});
  });

  it('reports field problems without rejecting the whole save', () => {
    const result = parseArticleInput(
      raw({ slug: 'Rice Prices', title: 'x'.repeat(201), sources: [{ title: '', url: 'ftp://x', publisher: '', accessed: 'soon' }] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errors).toEqual({
      title: 'Keep the headline under 200 characters.',
      slug: 'Use lowercase letters, numbers and single hyphens.',
      sources: 'Each source needs a title and a link that starts with https:// or http://. Dates use YYYY-MM-DD.',
    });
  });

  it('refuses input that is not an article', () => {
    expect(parseArticleInput(null)).toEqual({ ok: false, error: 'The editor sent something unexpected. Reload the page and try again.' });
    expect(parseArticleInput(raw({ id: 'nope' })).ok).toBe(false);
    expect(parseArticleInput(raw({ authorIds: ['nope'] })).ok).toBe(false);
    expect(parseArticleInput(raw({ type: 'gossip' })).ok).toBe(false);
    expect(parseArticleInput(raw({ leadMediaId: 'nope' })).ok).toBe(false);
    const long = parseArticleInput(raw({ leadCaption: 'x'.repeat(301) }));
    expect(long.ok && long.errors).toEqual({ leadCaption: 'Keep the caption under 300 characters.' });
  });
});

describe('prepareSave', () => {
  const current = { status: 'draft' as const, published_at: null, scheduled_at: null };
  const parsed = (over: Record<string, unknown> = {}) => {
    const result = parseArticleInput(raw(over));
    if (!result.ok) throw new Error(result.error);
    return result;
  };

  it('builds the fields, relations and revision note for a publish', () => {
    const plan = prepareSave({ input: parsed(), current, intent: 'publish', now: NOW, media: MEDIA });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.fields).toMatchObject({
      title: 'Rice prices climb',
      slug: 'rice-prices-climb',
      slug_auto: true,
      section_id: SECTION,
      status: 'published',
      published_at: NOW.toISOString(),
      word_count: 160,
      reading_minutes: 1,
    });
    expect(plan.fields).toMatchObject({ lead_media_id: LEAD, lead_caption: '' });
    expect(plan.fields.body_text).toBe('word '.repeat(160).trim());
    expect(plan).toMatchObject({ authors: [AUTHOR], tags: [], related: [], revision: 'Published', throttle: false });
  });

  it('checks the publish rules only for steps that put an article in front of readers', () => {
    const thin = parsed({ standfirst: '', body: { type: 'doc', content: [] } });
    expect(prepareSave({ input: thin, current, intent: 'save', now: NOW, media: MEDIA }).ok).toBe(true);
    expect(prepareSave({ input: thin, current, intent: 'publish', now: NOW, media: MEDIA })).toEqual({
      ok: false,
      errors: { standfirst: 'Add a standfirst: one or two sentences under the headline.', body: 'The article needs at least 150 words. It has 0.' },
    });
  });

  it('needs a lead image and alt text on every image before publishing', () => {
    const withImage = parsed({ body: { type: 'doc', content: [...longBody.content, { type: 'image', attrs: { mediaId: INLINE, caption: '' } }] } });
    expect(prepareSave({ input: withImage, current, intent: 'publish', now: NOW, media: MEDIA })).toEqual({
      ok: false,
      errors: { images: 'One image in the text needs alt text.' },
    });
    expect(prepareSave({ input: parsed({ leadMediaId: null }), current, intent: 'publish', now: NOW, media: MEDIA })).toEqual({
      ok: false,
      errors: { leadImage: 'Choose a lead image.' },
    });
    expect(prepareSave({ input: parsed({ leadMediaId: null }), current, intent: 'save', now: NOW, media: MEDIA }).ok).toBe(true);
  });

  it('blocks any save while a field is malformed, and reads the schedule in WIB', () => {
    expect(prepareSave({ input: parsed({ slug: 'Bad Slug' }), current, intent: 'autosave', now: NOW, media: MEDIA })).toEqual({
      ok: false,
      errors: { slug: 'Use lowercase letters, numbers and single hyphens.' },
    });
    const plan = prepareSave({ input: parsed({ scheduledAt: '2026-11-14T09:00' }), current, intent: 'schedule', now: NOW, media: MEDIA });
    expect(plan.ok && plan.fields.scheduled_at).toBe('2026-11-14T02:00:00.000Z');
  });
});
```

### `tests/unit/media.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { cloudinaryUrl, imageSources } from '@/lib/media/url';
import { destroyAsset, fetchResource, publicIdFor, signParams, uploadPlan } from '@/modules/media/cloudinary';
import { checkFile, MAX_BYTES, parseMediaDetails } from '@/modules/media/validate';

const config = { cloudName: 'demo', apiKey: 'key-123', apiSecret: 'abcd', apiUrl: 'https://api.cloudinary.com' };
const delivery = { cloudName: 'demo', deliveryUrl: 'https://res.cloudinary.com' };
const ID = 'presscompass/images/rice-field-abcd1234';

describe('signParams', () => {
  it('matches the examples in the Cloudinary documentation', () => {
    expect(signParams({ timestamp: '1315060510' }, 'abcd')).toBe('a21ad0f63beb4de2e5575204b79ab90bffb02c10');
    expect(signParams({ timestamp: '1315060510', public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }, 'abcd')).toBe(
      'bfd09f95f331f558cbd1320e67aa8d488770583e',
    );
  });

  it('leaves out empty values, as the Cloudinary SDKs do', () => {
    expect(signParams({ timestamp: '1315060510', folder: '' }, 'abcd')).toBe(signParams({ timestamp: '1315060510' }, 'abcd'));
  });
});

describe('uploads', () => {
  it('names files from their original name with a random suffix', () => {
    expect(publicIdFor('Rice Field (Karawang).JPG', () => 'abcd1234')).toBe('presscompass/images/rice-field-karawang-abcd1234');
    expect(publicIdFor('.png', () => 'abcd1234')).toBe('presscompass/images/image-abcd1234');
    expect(publicIdFor(`${'long '.repeat(30)}.png`, () => 'abcd1234')).toMatch(/^presscompass\/images\/(long-)+long-abcd1234$/);
  });

  it('gives the browser exactly the signed fields for a direct upload', () => {
    const plan = uploadPlan(config, { fileName: 'Rice field.png', now: 1793744000, suffix: () => 'abcd1234' });
    const signed = {
      allowed_formats: 'jpg,png,webp,avif,gif',
      overwrite: 'false',
      public_id: ID,
      timestamp: '1793744000',
      transformation: 'c_limit,w_2560,q_auto',
    };
    expect(plan).toEqual({
      publicId: ID,
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
      fields: { ...signed, api_key: 'key-123', signature: signParams(signed, 'abcd') },
    });
  });
});

describe('Admin API', () => {
  it('reads an uploaded image with basic authentication', async () => {
    const fetcher = vi.fn(async () => Response.json({ public_id: ID, format: 'png', width: 2560, height: 1440, bytes: 1234, version: 1 }));
    await expect(fetchResource(config, ID, fetcher)).resolves.toEqual({ publicId: ID, format: 'png', width: 2560, height: 1440, bytes: 1234 });
    expect(fetcher).toHaveBeenCalledWith(`https://api.cloudinary.com/v1_1/demo/resources/image/upload/${ID}`, {
      headers: { authorization: `Basic ${Buffer.from('key-123:abcd').toString('base64')}` },
      cache: 'no-store',
    });
  });

  it('returns null for an image Cloudinary does not have', async () => {
    const fetcher = vi.fn(async () => Response.json({ error: { message: 'Resource not found' } }, { status: 404 }));
    await expect(fetchResource(config, ID, fetcher)).resolves.toBeNull();
  });

  it('deletes an image with a signed request that also clears the CDN', async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => Response.json({ result: 'ok' }));
    await expect(destroyAsset(config, ID, 1793744000, fetcher)).resolves.toBe(true);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/destroy');
    const body = new URLSearchParams(String(init.body));
    const signed = { invalidate: 'true', public_id: ID, timestamp: '1793744000' };
    expect(Object.fromEntries(body)).toEqual({ ...signed, api_key: 'key-123', signature: signParams(signed, 'abcd') });
  });
});

describe('delivery URLs', () => {
  it('builds Cloudinary URLs per preset with automatic format and quality', () => {
    expect(cloudinaryUrl(delivery, { publicId: ID, preset: 'hero', width: 640 })).toBe(
      `https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,ar_16:9,w_640,f_auto,q_auto/${ID}`,
    );
    expect(cloudinaryUrl(delivery, { publicId: ID, preset: 'original', width: 960 })).toBe(
      `https://res.cloudinary.com/demo/image/upload/c_limit,w_960,f_auto,q_auto/${ID}`,
    );
  });

  it('offers widths up to the original size and keeps the shape of the preset', () => {
    const image = { publicId: ID, width: 1000, height: 500 };
    expect(imageSources(delivery, image, 'card')).toEqual({
      src: cloudinaryUrl(delivery, { publicId: ID, preset: 'card', width: 1000 }),
      srcSet: [320, 640, 960, 1000].map((w) => `${cloudinaryUrl(delivery, { publicId: ID, preset: 'card', width: w })} ${w}w`).join(', '),
      width: 1000,
      height: 667,
    });
    const large = imageSources(delivery, { publicId: ID, width: 2560, height: 1440 }, 'original');
    expect(large.srcSet.split(', ').map((entry) => entry.split(' ')[1])).toEqual(['320w', '640w', '960w', '1280w', '1920w']);
    expect(large).toMatchObject({ width: 1920, height: 1080, src: cloudinaryUrl(delivery, { publicId: ID, preset: 'original', width: 1280 }) });
  });
});

describe('validation', () => {
  it('accepts the image types and sizes Cloudinary Free takes', () => {
    expect(checkFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(checkFile({ type: 'image/jpeg', size: MAX_BYTES })).toBeNull();
    expect(checkFile({ type: 'image/svg+xml', size: 1000 })).toBe('Use a JPEG, PNG, WebP, AVIF or GIF image.');
    expect(checkFile({ type: 'image/png', size: MAX_BYTES + 1 })).toBe('The file is larger than 10 MB. Make it smaller and try again.');
    expect(checkFile({ type: 'image/png', size: 0 })).toBe('The file is empty.');
  });

  it('checks the alt text, caption and credit', () => {
    expect(parseMediaDetails({ alt: '  Farmers in Karawang ', caption: '', credit: 'Rani Prameswari' })).toEqual({
      values: { alt: 'Farmers in Karawang', caption: '', credit: 'Rani Prameswari' },
      errors: {},
    });
    expect(parseMediaDetails({ alt: 'x'.repeat(301), caption: 'y'.repeat(301), credit: 'z'.repeat(121) }).errors).toEqual({
      alt: 'Keep the alt text under 300 characters.',
      caption: 'Keep the caption under 300 characters.',
      credit: 'Keep the credit under 120 characters.',
    });
  });
});
```

### `tests/unit/taxonomy.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseAuthor, parseSection, parseTag } from '@/modules/taxonomy/validate';

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe('parseSection', () => {
  it('fills the address from the name and trims the text', () => {
    expect(parseSection(form({ name: '  Business & Economy ', slug: '', description: ' Money. ', in_nav: 'on' }))).toEqual({
      values: { name: 'Business & Economy', slug: 'business-and-economy', description: 'Money.', inNav: true },
      errors: {},
    });
    expect(parseSection(form({ name: 'Law', slug: 'law-and-courts', description: '' })).values).toMatchObject({ slug: 'law-and-courts', inNav: false });
  });

  it('explains what is wrong with each field', () => {
    expect(parseSection(form({ name: '', slug: 'Bad Slug', description: 'x'.repeat(301) })).errors).toEqual({
      name: 'Give the section a name.',
      slug: 'Use lowercase letters, numbers and single hyphens.',
      description: 'Keep the description under 300 characters.',
    });
    expect(parseSection(form({ name: 'Search', slug: '', description: '' })).errors).toEqual({
      slug: 'The site already uses /search. Choose another address.',
    });
  });
});

describe('parseTag', () => {
  it('accepts a tag and limits the name', () => {
    expect(parseTag(form({ name: 'El Niño', slug: '', description: '' }))).toEqual({
      values: { name: 'El Niño', slug: 'el-nino', description: '' },
      errors: {},
    });
    expect(parseTag(form({ name: 'x'.repeat(61), slug: 'x', description: '' })).errors).toEqual({ name: 'Keep the name under 60 characters.' });
  });
});

describe('parseAuthor', () => {
  it('collects the profile links that are filled in', () => {
    const result = parseAuthor(
      form({
        name: 'Rani Prameswari',
        slug: '',
        role: 'Business correspondent',
        bio: 'Covers trade.',
        link_label_0: 'X',
        link_url_0: 'https://x.com/rani',
        link_label_1: '',
        link_url_1: '',
      }),
    );
    expect(result).toEqual({
      values: {
        name: 'Rani Prameswari',
        slug: 'rani-prameswari',
        role: 'Business correspondent',
        bio: 'Covers trade.',
        links: [{ label: 'X', url: 'https://x.com/rani' }],
        photoMediaId: null,
      },
      errors: {},
    });
  });

  it('keeps a chosen photo and ignores anything that is not a media id', () => {
    const photo = '2c9e7a2b-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
    expect(parseAuthor(form({ name: 'Rani', slug: '', role: '', bio: '', photo_media_id: photo })).values.photoMediaId).toBe(photo);
    expect(parseAuthor(form({ name: 'Rani', slug: '', role: '', bio: '', photo_media_id: 'x' })).values.photoMediaId).toBeNull();
  });

  it('refuses links that are not web addresses', () => {
    const result = parseAuthor(form({ name: 'Rani', slug: '', role: '', bio: '', link_label_0: 'Mail', link_url_0: 'javascript:alert(1)' }));
    expect(result.errors).toEqual({ links: 'Each link needs a label and an address that starts with https:// or http://.' });
  });
});
```
