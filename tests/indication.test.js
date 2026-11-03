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
