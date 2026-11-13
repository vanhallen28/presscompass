import { type ChartAttrs, chartScale, formatChartNumber } from '@/lib/doc/chart';
import styles from './article.module.css';

// Draws a chart block as SVG on the server (no chart library, no client JavaScript). The drawing is hidden
// from screen readers; a visually hidden table carries the same numbers.

const WIDTH = 640;
const MAX_X_LABELS = 12;
const SERIES = ['one', 'two', 'three'] as const;

function xLabelShown(index: number, count: number) {
  if (count <= MAX_X_LABELS) return true;
  const every = Math.ceil(count / MAX_X_LABELS);
  return index % every === 0 || index === count - 1;
}

/** Moves end labels apart so they do not overlap (at least `gap` px between baselines). */
function spread(ys: number[], gap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const overflow = (order.at(-1)?.y ?? 0) - bottom;
  if (overflow > 0) for (const item of order) item.y -= overflow;
  for (const item of order) item.y = Math.max(item.y, top);
  const out = [...ys];
  for (const item of order) out[item.i] = item.y;
  return out;
}

export function ChartFigure({ chart }: { chart: ChartAttrs }) {
  const { kind, labels, series } = chart;
  const isBar = kind === 'bar';
  const height = isBar ? 260 : 300;
  const plot = { left: 44, right: WIDTH - (isBar ? 8 : 104), top: 24, bottom: height - 34 };
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const scale = chartScale(values, { zero: isBar });
  const y = (value: number) => plot.bottom - ((value - scale.min) / (scale.max - scale.min)) * (plot.bottom - plot.top);
  const count = labels.length;
  const band = (plot.right - plot.left) / count;
  const xOf = (i: number) => (isBar ? plot.left + band * (i + 0.5) : plot.left + (count === 1 ? 0 : (i * (plot.right - plot.left)) / (count - 1)));
  const base = y(Math.min(Math.max(0, scale.min), scale.max));

  const ends = isBar
    ? []
    : series.map((s, j) => {
        const last = s.values.findLastIndex((v) => v !== null);
        return { j, x: xOf(last), y: y(s.values[last] as number), text: `${s.name} ${formatChartNumber(s.values[last] as number)}` };
      });
  const endYs = spread(
    ends.map((end) => end.y + 4),
    16,
    plot.top,
    plot.bottom + 4,
  );

  return (
    <figure className={styles.chart}>
      {chart.title && <p className={styles.chartTitle}>{chart.title}</p>}
      {chart.subtitle && <p className={styles.chartSub}>{chart.subtitle}</p>}
      {isBar && series.length > 1 && (
        <ul className={styles.legend} aria-hidden="true">
          {series.map((s, j) => (
            <li key={j}>
              <span className={`${styles.swatch} ${styles[SERIES[j]]}`} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <svg viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden="true" focusable="false">
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} />
            <text className={styles.axis} x={0} y={y(tick) + 4}>
              {formatChartNumber(tick)}
            </text>
          </g>
        ))}
        {isBar &&
          series.map((s, j) => {
            const group = band * 0.64;
            const width = group / series.length;
            return s.values.map((value, i) => {
              if (value === null) return null;
              const x = plot.left + band * i + (band - group) / 2 + width * j;
              const top = Math.min(y(value), base);
              const highlight = series.length === 1 && i === count - 1;
              return (
                <g key={`${j}-${i}`}>
                  <rect className={`${styles.bar} ${styles[SERIES[highlight ? 1 : j]]}`} x={x} y={top} width={width} height={Math.max(Math.abs(base - y(value)), 1)} />
                  {series.length === 1 && count <= MAX_X_LABELS && (
                    <text className={styles.value} x={x + width / 2} y={value >= 0 ? y(value) - 7 : y(value) + 15} textAnchor="middle">
                      {formatChartNumber(value)}
                    </text>
                  )}
                </g>
              );
            });
          })}
        {!isBar &&
          series.map((s, j) => {
            const segments: string[][] = [[]];
            s.values.forEach((value, i) => {
              if (value === null) segments.push([]);
              else segments.at(-1)?.push(`${xOf(i).toFixed(1)},${y(value).toFixed(1)}`);
            });
            return segments
              .filter((points) => points.length)
              .map((points, k) =>
                points.length === 1 ? (
                  <circle key={`${j}-${k}`} className={`${styles.dot} ${styles[SERIES[j]]}`} cx={points[0].split(',')[0]} cy={points[0].split(',')[1]} r={3} />
                ) : (
                  <polyline key={`${j}-${k}`} className={`${styles.line} ${styles[SERIES[j]]}`} points={points.join(' ')} />
                ),
              );
          })}
        <line className={styles.base} x1={plot.left} x2={plot.right} y1={base} y2={base} />
        {ends.map((end, k) => (
          <text key={end.j} className={`${styles.endLabel} ${styles[SERIES[end.j]]}`} x={end.x + 8} y={endYs[k]}>
            {end.text}
          </text>
        ))}
        {labels.map((label, i) =>
          xLabelShown(i, count) ? (
            <text key={i} className={styles.axis} x={xOf(i)} y={height - 10} textAnchor="middle">
              {label}
            </text>
          ) : null,
        )}
      </svg>
      {/* A table ignores the 1px width of .sr-only and would widen the page, so the wrapper is hidden instead. */}
      <div className="sr-only">
        <table>
          <caption>{[chart.title, chart.subtitle].filter(Boolean).join('. ') || 'Chart data'}</caption>
          <thead>
            <tr>
              <th scope="col">{chart.axis || 'Label'}</th>
              {series.map((s, j) => (
                <th key={j} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={i}>
                <th scope="row">{label}</th>
                {series.map((s, j) => (
                  <td key={j}>{s.values[i] === null ? 'No data' : formatChartNumber(s.values[i] as number)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chart.source && <figcaption className={styles.source}>Source: {chart.source}</figcaption>}
    </figure>
  );
}
