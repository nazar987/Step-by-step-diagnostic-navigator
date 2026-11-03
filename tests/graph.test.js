import test from 'node:test';
import assert from 'node:assert/strict';
import { graph, sources, categories, findPath, validatePath, subtreeMatches } from '../src/data/diagnostics.js';
import { labels, cycleState } from '../src/data/panel.js';

test('Every branch resolves, has no cycles, and reaches a documented result', () => {
  const visited = new Set();
  function walk(id, ancestors = []) {
    assert.ok(graph[id], `Missing node ${id}`);
    assert.ok(!ancestors.includes(id), `Cycle at ${id}`);
    const node = graph[id];
    visited.add(id);
    assert.ok(node.sourceIds.every(n => sources.some(s => s.id === n)), `Invalid source at ${id}`);
    assert.ok(Object.keys(node.panel ?? {}).every(label => labels.includes(label)), `Invalid LED at ${id}`);
    if (node.type === 'result') { assert.ok(node.causes.length); assert.ok(node.excerpt); assert.ok(node.row); }
    else { assert.ok(node.options.length); for (const o of node.options) walk(o.next, [...ancestors, id]); }
  }
  walk('start');
  assert.equal(visited.size, Object.keys(graph).length, 'Unreachable nodes');
  assert.equal(categories.length, 8);
});

test('Every result can be opened from the tree with its complete route', () => {
  for (const [id, node] of Object.entries(graph)) {
    if (node.type !== 'result') continue;
    const path = findPath(id);
    assert.equal(path[0], 'start');
    assert.equal(path.at(-1), id);
    assert.deepEqual(validatePath(path), path);
  }
  assert.equal(findPath('non-existent'), null);
});

test('Restoring stale or malformed storage cannot bypass questions', () => {
  for (const invalid of [null, {}, [], ['tu'], ['start', 'non-existent']]) assert.deepEqual(validatePath(invalid), ['start']);
  assert.deepEqual(validatePath(['start', 'tu', 'tu-tr', 'lp-normal']), ['start', 'tu', 'tu-tr']);
});

test('Search finds component identifiers inside the entire subtree', () => {
  assert.ok(subtreeMatches('tu', '8СТ'));
  assert.ok(subtreeMatches('lp', 'ЛГЛ'));
  assert.equal(subtreeMatches('groups', 'небывалыйблок'), false);
});

test('Panel has 50 unique indicators and a predictable manual cycle', () => {
  assert.equal(labels.length, 50);
  assert.equal(new Set(labels).size, 50);
  assert.equal(cycleState('off'), 'on');
  assert.equal(cycleState('on'), 'blink');
  assert.equal(cycleState('blink'), 'off');
  assert.equal(cycleState('fast'), 'off');
});
