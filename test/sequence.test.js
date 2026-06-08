import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSequence } from '../src/engine/sequence.js';

// Build a classified capture from a list of type ids (null = unclassified).
const capture = (...types) => types.map((type, index) => ({ event: { index, requestId: `r${index}` }, type }));

test('precedes passes when before appears earlier', () => {
  const classified = capture('addToCart', 'purchase');
  const rs = { sequence: [{ rule: 'precedes', before: 'addToCart', after: 'purchase' }] };
  assert.deepEqual(evaluateSequence(classified, rs), []);
});

test('precedes fails when after appears with no prior before', () => {
  const classified = capture('purchase', 'addToCart');
  const rs = { sequence: [{ rule: 'precedes', before: 'addToCart', after: 'purchase' }] };
  const v = evaluateSequence(classified, rs);
  assert.equal(v.length, 1);
  assert.equal(v[0].code, 'precedes');
  assert.equal(v[0].beacon, 0);
});

test('precedes flags every unpreceded after', () => {
  const classified = capture('purchase', 'purchase', 'addToCart', 'purchase');
  const rs = { sequence: [{ rule: 'precedes', before: 'addToCart', after: 'purchase' }] };
  const v = evaluateSequence(classified, rs);
  assert.equal(v.length, 2); // the first two purchases; the last is preceded
  assert.deepEqual(v.map((x) => x.beacon), [0, 1]);
});

test('precedes uses a custom message when provided', () => {
  const classified = capture('purchase');
  const rs = { sequence: [{ rule: 'precedes', before: 'addToCart', after: 'purchase', message: 'custom!' }] };
  assert.equal(evaluateSequence(classified, rs)[0].message, 'custom!');
});

test('count exactly', () => {
  const rs = { sequence: [{ rule: 'count', event: 'purchase', exactly: 1 }] };
  assert.deepEqual(evaluateSequence(capture('purchase'), rs), []);
  const v = evaluateSequence(capture('purchase', 'purchase'), rs);
  assert.equal(v.length, 1);
  assert.equal(v[0].actual, 2);
  assert.match(v[0].message, /exactly 1/);
});

test('count max', () => {
  const rs = { sequence: [{ rule: 'count', event: 'purchase', max: 1 }] };
  assert.deepEqual(evaluateSequence(capture('purchase'), rs), []);
  assert.equal(evaluateSequence(capture('purchase', 'purchase'), rs).length, 1);
});

test('count min', () => {
  const rs = { sequence: [{ rule: 'count', event: 'addToCart', min: 1 }] };
  assert.equal(evaluateSequence(capture('purchase'), rs).length, 1);
  assert.deepEqual(evaluateSequence(capture('addToCart'), rs), []);
});

test('count min+max expresses a range', () => {
  const rs = { sequence: [{ rule: 'count', event: 'x', min: 1, max: 2 }] };
  assert.equal(evaluateSequence(capture(), rs).length, 1); // 0 < min
  assert.deepEqual(evaluateSequence(capture('x'), rs), []);
  assert.deepEqual(evaluateSequence(capture('x', 'x'), rs), []);
  assert.equal(evaluateSequence(capture('x', 'x', 'x'), rs).length, 1); // 3 > max
});

test('no sequence array yields no violations', () => {
  assert.deepEqual(evaluateSequence(capture('purchase'), {}), []);
});
