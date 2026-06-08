import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/engine/validate.js';

const ruleSet = {
  name: 'example-ecommerce-checkout',
  eventTypes: {
    addToCart: {
      identify: { param: 'events', contains: 'scAdd' },
      schema: {
        type: 'object',
        required: ['products', 'cc'],
        properties: { cc: { enum: ['USD', 'EUR', 'GBP'] }, products: { type: 'string', minLength: 1 } }
      }
    },
    purchase: {
      identify: { param: 'events', contains: 'purchase' },
      schema: { type: 'object', required: ['products', 'cc'], properties: { products: { type: 'string', minLength: 1 } } }
    }
  },
  sequence: [
    { rule: 'precedes', before: 'addToCart', after: 'purchase', message: 'A purchase must be preceded by an add-to-cart.' },
    { rule: 'count', event: 'purchase', max: 1 }
  ]
};

const ev = (index, params, requestId = `r${index}`) => ({ index, requestId, params });

test('a clean happy-path capture has no violations', () => {
  const events = [
    ev(0, { events: 'scAdd', products: ';Widget;1;9.99', cc: 'USD' }),
    ev(1, { events: 'purchase', products: ';Widget;1;9.99', cc: 'USD' })
  ];
  const report = validate(events, ruleSet);
  assert.deepEqual(report.violations, []);
  assert.equal(report.summary.beacons, 2);
  assert.equal(report.summary.ok, 2);
  assert.equal(report.summary.unclassified, 0);
});

test('schema violations are reported per beacon', () => {
  const events = [
    ev(0, { events: 'scAdd', products: ';Widget;1;9.99', cc: 'USD' }),
    ev(1, { events: 'purchase', products: '' }) // missing cc, empty products
  ];
  const report = validate(events, ruleSet);
  const fields = report.violations.filter((v) => v.code === 'schema').map((v) => v.field).sort();
  assert.deepEqual(fields, ['cc', 'products']);
});

test('an unclassified beacon is a warning, not a failure', () => {
  const events = [
    ev(0, { events: 'scAdd', products: ';Widget;1;9.99', cc: 'USD' }),
    ev(1, { ping: '1' }) // matches no event type
  ];
  const report = validate(events, ruleSet);
  assert.equal(report.summary.unclassified, 1);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].beacon, 1);
  assert.equal(report.violations.length, 0);
  assert.equal(report.summary.ok, 1);
});

test('a sequence violation is reported (purchase with no preceding add-to-cart)', () => {
  const events = [ev(0, { events: 'purchase', products: ';Widget;1;9.99', cc: 'USD' })];
  const report = validate(events, ruleSet);
  const seq = report.violations.find((v) => v.code === 'precedes');
  assert.ok(seq);
  assert.equal(seq.beacon, 0);
  assert.match(seq.message, /add-to-cart/);
});

test('count rule flags too many purchases', () => {
  const events = [
    ev(0, { events: 'scAdd', products: ';Widget;1;9.99', cc: 'USD' }),
    ev(1, { events: 'purchase', products: ';Widget;1;9.99', cc: 'USD' }),
    ev(2, { events: 'purchase', products: ';Widget;1;9.99', cc: 'USD' })
  ];
  const report = validate(events, ruleSet);
  const c = report.violations.find((v) => v.code === 'count');
  assert.ok(c);
  assert.equal(c.actual, 2);
});

test('an ambiguous beacon (matches two types) is an authoring violation', () => {
  const ambiguous = {
    name: 'amb',
    eventTypes: {
      a: { identify: { param: 'events', contains: 'x' }, schema: { type: 'object' } },
      b: { identify: { param: 'cc', equals: 'USD' }, schema: { type: 'object' } }
    }
  };
  const report = validate([ev(0, { events: 'x', cc: 'USD' })], ambiguous);
  const amb = report.violations.find((v) => v.code === 'ambiguous');
  assert.ok(amb);
  assert.match(amb.message, /multiple event types/);
});

test('classified summary records the resolved type per beacon', () => {
  const events = [
    ev(0, { events: 'scAdd', products: ';Widget;1;9.99', cc: 'USD' }),
    ev(1, { ping: '1' })
  ];
  const report = validate(events, ruleSet);
  assert.deepEqual(report.classified, [
    { beacon: 0, requestId: 'r0', timestamp: null, type: 'addToCart' },
    { beacon: 1, requestId: 'r1', timestamp: null, type: null }
  ]);
});
