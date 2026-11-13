// Chart blocks: small bar or line charts the site draws as SVG. The editor takes the data as a table pasted
// from a spreadsheet (first row: column names; first column: labels) and stores it parsed, so the site never
// parses text. Shared by the editor dialog, the sanitizer and the renderer.

export type ChartKind = 'bar' | 'line';
export type ChartSeries = { name: string; values: (number | null)[] };
export type ChartAttrs = {
  kind: ChartKind;
  title: string;
  /** Unit and period, e.g. "Per cent, May–October 2026". */
  subtitle: string;
  source: string;
  /** Name of the label column, e.g. "Month" (read by screen readers). */
  axis: string;
  labels: string[];
  series: ChartSeries[];
};

export const CHART_LIMITS = {
  title: 120,
  subtitle: 120,
  source: 200,
  axis: 40,
  label: 24,
  seriesName: 40,
  minRows: 2,
  maxRows: 24,
  maxSeries: { bar: 2, line: 3 },
} as const;

export const EMPTY_CHART: ChartAttrs = { kind: 'bar', title: '', subtitle: '', source: '', axis: '', labels: [], series: [] };

const MINUS = /[−–]/g;

/** A number from a table cell: `4.1`, `-2`, `−2.0`, `12%`, `12,400` (tab-separated only). Empty or a dash is a gap. */
export function parseCell(cell: string, thousands: boolean): number | null | undefined {
  let value = cell.trim().replace(MINUS, '-').replace(/%$/, '').replace(/\s+/g, '');
  if (value === '' || value === '-') return null;
  if (thousands) value = value.replace(/,(?=\d{3}(\D|$))/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value)) return undefined;
  return Number(value);
}

/** Reads a pasted table. Cells are separated by tabs (copied from a spreadsheet) or, without tabs, by commas. */
export function parseChartTable(text: string, kind: ChartKind): Pick<ChartAttrs, 'axis' | 'labels' | 'series'> | { error: string } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');
  const tabbed = lines.some((line) => line.includes('\t'));
  const rows = lines.map((line) => line.split(tabbed ? '\t' : ',').map((cell) => cell.trim()));
  const [header, ...data] = rows;
  if (!header || data.length < CHART_LIMITS.minRows) {
    return { error: 'Paste a header row and at least two rows of data: labels in the first column, numbers in the next.' };
  }
  if (data.length > CHART_LIMITS.maxRows) return { error: `Use at most ${CHART_LIMITS.maxRows} rows of data.` };
  const columns = Math.max(...rows.map((row) => row.length)) - 1;
  const max = CHART_LIMITS.maxSeries[kind];
  if (columns < 1 || columns > max) {
    return { error: kind === 'bar' ? 'A bar chart takes one or two columns of numbers.' : 'A line chart takes one to three columns of numbers.' };
  }
  const labels: string[] = [];
  const series: ChartSeries[] = Array.from({ length: columns }, (_, c) => ({
    name: (header[c + 1] ?? '').slice(0, CHART_LIMITS.seriesName) || `Series ${c + 1}`,
    values: [],
  }));
  for (const [r, row] of data.entries()) {
    const label = (row[0] ?? '').slice(0, CHART_LIMITS.label);
    if (!label) return { error: `Row ${r + 2} needs a label in the first column.` };
    labels.push(label);
    for (let c = 0; c < columns; c++) {
      const value = parseCell(row[c + 1] ?? '', tabbed);
      if (value === undefined) return { error: `Row ${r + 2}: "${row[c + 1]}" is not a number.` };
      series[c].values.push(value);
    }
  }
  if (series.some((s) => s.values.every((value) => value === null))) return { error: 'Each column of numbers needs at least one value.' };
  return { axis: (header[0] ?? '').slice(0, CHART_LIMITS.axis), labels, series };
}

/** The stored data as a tab-separated table, for editing. */
export function chartTable(attrs: Pick<ChartAttrs, 'axis' | 'labels' | 'series'>): string {
  if (!attrs.labels.length) return '';
  const header = [attrs.axis || 'Label', ...attrs.series.map((s) => s.name)].join('\t');
  const rows = attrs.labels.map((label, i) => [label, ...attrs.series.map((s) => (s.values[i] === null ? '' : String(s.values[i])))].join('\t'));
  return [header, ...rows].join('\n');
}

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max).trim() : '');

/** Rebuilds chart attributes from anything; null when the data cannot make a chart. Used by the sanitizer. */
export function cleanChart(raw: Record<string, unknown>): ChartAttrs | null {
  const kind: ChartKind = raw.kind === 'line' ? 'line' : 'bar';
  const labels = Array.isArray(raw.labels) ? raw.labels.slice(0, CHART_LIMITS.maxRows).map((label) => str(label, CHART_LIMITS.label)) : [];
  if (labels.length < CHART_LIMITS.minRows || labels.some((label) => !label)) return null;
  const series = (Array.isArray(raw.series) ? raw.series : [])
    .slice(0, CHART_LIMITS.maxSeries[kind])
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s) => ({
      name: str(s.name, CHART_LIMITS.seriesName),
      values: labels.map((_, i) => {
        const value = Array.isArray(s.values) ? s.values[i] : null;
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
      }),
    }))
    .filter((s) => s.values.some((value) => value !== null));
  if (!series.length) return null;
  return {
    kind,
    title: str(raw.title, CHART_LIMITS.title),
    subtitle: str(raw.subtitle, CHART_LIMITS.subtitle),
    source: str(raw.source, CHART_LIMITS.source),
    axis: str(raw.axis, CHART_LIMITS.axis),
    labels,
    series,
  };
}

/**
 * Axis range and ticks with round steps (1, 2, 2.5, 5 × 10ⁿ). Bars always start at zero; lines may not,
 * so a change from 99 to 88 stays visible.
 */
export function chartScale(values: number[], { zero = true, targetTicks = 4 } = {}): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(...(zero ? [0] : []), ...values);
  let hi = Math.max(...(zero ? [0] : []), ...values);
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? 10 * magnitude;
  const round = (n: number) => Math.round(n * 1e9) / 1e9;
  const min = round(Math.floor(lo / step) * step);
  const max = round(Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let tick = min; tick <= max + step / 2; tick += step) ticks.push(round(tick));
  return { min, max, ticks };
}

/** `4.1`, `−2`, `12,400`: chart numbers with a true minus sign. */
export function formatChartNumber(value: number): string {
  const text = Math.abs(value).toLocaleString('en-GB', { maximumFractionDigits: 2 });
  return value < 0 ? `−${text}` : text;
}
