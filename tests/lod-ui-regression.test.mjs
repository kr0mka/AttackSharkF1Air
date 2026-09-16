import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/f1-lod-ui.js', import.meta.url), 'utf8');

test('LOD UI observer watches only top-level content replacement', () => {
  assert.match(source, /observe\(content,\s*\{\s*childList:\s*true\s*\}\)/);
  assert.doesNotMatch(source, /subtree:\s*true/);
});

test('LOD text mutations are idempotent', () => {
  assert.match(source, /title\.textContent\s*!==\s*TITLE/);
  assert.match(source, /copy\.textContent\s*!==\s*COPY/);
});
