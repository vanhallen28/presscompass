// Outline icons on a 24-unit grid with a 1.5 stroke (design system: Iconography).
const ICONS = {
  alert: 'M12 7.5v5.5M12 16.2v.3M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  archive: 'M4 5h16v4H4zM5.5 9v10h13V9M10 13h4',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7v5l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  dots: 'M4 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0M11 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0M18 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  folder: 'M3 6h6l2 2h10v11H3z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  heading: 'M6 4v16M18 4v16M6 12h12',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  image: 'M3 5h18v14H3zM7.5 10a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M21 16l-5-5-8 8',
  info: 'M12 11v6M12 7.5v.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
  italic: 'M10 5h8M6 19h8M14 5l-4 14',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  'list-ordered': 'M10 6h10M10 12h10M10 18h10M4 4h1.5v4M3.5 8h3M3.5 14h3l-3 4h3',
  'log-out': 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  menu: 'M4 7h16M4 12h16M4 17h16',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  quote: 'M5 17c2-1 3-3 3-6V7H4v5h4M15 17c2-1 3-3 3-6V7h-4v5h4',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  search: 'M4 11a7 7 0 1 0 14 0 7 7 0 0 0-14 0M20 20l-4-4',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0M8 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
  tag: 'M3.5 3.5H11l9.5 9.5-7.5 7.5-9.5-9.5zM8 8h.01',
  trend: 'M4 20h16M4 16l5-5 4 3 7-7M16 7h4v4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  undo: 'M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3',
  users: 'M5.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 3 3 6',
  video: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
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
