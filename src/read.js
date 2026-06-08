/**
 * read.js — Omnibug CSV export → NormalizedEvent[].
 *
 * The export is a CSV file: a metadata line, a column header row, then one row per captured
 * request (columns: Event Type | Provider | Account | Request ID | Request URL | POST Data |
 * Timestamp | Notes). Rows may be SHORTER than the header (Omnibug omits the trailing Notes
 * column when notes are off), so columns are mapped by the header row and missing trailing
 * fields read as empty.
 *
 * Only rows whose Provider is an Adobe provider are decoded into events. Every other row —
 * Navigation rows, empty-Provider rows, third-party pixels — is counted and skipped (no
 * error, no parse note), per the design's "non-Adobe, counted and skipped" bucket.
 */

import { decode } from './engine/decode.js';

const ADOBE_PROVIDERS = new Set(['Adobe Analytics']);

/**
 * Parse CSV text into an array of string rows (RFC-4180-ish: quoted fields, embedded commas,
 * "" escaped quotes, CRLF or LF line endings).
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // ignore; the \n ends the record
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Read an Omnibug CSV export into normalized events.
 * @param {string} csvText
 * @returns {{ events: object[], skipped: number }}
 *   events  — decoded Adobe beacons (NormalizedEvent[]), indexed 0..n in capture order
 *   skipped — count of non-Adobe rows skipped (Navigation, empty-Provider, third-party)
 * @throws {Error} if the text has no Omnibug column header row
 */
export function readExport(csvText) {
  const rows = parseCsv(csvText);

  const headerIdx = rows.findIndex((r) => (r[0] ?? '').trim() === 'Event Type');
  if (headerIdx === -1) {
    throw new Error('Not an Omnibug CSV export: no "Event Type" header row found.');
  }

  const columns = {};
  rows[headerIdx].forEach((name, i) => { columns[(name ?? '').trim()] = i; });
  const get = (row, name) => {
    const i = columns[name];
    return i == null ? '' : (row[i] ?? '');
  };

  const events = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => (c ?? '') === '')) continue; // blank line

    if (!ADOBE_PROVIDERS.has(get(row, 'Provider'))) {
      skipped++;
      continue;
    }

    events.push(decode(
      {
        url: get(row, 'Request URL'),
        postData: get(row, 'POST Data'),
        requestId: get(row, 'Request ID') || null,
        timestamp: get(row, 'Timestamp') || null
      },
      events.length
    ));
  }

  return { events, skipped };
}
