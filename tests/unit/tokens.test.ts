import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTokensCss } from '../../scripts/tokens.mjs';

const tokens = JSON.parse(readFileSync('src/styles/tokens.json', 'utf8'));
const css = buildTokensCss(tokens);

describe('design tokens', () => {
  it('matches the committed tokens.css (run `npm run tokens` after editing tokens.json)', () => {
    expect(readFileSync('src/styles/tokens.css', 'utf8')).toBe(css);
  });

  it('declares light values on :root and dark values for data-theme and the system preference', () => {
    const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
    expect(light).toContain('--paper: #f6f4ef;');
    expect(light).toContain('--ink: #0f1e33;');
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(dark).toContain('--paper: #0b1524;');
    expect(css).toContain('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {');
  });

  it('keeps single-value tokens the same in both themes and resolves aliases', () => {
    expect(css.match(/--compass-mark: #c8432b;/g)).toHaveLength(3);
    expect(css).toContain('--link: var(--meridian);');
  });

  it('points font families at the self-hosted next/font variables', () => {
    expect(css).toContain('--font-serif: var(--font-newsreader), Georgia, "Times New Roman", serif;');
    expect(css).toContain('--font-sans: var(--font-plex-sans), "Helvetica Neue", Arial, sans-serif;');
    expect(css).toContain('--font-mono: var(--font-plex-mono), ui-monospace, Menlo, monospace;');
  });

  it('emits a class per type style, with uppercase kickers', () => {
    expect(css).toContain(".type-display {\n  font-family: var(--font-serif);\n  font-size: 56px;");
    expect(css).toMatch(/\.type-kicker \{[^}]*text-transform: uppercase;/);
    expect(css).toMatch(/\.type-quote \{[^}]*font-style: italic;/);
  });
});
