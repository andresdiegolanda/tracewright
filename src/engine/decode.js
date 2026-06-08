/**
 * decode.js — raw Adobe beacon → NormalizedEvent (v1: raw param map only).
 *
 * Pure string/URL work using the native URL and URLSearchParams APIs. No Adobe SDK,
 * no network, no friendly-name aliasing, no structured decoding (those are v2).
 *
 * A raw beacon record looks like:
 *   { url, postData, requestId, timestamp }
 * where `url` is the full Adobe request URL (with query string) and `postData` is the
 * x-www-form-urlencoded POST body (empty for GET-style beacons).
 */

/**
 * Decode one raw beacon record into a NormalizedEvent.
 *
 * @param {{url: string, postData?: string, requestId?: string|null, timestamp?: string|null}} record
 * @param {number} index  position of this beacon in the capture (0-based)
 * @returns {{
 *   index: number,
 *   requestId: string|null,
 *   timestamp: string|null,
 *   reportSuites: string[],
 *   params: Record<string, string>,
 *   parseNotes: string[]
 * }}
 */
export function decode(record, index = 0) {
  const { url, postData = '', requestId = null, timestamp = null } = record;
  const parseNotes = [];
  let reportSuites = [];
  const params = {};

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    parseNotes.push(`Unparseable request URL: ${url}`);
    return { index, requestId, timestamp, reportSuites, params, parseNotes };
  }

  // Adobe beacon path: /b/ss/<reportSuiteIDs>/<responseType>/<version>/s<cacheBuster>
  // Report suite IDs are comma-separated. responseType/version are informational (v1 drops them).
  const segments = parsed.pathname.split('/').filter(Boolean);
  const ss = segments.findIndex((seg, i) => seg === 'ss' && segments[i - 1] === 'b');
  if (ss !== -1 && segments[ss + 1]) {
    reportSuites = segments[ss + 1].split(',').filter(Boolean);
  } else {
    parseNotes.push('Request path is not an Adobe /b/ss/ beacon');
  }

  // Merge query string and POST body into a single raw param map (last value wins).
  // An empty postData yields an empty URLSearchParams, so nothing is merged.
  for (const search of [parsed.searchParams, new URLSearchParams(postData)]) {
    for (const [key, value] of search) {
      params[key] = value;
    }
  }

  return { index, requestId, timestamp, reportSuites, params, parseNotes };
}
