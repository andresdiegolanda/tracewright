/**
 * report.js — render a validation Report as a human-readable text summary (v1).
 *
 * Pure formatting over the Report produced by engine/validate.js. Per-beacon violations
 * (schema, ambiguous) are grouped under each beacon; cross-event violations (precedes,
 * count) are grouped under "Sequence". Unclassified beacons and skipped non-Adobe rows are
 * shown as non-failing notices.
 */

const PAD = 9; // align the violation-code column

/**
 * @param {object} report  the Report from validate()
 * @param {{ skippedNonAdobe?: number }} [options]
 * @returns {string} a text report ending in a newline
 */
export function formatReport(report, { skippedNonAdobe = 0 } = {}) {
  const out = [];
  const meta = new Map(report.classified.map((c) => [c.beacon, c]));

  const perBeacon = report.violations.filter((v) => v.code === 'schema' || v.code === 'ambiguous');
  const sequence = report.violations.filter((v) => v.code === 'precedes' || v.code === 'count');
  const violatedBeacons = [...new Set(report.violations.filter((v) => v.beacon != null).map((v) => v.beacon))]
    .sort((a, b) => a - b);

  // Heading
  if (report.violations.length === 0) {
    out.push(`tracewright — all ${report.summary.beacons} beacon${plural(report.summary.beacons)} OK`);
  } else {
    out.push(`tracewright — ${violatedBeacons.length} of ${report.summary.beacons} beacon${plural(report.summary.beacons)} have violations`);
  }

  // Per-beacon groups
  for (const beacon of violatedBeacons) {
    const c = meta.get(beacon) ?? {};
    const where = c.requestId ? `request ${c.requestId}` : `index ${beacon}`;
    const cls = c.type ? `classified as "${c.type}"` : 'unclassified';
    out.push('');
    out.push(`✗ Beacon #${beacon}  (${where})  ${cls}`);
    for (const v of perBeacon.filter((x) => x.beacon === beacon)) {
      out.push(`  • ${v.code.padEnd(PAD)} ${v.message}${gotSuffix(v)}`);
    }
  }

  // Sequence group
  if (sequence.length > 0) {
    out.push('');
    out.push('✗ Sequence');
    for (const v of sequence) {
      const loc = v.code === 'precedes' && v.beacon != null ? `  [#${v.beacon}]` : '';
      out.push(`  • ${v.code.padEnd(PAD)} ${v.message}${loc}`);
    }
  }

  // Non-failing notices
  const notices = [];
  for (const w of report.warnings) {
    notices.push(`⚠ Beacon #${w.beacon} unclassified (no matching event type)${w.requestId ? ` — request ${w.requestId}` : ''}`);
  }
  if (skippedNonAdobe > 0) {
    notices.push(`ℹ ${skippedNonAdobe} non-Adobe row${plural(skippedNonAdobe)} skipped`);
  }
  if (notices.length > 0) {
    out.push('');
    out.push(...notices);
  }

  // Summary
  out.push('');
  out.push(summaryLine(report, skippedNonAdobe));

  return out.join('\n') + '\n';
}

function summaryLine(report, skipped) {
  const s = report.summary;
  const breakdown = formatTally(report.violations);
  const head = `Summary: ${s.violations} violation${plural(s.violations)}` + (breakdown ? ` (${breakdown})` : '');
  const tail = `${s.ok} OK, ${s.unclassified} unclassified` + (skipped ? `, ${skipped} skipped` : '');
  return `${head}. ${tail}.`;
}

function formatTally(violations) {
  const counts = {};
  for (const v of violations) counts[v.code] = (counts[v.code] ?? 0) + 1;
  return Object.entries(counts).map(([code, n]) => `${n} ${code}`).join(', ');
}

function gotSuffix(v) {
  if (v.code !== 'schema') return '';
  if (v.actual === null || v.actual === undefined || typeof v.actual === 'object') return '';
  return ` (got: ${JSON.stringify(v.actual)})`;
}

function plural(n) {
  return n === 1 ? '' : 's';
}
