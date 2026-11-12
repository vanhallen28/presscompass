import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ds/Button';
import { noticeFor } from '@/components/newsroom/notices';
import { EmptyState, Notice, PageHeader, ui } from '@/components/newsroom/ui';
import { requireStaff } from '@/modules/auth/staff';
import { moveSection } from '@/modules/taxonomy/actions';
import { getUsage, listSections } from '@/modules/taxonomy/queries';

export const metadata: Metadata = { title: 'Sections' };

// The Newsroom reads the session on every request, so its pages block on the server (Cache Components).
export const instant = false;

export default async function SectionsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff();
  const [{ notice }, sections, usage] = await Promise.all([searchParams, listSections(), getUsage()]);
  const message = noticeFor('section', notice);

  return (
    <>
      <PageHeader
        title="Sections"
        description="Sections group articles and give them their address, like /business/rice-prices. The order here is the order in the main navigation."
        actions={
          <ButtonLink href="/newsroom/sections/new" variant="primary" icon="plus">
            New section
          </ButtonLink>
        }
      />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={ui.tableWrap}>
        {sections.length === 0 ? (
          <EmptyState icon="folder" title="No sections yet">
            <p>Create the sections of the site first, for example News, Politics and Business.</p>
          </EmptyState>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className={ui.num}>
                  Articles
                </th>
                <th scope="col">Navigation</th>
                <th scope="col">Order</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section, index) => (
                <tr key={section.id}>
                  <td className={ui.cellTitle}>
                    <Link href={`/newsroom/sections/${section.id}`}>{section.name}</Link>
                    <span className={ui.slug}>/{section.slug}</span>
                  </td>
                  <td className={ui.num}>{usage.sections[section.id] ?? 0}</td>
                  <td>{section.in_nav ? 'Shown' : 'Hidden'}</td>
                  <td>
                    <div className={ui.rowActions}>
                      <form action={moveSection}>
                        <input type="hidden" name="id" value={section.id} />
                        <input type="hidden" name="direction" value="up" />
                        <Button type="submit" variant="quiet" size="sm" icon="arrow-up" aria-label={`Move ${section.name} up`} disabled={index === 0} />
                      </form>
                      <form action={moveSection}>
                        <input type="hidden" name="id" value={section.id} />
                        <input type="hidden" name="direction" value="down" />
                        <Button
                          type="submit"
                          variant="quiet"
                          size="sm"
                          icon="arrow-down"
                          aria-label={`Move ${section.name} down`}
                          disabled={index === sections.length - 1}
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
