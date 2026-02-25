/**
 * In-memory HTTP request/response log manager.
 * Circular buffer of up to MAX_LOG_ENTRIES entries.
 */

const MAX_LOG_ENTRIES = 10000;
const MAX_BODY_BYTES  = 50 * 1024; // 50 KB cap per body field

/** Truncate a string to MAX_BODY_BYTES, adding a note if cut. */
function truncateBody(str) {
  if (str == null) return null;
  if (typeof str !== 'string') {
    try { str = str.toString('utf8'); } catch { str = String(str); }
  }
  if (str.length === 0) return null;
  if (str.length > MAX_BODY_BYTES) {
    return str.substring(0, MAX_BODY_BYTES) + `\n...[truncated — ${str.length} total bytes]`;
  }
  return str;
}

/** Generate a short unique ID. */
function makeId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// The circular buffer
const entries = [];

/**
 * Add a new log entry.
 * @param {object} entry - Fully-formed log entry object.
 */
function addEntry(entry) {
  entries.push(entry);
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.shift();
  }
}

/**
 * Query log entries with optional filters.
 * Returns newest entries first.
 *
 * @param {object} opts
 * @param {string}  [opts.url]      - Substring match against request URL
 * @param {string}  [opts.method]   - Exact HTTP method (case-insensitive)
 * @param {string}  [opts.status]   - Exact status code OR class like "2xx", "4xx"
 * @param {string}  [opts.action]   - "mock" | "proxy"
 * @param {number}  [opts.limit=100]
 * @param {number}  [opts.offset=0]
 * @param {string}  [opts.since]    - ISO timestamp; return entries after this time
 */
function getEntries({ url, method, status, action, limit = 100, offset = 0, since } = {}) {
  // Work newest-first
  let result = entries.slice().reverse();

  if (since) {
    const sinceMs = new Date(since).getTime();
    result = result.filter(e => new Date(e.timestamp).getTime() > sinceMs);
  }
  if (url) {
    const q = url.toLowerCase();
    result = result.filter(e => e.request.url.toLowerCase().includes(q));
  }
  if (method) {
    const m = method.toUpperCase();
    result = result.filter(e => e.request.method.toUpperCase() === m);
  }
  if (status) {
    const s = String(status).toLowerCase();
    if (s.endsWith('xx')) {
      const prefix = parseInt(s[0], 10);
      result = result.filter(e => Math.floor(e.response.status / 100) === prefix);
    } else {
      const code = parseInt(status, 10);
      result = result.filter(e => e.response.status === code);
    }
  }
  if (action) {
    result = result.filter(e => e.appInfo.action === action);
  }

  const total = result.length;
  result = result.slice(Number(offset), Number(offset) + Number(limit));
  return { entries: result, total };
}

/** Clear all log entries. */
function clearEntries() {
  entries.length = 0;
}

/** Aggregate stats snapshot. */
function getStats() {
  const total    = entries.length;
  const mocked   = entries.filter(e => e.appInfo.action === 'mock').length;
  const proxied  = entries.filter(e => e.appInfo.action === 'proxy').length;
  const errors   = entries.filter(e => e.response.status >= 500).length;
  const avgLatency = total > 0
    ? Math.round(entries.reduce((s, e) => s + (e.latency || 0), 0) / total)
    : 0;
  return { total, mocked, proxied, errors, avgLatency };
}

export const logManager = {
  addEntry,
  getEntries,
  clearEntries,
  getStats,
  truncateBody,
  makeId
};
