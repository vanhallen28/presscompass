import { describe, expect, it } from 'vitest';
import { chartScale, chartTable, cleanChart, formatChartNumber, parseCell, parseChartTable } from '@/lib/doc/chart';
import { sanitizeDoc } from '@/lib/doc/sanitize';

describe('parseChartTable', () => {
  it('reads a table pasted from a spreadsheet', () => {
    const text = 'Month\tFood inflation\nMay\t4.1%\nJun\t3.8\nJul\t−0.5\nAug\t\n';
    expect(parseChartTable(text, 'bar')).toEqual({
      axis: 'Month',
      labels: ['May', 'Jun', 'Jul', 'Aug'],
      series: [{ name: 'Food inflation', values: [4.1, 3.8, -0.5, null] }],
    });
  });

  it('reads comma-separated text and names unnamed columns', () => {
    expect(parseChartTable('Week,Retail,\nW1,100,100\nW2,99,96', 'line')).toEqual({
      axis: 'Week',
      labels: ['W1', 'W2'],
      series: [
        { name: 'Retail', values: [100, 99] },
        { name: 'Series 2', values: [100, 96] },
      ],
    });
  });

  it('explains what is wrong with the data', () => {
    expect(parseChartTable('Month\tValue\nMay\t4', 'bar')).toEqual({
      error: 'Paste a header row and at least two rows of data: labels in the first column, numbers in the next.',
    });
    expect(parseChartTable('M\tA\tB\tC\nx\t1\t2\t3\ny\t1\t2\t3', 'bar')).toEqual({ error: 'A bar chart takes one or two columns of numbers.' });
    expect(parseChartTable('M\tA\tB\tC\tD\nx\t1\t2\t3\t4\ny\t1\t2\t3\t4', 'line')).toEqual({ error: 'A line chart takes one to three columns of numbers.' });
    expect(parseChartTable('M\tA\nx\t1\ny\tlots', 'bar')).toEqual({ error: 'Row 3: "lots" is not a number.' });
    expect(parseChartTable('M\tA\nx\t1\n\t2', 'bar')).toEqual({ error: 'Row 3 needs a label in the first column.' });
    expect(parseChartTable('M\tA\nx\t\ny\t-', 'bar')).toEqual({ error: 'Each column of numbers needs at least one value.' });
    expect(parseChartTable(['M\tA', ...Array.from({ length: 25 }, (_, i) => `r${i}\t${i}`)].join('\n'), 'bar')).toEqual({
      error: 'Use at most 24 rows of data.',
    });
  });

  it('round-trips through the editing table', () => {
    const parsed = parseChartTable('Week\tRetail\tFarm\nW1\t100\t100\nW2\t99\t', 'line');
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(chartTable(parsed)).toBe('Week\tRetail\tFarm\nW1\t100\t100\nW2\t99\t');
    expect(parseChartTable(chartTable(parsed), 'line')).toEqual(parsed);
  });
});

describe('chart numbers', () => {
  it('parses cells and keeps thousands separators only in tab-separated tables', () => {
    expect(parseCell('12,400', true)).toBe(12400);
    expect(parseCell(' 2.5 % ', false)).toBe(2.5);
    expect(parseCell('–', false)).toBeNull();
    expect(parseCell('1e5', false)).toBeUndefined();
    expect(formatChartNumber(-2)).toBe('−2');
    expect(formatChartNumber(12400.5)).toBe('12,400.5');
  });

  it('picks round axis steps that include zero', () => {
    expect(chartScale([4.1, 3.8, 2.1])).toEqual({ min: 0, max: 6, ticks: [0, 2, 4, 6] });
    expect(chartScale([88, 105])).toEqual({ min: 0, max: 150, ticks: [0, 50, 100, 150] });
    expect(chartScale([-3, 2])).toEqual({ min: -4, max: 2, ticks: [-4, -2, 0, 2] });
    expect(chartScale([0])).toEqual({ min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] });
    expect(chartScale([88, 92, 99], { zero: false })).toEqual({ min: 85, max: 100, ticks: [85, 90, 95, 100] });
  });
});

describe('chart blocks in the body', () => {
  it('keeps valid charts and drops ones without data', () => {
    const chart = { kind: 'line', title: ' Prices ', subtitle: 'Index', source: 'BPS', axis: 'Week', labels: ['W1', 'W2'], series: [{ name: 'Retail', values: [100, '99'] }], extra: 1 };
    expect(sanitizeDoc({ type: 'doc', content: [{ type: 'chart', attrs: chart }, { type: 'chart', attrs: { labels: ['a'] } }] }).content).toEqual([
      { type: 'chart', attrs: { kind: 'line', title: 'Prices', subtitle: 'Index', source: 'BPS', axis: 'Week', labels: ['W1', 'W2'], series: [{ name: 'Retail', values: [100, null] }] } },
    ]);
    expect(cleanChart({ kind: 'bar', labels: ['a', 'b'], series: [{ name: 'x', values: [null, null] }] })).toBeNull();
    expect(cleanChart({ kind: 'bar', labels: ['a', 'b'], series: [1, 2, 3].map((n) => ({ name: `s${n}`, values: [n, n] })) })?.series).toHaveLength(2);
  });
});
