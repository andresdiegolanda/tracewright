import test from 'node:test';
import assert from 'node:assert/strict';
import { decode } from '../src/engine/decode.js';

const beacon = (params = {}) => {
  const qs = new URLSearchParams({ AQB: '1', ndh: '1', ...params, AQE: '1' });
  return `https://fictionalstore.sc.omtrdc.net/b/ss/fictionalstore-prod/1/s12345?${qs}`;
};

test('decode extracts report suites from the /b/ss/ path', () => {
  const event = decode({ url: beacon({ events: 'scAdd' }) }, 0);
  assert.deepEqual(event.reportSuites, ['fictionalstore-prod']);
  assert.equal(event.parseNotes.length, 0);
});

test('decode splits comma-separated report suites', () => {
  const url = 'https://x.sc.omtrdc.net/b/ss/rs-one,rs-two/1/s9?events=scAdd';
  assert.deepEqual(decode({ url }, 0).reportSuites, ['rs-one', 'rs-two']);
});

test('decode collects query-string params into the raw map', () => {
  const event = decode({ url: beacon({ events: 'scAdd', cc: 'USD', products: ';Widget;1;9.99' }) }, 3);
  assert.equal(event.params.events, 'scAdd');
  assert.equal(event.params.cc, 'USD');
  assert.equal(event.params.products, ';Widget;1;9.99');
  assert.equal(event.index, 3);
});

test('decode carries provenance fields through', () => {
  const event = decode({ url: beacon(), requestId: '7f3a', timestamp: '2026-06-08T12:04:51Z' }, 2);
  assert.equal(event.requestId, '7f3a');
  assert.equal(event.timestamp, '2026-06-08T12:04:51Z');
});

test('decode tolerates empty POST data (merges nothing)', () => {
  const event = decode({ url: beacon({ events: 'scAdd' }), postData: '' }, 0);
  assert.equal(event.params.events, 'scAdd');
});

test('decode merges POST body params, with POST taking precedence on collisions', () => {
  const url = beacon({ events: 'scAdd', cc: 'USD' });
  const event = decode({ url, postData: 'cc=EUR&v1=ORD-1' }, 0);
  assert.equal(event.params.cc, 'EUR'); // POST body wins (merged last)
  assert.equal(event.params.v1, 'ORD-1');
  assert.equal(event.params.events, 'scAdd');
});

test('decode flags a non-/b/ss/ URL with a parse note and empty report suites', () => {
  const event = decode({ url: 'https://cdn.example/pixel.gif?ping=1' }, 0);
  assert.deepEqual(event.reportSuites, []);
  assert.match(event.parseNotes[0], /not an Adobe \/b\/ss\/ beacon/);
});

test('decode does not throw on an unparseable URL', () => {
  const event = decode({ url: 'not a url' }, 0);
  assert.equal(event.parseNotes.length, 1);
  assert.match(event.parseNotes[0], /Unparseable/);
  assert.deepEqual(event.params, {});
});
