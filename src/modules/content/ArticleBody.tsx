import { Fragment, type ReactNode } from 'react';
import { CloudImage } from '@/components/media/CloudImage';
import type { Block, Doc, Inline, ListItem, Mark, TableRow } from '@/lib/doc/schema';
import { creditLine } from '@/lib/media/credit';
import styles from './article.module.css';
import { ChartFigure } from './ChartFigure';
import { YouTubeEmbed } from './YouTubeEmbed';

// Renders a sanitized editor document as React elements (no raw HTML). Used by the public article page
// and the Newsroom preview. Read more cards resolve through `links`; a card whose
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
                {item.credit && <span className={styles.credit}>{creditLine(item.credit)}</span>}
              </figcaption>
            )}
          </figure>
        );
      }
      case 'chart':
        return <ChartFigure key={index} chart={block.attrs} />;
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

/** `inserts` adds content (in-article ads) after the top-level block with that index. */
export function ArticleBody({
  doc,
  links,
  media,
  inserts,
}: {
  doc: Doc;
  links?: ArticleLinks;
  media?: ArticleMedia;
  inserts?: Map<number, ReactNode>;
}) {
  const nodes = blocks(doc.content, links, media);
  return (
    <div className={styles.body}>
      {inserts?.size
        ? nodes.flatMap((node, index) => (inserts.has(index) ? [node, <Fragment key={`insert-${index}`}>{inserts.get(index)}</Fragment>] : [node]))
        : nodes}
    </div>
  );
}
