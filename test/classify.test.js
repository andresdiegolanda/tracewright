import test from 'node:test';
import assert from 'node:assert/strict';
import { matches, classify } from '../src/engine/classify.js';

const params = { events: 'scAdd,event1', cc: 'USD', pageName: 'product:widget' };

test('equals predicate', () => {
  assert.equal(matches(params, { param: 'cc', equals: 'USD' }), true);
  assert.equal(matches(params, { param: 'cc', equals: 'EUR' }), false);
});

test('contains predicate (substring)', () => {
  assert.equal(matches(params, { param: 'events', contains: 'scAdd' }), true);
  assert.equal(matches(params, { param: 'events', contains: 'purchase' }), false);
  assert.equal(matches(params, { param: 'pageName', contains: 'product:' }), true);
});

test('matches predicate (regex)', () => {
  assert.equal(matches(params, { param: 'pageName', matches: '^product:' }), true);
  assert.equal(matches(params, { param: 'pageName', matches: '^home$' }), false);
});

test('matches predicate throws a clear error on an invalid pattern', () => {
  assert.throws(() => matches(params, { param: 'pageName', matches: '(' }), /Invalid 'matches' pattern/);
});

test('exists predicate', () => {
  assert.equal(matches(params, { param: 'cc', exists: true }), true);
  assert.equal(matches(params, { param: 'cc', exists: false }), false);
  assert.equal(matches(params, { param: 'v1', exists: true }), false);
  assert.equal(matches(params, { param: 'v1', exists: false }), true);
});

test('a predicate on an absent param is false (except exists:false)', () => {
  assert.equal(matches(params, { param: 'v1', equals: 'x' }), false);
  assert.equal(matches(params, { param: 'v1', contains: 'x' }), false);
});

test('all composite', () => {
  assert.equal(matches(params, { all: [{ param: 'events', contains: 'scAdd' }, { param: 'cc', equals: 'USD' }] }), true);
  assert.equal(matches(params, { all: [{ param: 'events', contains: 'scAdd' }, { param: 'cc', equals: 'EUR' }] }), false);
});

test('any composite', () => {
  assert.equal(matches(params, { any: [{ param: 'cc', equals: 'EUR' }, { param: 'events', contains: 'scAdd' }] }), true);
  assert.equal(matches(params, { any: [{ param: 'cc', equals: 'EUR' }, { param: 'events', contains: 'nope' }] }), false);
});

test('not composite', () => {
  assert.equal(matches(params, { not: { param: 'cc', equals: 'EUR' } }), true);
  assert.equal(matches(params, { not: { param: 'cc', equals: 'USD' } }), false);
});

test('nested composition', () => {
  const matcher = { all: [{ param: 'events', contains: 'scAdd' }, { any: [{ param: 'cc', exists: true }, { param: 'v1', exists: true }] }] };
  assert.equal(matches(params, matcher), true);
});

test('classify returns matching type ids', () => {
  const ruleSet = {
    eventTypes: {
      addToCart: { identify: { param: 'events', contains: 'scAdd' } },
      purchase: { identify: { param: 'events', contains: 'purchase' } }
    }
  };
  assert.deepEqual(classify({ params }, ruleSet), ['addToCart']);
  assert.deepEqual(classify({ params: { events: 'purchase' } }, ruleSet), ['purchase']);
  assert.deepEqual(classify({ params: { events: 'prodView' } }, ruleSet), []);
});

test('classify reports ambiguous matches (multiple hits)', () => {
  const ruleSet = {
    eventTypes: {
      a: { identify: { param: 'events', contains: 'scAdd' } },
      b: { identify: { param: 'cc', equals: 'USD' } }
    }
  };
  assert.deepEqual(classify({ params }, ruleSet), ['a', 'b']);
});
