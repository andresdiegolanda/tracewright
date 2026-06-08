/**
 * report.js — render a validation Report as a Markdown summary (v1).
 *
 * Pure formatting over the Report produced by engine/validate.js. The output is valid
 * Markdown so it reads well in a terminal and can be pasted straight into a file. Per-beacon
 * violations (schema, ambiguous) are grouped under each beacon; cross-event violations
 * (precedes, count) are grouped under "Sequence rules". Unclassified beacons and skipped
 * non-Adobe rows are listed as notices, and a summary table closes the report.
 *
 * The report is assembled from "blocks" — each helper returns an array of lines (or null
 * when it has nothing to show). Blocks are joined with a blank line between them.
 */

/**
 * @param {object} report  the Report from validate()
 * @param {{ skippedNonAdobe?: number }} [options]
 * @returns {string} a Markdown report ending in a newline
 */
export function formatReport(report, { skippedNonAdobe = 0 } = {}) {
  const blocks = [
    headingBlock(report),
    ...beaconBlocks(report),
    sequenceBlock(report),
    noticesBlock(report, skippedNonAdobe),
    summaryBlock(report, skippedNonAdobe)
  ].filter(Boolean);

  return blocks.map((lines) => lines.join('\n')).join('\n\n') + '\n';
}

function headingBlock(report) {
  const total = report.violations.length;
  const { beacons } = report.summary;
  const result = total === 0
    ? `✅ All ${beacons} ${pluralize('beacon', beacons)} passed.`
    : `❌ ${total} ${pluralize('violation', total)} found.`;
  return ['# tracewright report', '', `**Rule set:** \`${report.ruleSet}\``, '', `**Result:** ${result}`];
}

function beaconBlocks(report) {
  const meta = new Map(report.classified.map((c) => [c.beacon, c]));
  const perBeacon = report.violations.filter((v) => v.code === 'schema' || v.code === 'ambiguous');
  const beacons = [...new Set(perBeacon.map((v) => v.beacon))].sort((a, b) => a - b);
  return beacons.map((beacon) => oneBeaconBlock(beacon, meta.get(beacon) ?? {}, perBeacon));
}

function oneBeaconBlock(beacon, info, perBeacon) {
  const label = info.type ? `\`${info.type}\`` : 'unclassified';
  const quote = info.requestId ? [`> request \`${info.requestId}\``, ''] : [];
  const bullets = perBeacon
    .filter((v) => v.beacon === beacon)
    .map((v) => `- **${v.code}** — ${v.message}${gotSuffix(v)}`);
  return [`## Beacon #${beacon} — ${label}`, '', ...quote, ...bullets];
}

function sequenceBlock(report) {
  const seq = report.violations.filter((v) => v.code === 'precedes' || v.code === 'count');
  if (seq.length === 0) return null;
  const bullets = seq.map((v) => {
    const loc = v.code === 'precedes' && v.beacon != null ? ` (beacon #${v.beacon})` : '';
    return `- **${v.code}** — ${v.message}${loc}`;
  });
  return ['## Sequence rules', '', ...bullets];
}

function noticesBlock(report, skipped) {
  const warnings = report.warnings.map((w) => {
    const where = w.requestId ? ` — request \`${w.requestId}\`` : '';
    return `- ⚠️ Beacon #${w.beacon} unclassified (no matching event type)${where}`;
  });
  const skippedLine = skipped > 0 ? [`- ℹ️ ${skipped} non-Adobe ${pluralize('row', skipped)} skipped`] : [];
  const bullets = [...warnings, ...skippedLine];
  return bullets.length === 0 ? null : ['## Notices', '', ...bullets];
}

function summaryBlock(report, skipped) {
  const s = report.summary;
  const total = report.violations.length;
  const violations = total === 0 ? '0' : `${total} (${formatTally(report.violations)})`;
  const rows = [
    ['Beacons checked', s.beacons],
    ['Passed', s.ok],
    ['Unclassified', s.unclassified],
    ...(skipped > 0 ? [['Non-Adobe skipped', skipped]] : []),
    ['Violations', violations]
  ];
  const tableRows = rows.map(([metric, count]) => `| ${metric} | ${count} |`);
  return ['## Summary', '', '| Metric | Count |', '| --- | --- |', ...tableRows];
}

function formatTally(violations) {
  const counts = {};
  for (const v of violations) counts[v.code] = (counts[v.code] ?? 0) + 1;
  return Object.entries(counts).map(([code, n]) => `${n} ${code}`).join(', ');
}

function gotSuffix(v) {
  if (v.code !== 'schema') return '';
  if (v.actual === null || v.actual === undefined || typeof v.actual === 'object') return '';
  return ` (got: \`${JSON.stringify(v.actual)}\`)`;
}

function pluralize(word, n) {
  return n === 1 ? word : `${word}s`;
}
