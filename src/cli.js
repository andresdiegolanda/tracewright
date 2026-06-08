#!/usr/bin/env node
/**
 * cli.js — tracewright command-line entry point.
 *
 *   tracewright --rules <rule-set.json> <omnibug-export.csv>
 *   tracewright -r rules.json capture.csv
 *
 * Reads the rule set and the Omnibug CSV export, validates, and prints a text report.
 * v1 exits non-zero only on an operational failure (unreadable/invalid input); a
 * violations-based exit code is a v2 addition (see docs/design.md §10).
 */

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadRuleSet } from './engine/load-rule-set.js';
import { readExport } from './read.js';
import { validate } from './engine/validate.js';
import { formatReport } from './report.js';

const USAGE = `tracewright — validate Adobe Analytics beacons from an Omnibug CSV export.

Usage:
  tracewright --rules <rule-set.json> <omnibug-export.csv>

Options:
  -r, --rules <path>      Rule-set JSON file (required)
  -f, --format <fmt>      Report format: markdown (default) or text
  -h, --help              Show this help

Reads the CSV export, validates its Adobe beacons against the rule set, and prints a report.`;

const FORMATS = new Set(['markdown', 'text']);

async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        rules: { type: 'string', short: 'r' },
        format: { type: 'string', short: 'f' },
        help: { type: 'boolean', short: 'h' }
      }
    });
  } catch (err) {
    return fail(err.message);
  }

  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }

  const csvPath = positionals[0];
  if (!values.rules || !csvPath) {
    return fail('a rule set (--rules) and an export file are both required');
  }
  if (positionals.length > 1) {
    return fail(`expected a single export file, got ${positionals.length}`);
  }

  const format = values.format ?? 'markdown';
  if (!FORMATS.has(format)) {
    return fail(`unknown format "${format}" (expected markdown or text)`);
  }

  let csvText;
  try {
    csvText = await readFile(csvPath, 'utf8');
  } catch (err) {
    return fail(`cannot read export "${csvPath}": ${err.message}`);
  }

  let ruleSet;
  try {
    ruleSet = await loadRuleSet(values.rules);
  } catch (err) {
    return fail(err.message);
  }

  let report;
  let skipped;
  try {
    const read = readExport(csvText);
    skipped = read.skipped;
    report = validate(read.events, ruleSet);
  } catch (err) {
    return fail(err.message);
  }

  process.stdout.write(formatReport(report, { format, skippedNonAdobe: skipped }));
  return 0;
}

function fail(message) {
  process.stderr.write(`tracewright: ${message}\n\n${USAGE}\n`);
  return 2;
}

process.exit(await main(process.argv.slice(2)));
