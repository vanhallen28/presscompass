import type { Metadata } from 'next';
import Link from 'next/link';
import { AdSettingsForm } from '@/components/newsroom/ads/AdSettingsForm';
import styles from '@/components/newsroom/ads/ads.module.css';
import { Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { getAdSettings, getAdSlots } from '@/modules/ads/queries';
import { AD_KINDS, ADSENSE_FORMATS, PLACEMENTS, type AdSlotRow } from '@/modules/ads/types';
import { requireStaff } from '@/modules/auth/staff';

export const metadata: Metadata = { title: 'Ads' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

const NOTICES: Record<string, string> = { updated: 'Ad settings saved.', 'slot-updated': 'Slot saved.' };

function describe(slot: AdSlotRow) {
  if (slot.kind === 'adsense') {
    const format = ADSENSE_FORMATS.find((f) => f.value === slot.adsenseFormat)?.label ?? '';
    return slot.adsenseSlot ? `AdSense ${format.toLowerCase()}, unit ${slot.adsenseSlot}` : 'AdSense, no unit yet';
  }
  if (slot.kind === 'gpt') return slot.gptPath ? `Ad Manager ${slot.gptPath}` : 'Ad Manager, no unit yet';
  return slot.html ? 'Code from another network' : AD_KINDS[2].label + ', empty';
}

const size = (px: number) => (px === 0 ? 'hidden' : `${px} px`);

export default async function AdsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, settings, slots] = await Promise.all([searchParams, getAdSettings(), getAdSlots()]);

  return (
    <>
      <PageHeader
        title="Ads"
        description="Google AdSense, Google Ad Manager, the Meta Pixel and code from other networks, the consent banner, and ads.txt. Readers see none of it until ads are turned on."
      />
      {notice && NOTICES[notice] && <Notice tone="success">{NOTICES[notice]}</Notice>}
      <p className={styles.intro}>
        Ads are <b className={settings.enabled ? styles.on : styles.off}>{settings.enabled ? 'on' : 'off'}</b>. Consent banner:{' '}
        {settings.consentRequired ? 'on' : 'off'}.
      </p>
      <AdSettingsForm initial={settings} />

      <section aria-labelledby="slots-title" id="slots" className={styles.page} style={{ marginTop: 'var(--space-7)' }}>
        <div>
          <h2 id="slots-title" className={styles.cardTitle}>
            Ad slots
          </h2>
          <p className={styles.intro}>Fixed places on the site, each with its own reserved height so pages do not jump when an ad loads.</p>
        </div>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Slot</th>
                <th scope="col">Code</th>
                <th scope="col">Phones</th>
                <th scope="col">Wide screens</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const place = PLACEMENTS.find((p) => p.key === slot.placement);
                return (
                  <tr key={slot.placement}>
                    <td className={ui.cellTitle}>
                      <Link href={`/newsroom/ads/${slot.placement}`}>{place?.name ?? slot.placement}</Link>
                      <span className={ui.slug}>{place?.where}</span>
                    </td>
                    <td>{describe(slot)}</td>
                    <td>{size(slot.heightMobile)}</td>
                    <td>{size(slot.heightDesktop)}</td>
                    <td>{slot.enabled ? 'On' : 'Off'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
