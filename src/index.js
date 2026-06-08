/**
 * index.js — tracewright public programmatic API.
 *
 * Typical use:
 *   import { loadRuleSet, readExport, validate, formatReport } from 'tracewright';
 *   const ruleSet = await loadRuleSet('rules.json');
 *   const { events, skipped } = readExport(csvText);
 *   const report = validate(events, ruleSet);
 *   process.stdout.write(formatReport(report, { skippedNonAdobe: skipped }));
 */

export { loadRuleSet, checkRuleSet } from './engine/load-rule-set.js';
export { readExport, parseCsv } from './read.js';
export { decode } from './engine/decode.js';
export { classify, matches } from './engine/classify.js';
export { validate } from './engine/validate.js';
export { formatReport } from './report.js';
