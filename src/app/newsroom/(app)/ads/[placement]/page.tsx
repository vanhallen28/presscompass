import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdSlotForm } from '@/components/newsroom/ads/AdSlotForm';
import styles from '@/components/newsroom/ads/ads.module.css';
import { PageHeader } from '@/components/newsroom/ui';
import { getAdSettings, getAdSlots } from '@/modules/ads/queries';
import { PLACEMENTS } from '@/modules/ads/types';
import { requireStaff } from '@/modules/auth/staff';

export const metadata: Metadata = { title: 'Ad slot' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function AdSlotPage({ params }: { params: Promise<{ placement: string }> }) {
  await requireStaff();
  const { placement } = await params;
  const place = PLACEMENTS.find((p) => p.key === placement);
  if (!place) notFound();
  const [settings, slots] = await Promise.all([getAdSettings(), getAdSlots()]);
  const slot = slots.find((s) => s.placement === place.key);
  if (!slot) notFound();

  return (
    <>
      <PageHeader title={place.name} back={{ href: '/newsroom/ads#slots', label: 'Ads' }} />
      <p className={styles.intro}>{place.where}</p>
      <AdSlotForm initial={slot} hasAdsense={Boolean(settings.adsenseClient)} />
    </>
  );
}
