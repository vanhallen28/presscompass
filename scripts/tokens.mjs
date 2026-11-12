// Builds src/styles/tokens.css from src/styles/tokens.json (the PressCompass design system tokens).
// Run with `npm run tokens` after changing tokens.json. tests/unit/tokens.test.ts fails when the CSS is stale.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// next/font/local exposes each self-hosted family as a CSS variable (src/app/fonts.ts).
const FONT_VARIABLES = {
  serif: '--font-newsreader',
  sans: '--font-plex-sans',
  mono: '--font-plex-mono',
};

function valueFor(value, theme, firstTheme) {
  const raw = typeof value === 'string' ? value : (value[theme] ?? value[firstTheme]);
  const alias = /^\{(.+)\}$/.exec(raw);
  return alias ? `var(--${alias[1]})` : raw;
}

function themeDeclarations(tokens, theme, firstTheme, indent) {
  return [...tokens.color.tokens, ...tokens.shadow.tokens]
    .map((t) => `${indent}--${t.name}: ${valueFor(t.value, theme, firstTheme)};`)
    .join('\n');
}

export function buildTokensCss(tokens) {
  const themes = tokens.color.themes.map((t) => t.id);
  const [first] = themes;
  const out = ['/* PressCompass: generated from tokens.json by scripts/tokens.mjs. Do not edit by hand. */', ''];

  out.push(`:root,\n[data-theme="${first}"] {\n  color-scheme: ${first};\n${themeDeclarations(tokens, first, first, '  ')}\n}`, '');
  for (const theme of themes.slice(1)) {
    out.push(`[data-theme="${theme}"] {\n  color-scheme: ${theme};\n${themeDeclarations(tokens, theme, first, '  ')}\n}`, '');
    out.push(
      `@media (prefers-color-scheme: ${theme}) {\n  :root:not([data-theme]) {\n    color-scheme: ${theme};\n${themeDeclarations(tokens, theme, first, '    ')}\n  }\n}`,
      '',
    );
  }

  const root = [];
  for (const family of ['spacing', 'radius', 'layout']) {
    for (const t of tokens[family].tokens) root.push(`  --${t.name}: ${t.value};`);
  }
  for (const [key, stack] of Object.entries(tokens.type.families)) {
    const fallback = stack.split(',').slice(1).join(',').trim();
    root.push(`  --font-${key}: var(${FONT_VARIABLES[key]}), ${fallback};`);
  }
  out.push(`:root {\n${root.join('\n')}\n}`, '');

  for (const group of tokens.type.groups) {
    for (const style of group.styles) {
      const decl = [
        `font-family: var(--font-${style.family ?? group.family});`,
        `font-size: ${style.fontSize};`,
        `line-height: ${style.lineHeight};`,
        `font-weight: ${style.fontWeight};`,
      ];
      if (style.letterSpacing) decl.push(`letter-spacing: ${style.letterSpacing};`);
      if (style.fontStyle) decl.push(`font-style: ${style.fontStyle};`);
      if (style.opticalSize) decl.push(`font-variation-settings: 'opsz' ${style.opticalSize};`);
      if (style.name === 'kicker') decl.push('text-transform: uppercase;');
      out.push(`.type-${style.name} {\n${decl.map((d) => `  ${d}`).join('\n')}\n}`, '');
    }
  }
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(await readFile(new URL('../src/styles/tokens.json', import.meta.url), 'utf8'));
  await writeFile(new URL('../src/styles/tokens.css', import.meta.url), buildTokensCss(tokens));
  console.log('Updated src/styles/tokens.css');
}
