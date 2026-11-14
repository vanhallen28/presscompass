'use client';

import { type CSSProperties, type KeyboardEvent, type Ref, useId } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import styles from './editor.module.css';

// The list of blocks, shared by the + inserter and the / command (as in WordPress). Choosing one is the
// body editor's job: this only shows, filters and highlights.

export type BlockId =
  | 'paragraph'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'ordered'
  | 'quote'
  | 'pullQuote'
  | 'image'
  | 'keyFigures'
  | 'chart'
  | 'table'
  | 'editorNote'
  | 'youtube'
  | 'readMore'
  | 'divider';

export type BlockChoice = { id: BlockId; label: string; hint: string; icon?: IconName; text?: string; keywords: string };

export const BLOCKS: BlockChoice[] = [
  { id: 'paragraph', label: 'Paragraph', hint: 'Plain text.', text: '¶', keywords: 'text p' },
  { id: 'h2', label: 'Heading', hint: 'Starts a section (H2).', text: 'H2', keywords: 'heading h2 title section' },
  { id: 'h3', label: 'Subheading', hint: 'A heading inside a section (H3).', text: 'H3', keywords: 'subheading h3' },
  { id: 'bullet', label: 'Bulleted list', hint: 'Points in no particular order.', icon: 'list', keywords: 'list bullets ul' },
  { id: 'ordered', label: 'Numbered list', hint: 'Steps or a ranking.', icon: 'list-ordered', keywords: 'list numbers ol ordered' },
  { id: 'quote', label: 'Quote', hint: 'Words quoted from a person or a document.', icon: 'quote', keywords: 'quote blockquote' },
  { id: 'pullQuote', label: 'Pull quote', hint: 'A line from the text, set large.', icon: 'quote', keywords: 'pull quote highlight' },
  { id: 'image', label: 'Image', hint: 'From the media library, or upload one.', icon: 'image', keywords: 'image photo picture media' },
  { id: 'keyFigures', label: 'Key figures', hint: 'Two to four numbers with their source.', text: '12', keywords: 'figures numbers stats data' },
  { id: 'chart', label: 'Chart', hint: 'A bar or line chart from a small table.', icon: 'trend', keywords: 'chart graph bar line data' },
  { id: 'table', label: 'Table', hint: 'Rows and columns.', icon: 'table', keywords: 'table grid' },
  { id: 'editorNote', label: "Editor's note", hint: 'An update or a correction, dated.', icon: 'info', keywords: 'note update correction editor' },
  { id: 'youtube', label: 'YouTube video', hint: 'Plays only after the reader clicks.', icon: 'video', keywords: 'youtube video embed' },
  {
    id: 'readMore',
    label: 'Read more card',
    hint: 'A link to another PressCompass article.',
    icon: 'link',
    keywords: 'read more link article related',
  },
  { id: 'divider', label: 'Divider', hint: 'A line between parts of the text.', icon: 'minus', keywords: 'divider separator rule hr' },
];

export function filterBlocks(query: string): BlockChoice[] {
  const q = query.trim().toLowerCase();
  if (!q) return BLOCKS;
  return BLOCKS.filter((block) => block.label.toLowerCase().includes(q) || block.keywords.split(' ').some((word) => word.startsWith(q)));
}

/** Arrow keys, Enter and Escape for a block list. Returns true when it handled the key. */
export function blockKeys(
  key: string,
  { count, active, setActive, pick, close }: { count: number; active: number; setActive: (i: number) => void; pick: () => void; close: () => void },
): boolean {
  if (key === 'ArrowDown') setActive(count ? (active + 1) % count : 0);
  else if (key === 'ArrowUp') setActive(count ? (active - 1 + count) % count : 0);
  else if (key === 'Enter' || key === 'Tab') {
    if (!count) return false;
    pick();
  } else if (key === 'Escape') close();
  else return false;
  return true;
}

export function BlockMenu({
  ref,
  items,
  active,
  onActive,
  onPick,
  style,
  label,
  search,
}: {
  ref?: Ref<HTMLDivElement>;
  items: BlockChoice[];
  active: number;
  onActive: (index: number) => void;
  onPick: (id: BlockId) => void;
  style?: CSSProperties;
  label: string;
  /** A search box above the list (the + inserter); the / command filters by what follows the slash. */
  search?: { value: string; onChange: (value: string) => void; onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void };
}) {
  const uid = useId();
  return (
    <div ref={ref} className={styles.blockMenu} style={style} role={search ? 'dialog' : undefined} aria-label={search ? label : undefined}>
      {search && (
        <input
          className={styles.blockSearch}
          type="search"
          aria-label="Search blocks"
          placeholder="Search blocks"
          autoFocus
          value={search.value}
          aria-controls={`${uid}-list`}
          aria-activedescendant={items[active] ? `${uid}-${items[active].id}` : undefined}
          onChange={(event) => search.onChange(event.target.value)}
          onKeyDown={search.onKeyDown}
        />
      )}
      <ul id={`${uid}-list`} className={styles.blockList} role="listbox" aria-label={label}>
        {items.length === 0 && <li className={styles.blockEmpty}>No block matches.</li>}
        {items.map((item, index) => (
          <li
            key={item.id}
            id={`${uid}-${item.id}`}
            role="option"
            aria-selected={index === active}
            className={styles.blockItem}
            onMouseEnter={() => onActive(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(item.id)}
          >
            <span className={styles.blockIcon} aria-hidden="true">
              {item.icon ? <Icon name={item.icon} size={18} /> : item.text}
            </span>
            <span>
              <span className={styles.blockLabel}>{item.label}</span>
              <span className={styles.blockHint}>{item.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
