/**
 * report.js — render a validation Report as either Markdown (default) or plain text.
 *
 * Pure formatting over the Report produced by engine/validate.js.
 *   - Markdown (default): beacon headings, grouped violation lists, a notices section, and a
 *     summary table. Reads well in a terminal and pastes straight into a file.
 *   - Text: the compact `✗ Beacon #N … classified as "X"` form with `• code message` bullets
 *     and a one-line summary. Cleaner for plain terminal output.
 *
 * Both renderers share the same grouping (partition): per-beacon violations (schema,
 * ambiguous) under each beacon; cross-event violations (precedes, count) under a sequence
 * group; unclassified beacons and skipped non-Adobe rows as notices.
 */

const CODE_WIDTH = 9; // align the code column in the text renderer

/**
 * @param {object} report  the Report from validate()
 * @param {{ format?: 'markdown'|'text', skippedNonAdobe?: number }} [options]
 * @returns {string} the report, ending in a newline
 */
export function formatReport(report, { format = 'markdown', skippedNonAdobe = 0 } = {}) {
  return format === 'text' ? formatText(report, skippedNonAdobe) : formatMarkdown(report, skippedNonAdobe);
}

function partition(report) {
  const meta = new Map(report.classified.map((c) => [c.beacon, c]));
  const perBeacon = report.violations.filter((v) => v.code === 'schema' || v.code === 'ambiguous');
  const sequence = report.violations.filter((v) => v.code === 'precedes' || v.code === 'count');
  const violatedBeacons = [...new Set(perBeacon.map((v) => v.beacon))].sort((a, b) => a - b);
  return { meta, perBeacon, sequence, violatedBeacons };
}

/* ------------------------------------------------------------------ Markdown */

function formatMarkdown(report, skipped) {
  const { meta, perBeacon, sequence, violatedBeacons } = partition(report);
  const blocks = [
    mdHeading(report),
    ...violatedBeacons.map((b) => mdBeaconBlock(b, meta.get(b) ?? {}, perBeacon)),
    mdSequenceBlock(sequence),
    mdNoticesBlock(report, skipped),
    mdSummaryBlock(report, skipped)
  ].filter(Boolean);
  return blocks.map((lines) => lines.join('\n')).join('\n\n') + '\n';
}

function mdHeading(report) {
  const total = report.violations.length;
  const { beacons } = report.summary;
  const result = total === 0
    ? `✅ All ${beacons} ${pluralize('beacon', beacons)} passed.`
    : `❌ ${total} ${pluralize('violation', total)} found.`;
  return ['# tracewright report', '', `**Rule set:** \`${report.ruleSet}\``, '', `**Result:** ${result}`];
}

function mdBeaconBlock(beacon, info, perBeacon) {
  const label = info.type ? `\`${info.type}\`` : 'unclassified';
  const quote = info.requestId ? [`> request \`${info.requestId}\``, ''] : [];
  const bullets = perBeacon
    .filter((v) => v.beacon === beacon)
    .map((v) => `- **${v.code}** — ${v.message}${gotSuffix(v, '`')}`);
  return [`## Beacon #${beacon} — ${label}`, '', ...quote, ...bullets];
}

function mdSequenceBlock(sequence) {
  if (sequence.length === 0) return null;
  const bullets = sequence.map((v) => `- **${v.code}** — ${v.message}${precedesLocator(v)}`);
  return ['## Sequence rules', '', ...bullets];
}

function mdNoticesBlock(report, skipped) {
  const warnings = report.warnings.map((w) => {
    const where = w.requestId ? ` — request \`${w.requestId}\`` : '';
    return `- ⚠️ Beacon #${w.beacon} unclassified (no matching event type)${where}`;
  });
  const skippedLine = skipped > 0 ? [`- ℹ️ ${skipped} non-Adobe ${pluralize('row', skipped)} skipped`] : [];
  const bullets = [...warnings, ...skippedLine];
  return bullets.length === 0 ? null : ['## Notices', '', ...bullets];
}

function mdSummaryBlock(report, skipped) {
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

/* ---------------------------------------------------------------------- Text */

function formatText(report, skipped) {
  const { meta, perBeacon, sequence, violatedBeacons } = partition(report);
  const blocks = [
    [textHeading(report, violatedBeacons)],
    ...violatedBeacons.map((b) => textBeaconBlock(b, meta.get(b) ?? {}, perBeacon)),
    textSequenceBlock(sequence),
    textNoticesBlock(report, skipped),
    [textSummary(report, skipped)]
  ].filter(Boolean);
  return blocks.map((lines) => lines.join('\n')).join('\n\n') + '\n';
}

function textHeading(report, violatedBeacons) {
  const { beacons } = report.summary;
  if (report.violations.length === 0) {
    return `tracewright — all ${beacons} ${pluralize('beacon', beacons)} OK`;
  }
  return `tracewright — ${violatedBeacons.length} of ${beacons} ${pluralize('beacon', beacons)} have violations`;
}

function textBeaconBlock(beacon, info, perBeacon) {
  const cls = info.type ? `classified as "${info.type}"` : 'unclassified';
  const head = `✗ Beacon #${beacon}  (${locator(info, beacon)})  ${cls}`;
  const bullets = perBeacon
    .filter((v) => v.beacon === beacon)
    .map((v) => `  • ${v.code.padEnd(CODE_WIDTH)} ${v.message}${gotSuffix(v, '')}`);
  return [head, ...bullets];
}

function textSequenceBlock(sequence) {
  if (sequence.length === 0) return null;
  const bullets = sequence.map((v) => `  • ${v.code.padEnd(CODE_WIDTH)} ${v.message}${precedesLocator(v)}`);
  return ['✗ Sequence', ...bullets];
}

function textNoticesBlock(report, skipped) {
  const warnings = report.warnings.map((w) => {
    const where = w.requestId ? ` — request ${w.requestId}` : '';
    return `⚠ Beacon #${w.beacon} unclassified (no matching event type)${where}`;
  });
  const skippedLine = skipped > 0 ? [`ℹ ${skipped} non-Adobe ${pluralize('row', skipped)} skipped`] : [];
  const lines = [...warnings, ...skippedLine];
  return lines.length === 0 ? null : lines;
}

function textSummary(report, skipped) {
  const s = report.summary;
  const total = report.violations.length;
  const breakdown = total === 0 ? '' : ` (${formatTally(report.violations)})`;
  const skippedPart = skipped > 0 ? `, ${skipped} skipped` : '';
  return `Summary: ${total} ${pluralize('violation', total)}${breakdown}. ${s.ok} OK, ${s.unclassified} unclassified${skippedPart}.`;
}

/* -------------------------------------------------------------------- shared */

function locator(info, beacon) {
  const parts = [info.requestId ? `request ${info.requestId}` : null, info.timestamp || null].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : `index ${beacon}`;
}

function precedesLocator(v) {
  return v.code === 'precedes' && v.beacon != null ? ` (beacon #${v.beacon})` : '';
}

function formatTally(violations) {
  const counts = {};
  for (const v of violations) counts[v.code] = (counts[v.code] ?? 0) + 1;
  return Object.entries(counts).map(([code, n]) => `${n} ${code}`).join(', ');
}

function gotSuffix(v, wrap) {
  if (v.code !== 'schema') return '';
  if (v.actual === null || v.actual === undefined || typeof v.actual === 'object') return '';
  return ` (got: ${wrap}${JSON.stringify(v.actual)}${wrap})`;
}

function pluralize(word, n) {
  return n === 1 ? word : `${word}s`;
}
