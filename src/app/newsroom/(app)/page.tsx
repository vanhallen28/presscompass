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
