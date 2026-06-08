/**
 * validate.js — orchestrate classify → schema → sequence into one Report.
 *
 * Pure: (events, ruleSet) -> Report. No IO, no throwing on violations. The only way this
 * throws is an authoring error surfaced by schema compilation (an invalid per-event schema)
 * or an invalid `matches` pattern during classification.
 *
 * Report shape:
 *   {
 *     ruleSet: string,
 *     summary: { beacons, ok, unclassified, violations },
 *     classified: Array<{ beacon, requestId, timestamp, type }>,
 *     warnings:   Array<{ code:'unclassified', beacon, requestId, message }>,
 *     violations: Array<Violation>   // schema | precedes | count | ambiguous
 *   }
 */

import { classify } from './classify.js';
import { compileSchemas, validateEvent } from './schema.js';
import { evaluateSequence } from './sequence.js';

/**
 * @param {Array<{index:number, requestId?:string|null, params:Record<string,string>}>} events
 * @param {object} ruleSet  a loaded, meta-validated rule set
 * @returns {object} Report
 */
export function validate(events, ruleSet) {
  const validators = compileSchemas(ruleSet);
  const violations = [];
  const warnings = [];
  const classified = [];

  for (const event of events) {
    const hits = classify(event, ruleSet);

    if (hits.length === 0) {
      warnings.push({
        code: 'unclassified',
        beacon: event.index,
        requestId: event.requestId ?? null,
        message: 'no matching event type'
      });
      classified.push({ event, type: null });
      continue;
    }

    if (hits.length > 1) {
      // An event matching two types is a rule-set authoring error, not a data problem.
      violations.push({
        code: 'ambiguous',
        beacon: event.index,
        requestId: event.requestId ?? null,
        eventType: hits.join(', '),
        field: null,
        message: `beacon matches multiple event types: ${hits.join(', ')}`,
        expected: 'exactly one matching event type',
        actual: hits
      });
      classified.push({ event, type: null });
      continue;
    }

    const type = hits[0];
    classified.push({ event, type });
    violations.push(...validateEvent(event, type, validators));
  }

  violations.push(...evaluateSequence(classified, ruleSet));

  const total = events.length;
  const unclassified = warnings.length;
  const violatedBeacons = new Set(
    violations.filter((v) => v.beacon !== null && v.beacon !== undefined).map((v) => v.beacon)
  );
  const ok = total - unclassified - violatedBeacons.size;

  return {
    ruleSet: ruleSet.name,
    summary: { beacons: total, ok, unclassified, violations: violations.length },
    classified: classified.map((c) => ({
      beacon: c.event.index,
      requestId: c.event.requestId ?? null,
      timestamp: c.event.timestamp ?? null,
      type: c.type
    })),
    warnings,
    violations
  };
}
