import test from 'node:test';
import assert from 'node:assert/strict';
import { graph } from '../src/data/diagnostics.js';
import { labels } from '../src/data/panel.js';
import { getIndicationContext, getAnswerPreview } from '../src/data/indication.js';

test('Every question has an explicit focus description using real indicators', () => {
  for (const [id, node] of Object.entries(graph)) {
    if (node.type !== 'question') continue;
    const context = getIndicationContext(id);
    assert.ok(context.note.length > 0, `${id} lacks a note`);
    assert.equal(new Set(context.focusIndicators).size, context.focusIndicators.length);
    assert.ok(context.focusIndicators.every(label => labels.includes(label)), `${id} contains a nonexistent lamp`);
  }
  const lp = getIndicationContext('lp');
  assert.ok(lp.focusIndicators.includes('ВКЛ. ЛГ'));
  assert.ok(lp.focusIndicators.includes('ИНТЕР. ТС'));
  for (let n = 1; n <= 8; n++) assert.ok(lp.focusIndicators.includes(`Г${n}`));
  assert.deepEqual(getIndicationContext('start').focusIndicators, []);
});

test('Generator answer previews exactly the documented example and explains its limits', () => {
  const preview = getAnswerPreview('lp', 'lp-generator');
  assert.equal(preview.available, true);
  assert.deepEqual(preview.scenario, { 'ВКЛ. ЛГ': 'on', 'Г1': 'on', 'Г2': 'on' });
  assert.deepEqual(preview.focusIndicators, ['ВКЛ. ЛГ', 'Г1', 'Г2']);
  assert.match(preview.note, /только как пример/);
});

test('Normal indication does not invent an all-off or blinking reference pattern', () => {
  for (const [from, next] of [['lp', 'lp-normal'], ['ts', 'ts-active'], ['ts', 'ts-passive']]) {
    const preview = getAnswerPreview(from, next);
    assert.deepEqual(preview.scenario, {});
    assert.match(preview.note, /Эталон нормальной индикации в исходнике не задан/);
    assert.ok(preview.focusIndicators.length > 0);
  }
});

test('Reception states override their parent and no invalid transition produces a preview', () => {
  assert.deepEqual(getAnswerPreview('tu', 'tu-tr').scenario, { 'ПР ТУ': 'off' });
  assert.deepEqual(getAnswerPreview('tu-tr', 'tu-tr-good').scenario, { 'ПР ТУ': 'off' });
  assert.deepEqual(getAnswerPreview('tu', 'tu-st').scenario, { 'ПР ТУ': 'on' });
  const invalid = getAnswerPreview('tu', 'lp-generator');
  assert.equal(invalid.available, false);
  assert.deepEqual(invalid.scenario, {});
});

test('Measurements, physical relays and optocouplers do not acquire fictional lamps', () => {
  for (const [from, next] of [['both', 'both-power'], ['rack', 'rack-air'], ['rack', 'rack-cs'], ['ts', 'ts-opto']]) {
    const preview = getAnswerPreview(from, next);
    assert.equal(preview.available, false);
    assert.deepEqual(preview.focusIndicators, []);
    assert.deepEqual(preview.scenario, {});
  }
});

test('All actual answer previews reference only real panel labels', () => {
  for (const [id, node] of Object.entries(graph)) {
    for (const option of node.options ?? []) {
      const preview = getAnswerPreview(id, option.next);
      assert.ok(preview.focusIndicators.every(label => labels.includes(label)));
      assert.ok(Object.keys(preview.scenario).every(label => labels.includes(label)));
      assert.equal(typeof preview.available, 'boolean');
    }
  }
});

test('Missing and extra groups provide locations without pretending to show an indication pattern', () => {
  const expectedGroups = labels.filter(label => /^ГР\d+$/.test(label));
  for (const next of ['groups-missing', 'groups-extra']) {
    const preview = getAnswerPreview('groups', next);
    assert.equal(preview.kind, 'location', next);
    assert.equal(preview.available, true, 'A location remains useful even without a state pattern');
    assert.deepEqual(preview.scenario, {}, 'Missing source data must not become an all-off pattern');
    assert.deepEqual(preview.focusIndicators, expectedGroups);
  }
});

test('Normal indication is classified as location because its reference pattern is undocumented', () => {
  for (const [from, next] of [['lp', 'lp-normal'], ['ts', 'ts-active'], ['ts', 'ts-passive']]) {
    const preview = getAnswerPreview(from, next);
    assert.equal(preview.kind, 'location', next);
    assert.deepEqual(preview.scenario, {});
    assert.match(preview.note, /Эталон нормальной индикации в исходнике не задан/);
  }
});

test('An explicitly off lamp is a real pattern despite having zero active lamps', () => {
  for (const [from, next, lamp] of [['tu', 'tu-tr', 'ПР ТУ'], ['cs', 'cs-result', 'ПР ЦС']]) {
    const preview = getAnswerPreview(from, next);
    assert.equal(preview.kind, 'pattern', next);
    assert.equal(preview.available, true);
    assert.deepEqual(preview.scenario, { [lamp]: 'off' });
    assert.equal(Object.keys(preview.scenario).length, 1, 'One state is specified');
    assert.equal(Object.values(preview.scenario).filter(state => state !== 'off').length, 0);
    assert.ok(preview.focusIndicators.includes(lamp));
  }
});

test('Choosing a symptom only locates relevant indicators before any observation is selected', () => {
  for (const option of graph.start.options) {
    const preview = getAnswerPreview('start', option.next);
    assert.equal(preview.kind, 'location', `Initial category ${option.next} must not assert a lamp state`);
    assert.deepEqual(preview.scenario, {}, option.next);
    assert.ok(preview.focusIndicators.length > 0, option.next);
  }
  // These category nodes currently carry illustrative panel defaults; those
  // defaults are not observations that the user has already confirmed.
  for (const next of ['both', 'cs', 'tu']) {
    assert.ok(Object.keys(graph[next].panel).length > 0);
    assert.deepEqual(getAnswerPreview('start', next).scenario, {});
  }
});

test('A child without its own pattern does not acquire the previous answer pattern', () => {
  const original = graph['tu-tr-good'];
  try {
    // Model a source row that describes an outcome but supplies no lamp state.
    graph['tu-tr-good'] = { ...original, panel: {} };
    const preview = getAnswerPreview('tu-tr', 'tu-tr-good');
    assert.deepEqual(graph['tu-tr'].panel, { 'ПР ТУ': 'off' });
    assert.equal(preview.kind, 'location');
    assert.deepEqual(preview.scenario, {}, 'The ancestor state cannot establish a pattern for this answer');
    assert.ok(preview.focusIndicators.length > 0);
  } finally {
    graph['tu-tr-good'] = original;
  }
});

test('Unknown nodes and disconnected transitions are classified as none', () => {
  for (const [from, next] of [['missing-node', 'tu-st'], ['tu', 'missing-node'], ['tu', 'lp-generator'], ['tu-st', 'tu-tr']]) {
    const preview = getAnswerPreview(from, next);
    assert.equal(preview.kind, 'none', `${from} → ${next}`);
    assert.equal(preview.available, false);
    assert.deepEqual(preview.scenario, {});
    assert.deepEqual(preview.focusIndicators, []);
  }
});

test('All known answer classifications agree with the documented pattern/location/none map', () => {
  const expected = {
    pattern: [
      'lp-generator', 'lp-interval', 'lp-periodic',
      'ts-switch', 'ts-fast', 'ts-interference',
      'both-air', 'air-periodic', 'air-drops', 'air-stays', 'both-general',
      'cs-result', 'tu-tr', 'tu-st', 'tu-address', 'tu-tr-bad', 'tu-tr-good',
      'commands-rt',
    ],
    location: [
      'lp', 'ts', 'groups', 'both', 'cs', 'tu', 'commands', 'rack',
      'lp-normal', 'lp-stopped', 'lp-if', 'lp-no-signal',
      'ts-active', 'ts-passive', 'groups-missing', 'groups-extra', 'rack-tr',
    ],
    none: ['both-power', 'rack-air', 'rack-cs', 'ts-opto'],
  };
  const expectedByTarget = new Map(Object.entries(expected).flatMap(([kind, ids]) => ids.map(id => [id, kind])));
  assert.equal(expectedByTarget.size, Object.keys(graph).length - 1, 'Each non-root node needs a reviewed classification');
  for (const [from, node] of Object.entries(graph)) {
    for (const option of node.options ?? []) {
      const preview = getAnswerPreview(from, option.next);
      const kind = expectedByTarget.get(option.next);
      assert.ok(kind, `Review the new answer ${option.next}`);
      assert.equal(preview.kind, kind, `${from} → ${option.next}`);
      assert.equal(preview.available, kind !== 'none');
      assert.equal(Object.keys(preview.scenario).length > 0, kind === 'pattern');
      assert.equal(preview.focusIndicators.length > 0, kind !== 'none');
      assert.ok(Object.values(preview.scenario).every(state => ['off', 'on', 'blink', 'fast'].includes(state)));
      assert.ok(Object.keys(preview.scenario).every(label => preview.focusIndicators.includes(label)));
    }
  }
});
