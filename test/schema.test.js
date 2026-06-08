import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSchemas, validateEvent } from '../src/engine/schema.js';

const ruleSet = {
  eventTypes: {
    addToCart: {
      schema: {
        type: 'object',
        required: ['products', 'cc'],
        properties: {
          cc: { enum: ['USD', 'EUR', 'GBP'] },
          products: { type: 'string', minLength: 1 }
        }
      }
    }
  }
};

const validators = compileSchemas(ruleSet);
const event = (params) => ({ index: 3, requestId: '7f3a', params });

test('a satisfying event yields no violations', () => {
  const v = validateEvent(event({ products: ';Widget;1;9.99', cc: 'USD' }), 'addToCart', validators);
  assert.deepEqual(v, []);
});

test('a missing required field becomes a schema violation naming the field', () => {
  const v = validateEvent(event({ products: ';Widget;1;9.99' }), 'addToCart', validators);
  assert.equal(v.length, 1);
  assert.equal(v[0].code, 'schema');
  assert.equal(v[0].field, 'cc');
  assert.equal(v[0].beacon, 3);
  assert.equal(v[0].requestId, '7f3a');
  assert.equal(v[0].eventType, 'addToCart');
  assert.match(v[0].message, /required field missing: "cc"/);
});

test('an out-of-enum value becomes a violation with allowed values and actual', () => {
  const v = validateEvent(event({ products: ';Widget;1;9.99', cc: 'JPY' }), 'addToCart', validators);
  const enumV = v.find((x) => x.field === 'cc');
  assert.ok(enumV);
  assert.deepEqual(enumV.expected, ['USD', 'EUR', 'GBP']);
  assert.equal(enumV.actual, 'JPY');
});

test('an empty string fails minLength with a "must not be empty" message', () => {
  const v = validateEvent(event({ products: '', cc: 'USD' }), 'addToCart', validators);
  const emptyV = v.find((x) => x.field === 'products');
  assert.ok(emptyV);
  assert.match(emptyV.message, /must not be empty/);
  assert.equal(emptyV.actual, '');
});

test('allErrors collects multiple violations at once', () => {
  const v = validateEvent(event({}), 'addToCart', validators);
  const fields = v.map((x) => x.field).sort();
  assert.deepEqual(fields, ['cc', 'products']);
});

test('compileSchemas throws a clear error on an invalid JSON Schema', () => {
  assert.throws(
    () => compileSchemas({ eventTypes: { bad: { schema: { type: 'not-a-type' } } } }),
    /Invalid JSON Schema for event type "bad"/
  );
});
