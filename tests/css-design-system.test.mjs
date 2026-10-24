// The stylesheet follows the design system of Rule Them'All and Forge Them'All (their tests/css-design-system rules,
// under the --htm- prefix): colors only in tokens.css, gaps of 4 / 8 / 12 px, one type scale, one rule per selector.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const paths = JSON.parse(read("module.json")).styles;
const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, "");
const bundle = strip(paths.map(read).join("\n"));

test("tokens.css comes first and declares each token once", () => {
  assert.equal(paths[0], "styles/tokens.css");
  for (const name of ["space-1", "space-2", "space-4", "space-6", "gap-tight", "gap-row", "gap-block", "type-xs", "type-sm", "type-medium", "accent"])
    assert.equal((bundle.match(new RegExp(`--htm-${name}:`, "g")) || []).length, 1, name);
  assert.match(bundle, /--htm-gap-tight:\s*var\(--htm-space-2\)/);
  assert.match(bundle, /--htm-gap-row:\s*var\(--htm-space-4\)/);
  assert.match(bundle, /--htm-gap-block:\s*var\(--htm-space-6\)/);
});

test("hard-coded colors and Foundry color variables live only in tokens.css", () => {
  for (const path of paths.filter(p => !p.endsWith("/tokens.css"))) {
    const text = strip(read(path));
    assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${path} writes a color`);
    assert.doesNotMatch(text, /var\(--color-/, `${path} reads a Foundry color instead of a --htm-color-* token`);
  }
});

test("every gap is one of the three gap tokens", () => {
  for (const [, value] of bundle.matchAll(/(?:^|[\s;{])(?:row-gap|column-gap|gap)\s*:\s*([^;}]+)/g))
    assert.match(value.trim(), /^(?:0|var\(--htm-gap-(?:tight|row|block)\))(?:\s+(?:0|var\(--htm-gap-(?:tight|row|block)\)))?$/, `gap: ${value}`);
});

test("font sizes come from the type scale", () => {
  for (const [, value] of bundle.matchAll(/font-size\s*:\s*([^;}]+)/g)) assert.match(value.trim(), /^var\(--htm-type-/, `font-size: ${value}`);
});

test("one unconditional rule per selector, no !important", () => {
  const selectors = [];
  let depth = 0, start = 0;
  for (let i = 0; i < bundle.length; i++) {
    if (bundle[i] === "{") { if (depth === 0) { const s = bundle.slice(start, i).trim(); if (!s.startsWith("@")) selectors.push(s); } depth++; }
    else if (bundle[i] === "}") { depth--; if (depth === 0) start = i + 1; }
  }
  assert.equal(depth, 0);
  assert.deepEqual(selectors.filter((s, i) => selectors.indexOf(s) < i), []);
  assert.doesNotMatch(bundle, /!important/);
});
