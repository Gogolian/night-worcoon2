/**
 * In-memory HTTP request/response log manager.
 * Circular buffer of up to MAX_LOG_ENTRIES entries.
 */

import { brotliDecompressSync, gunzipSync, inflateRawSync, inflateSync } from 'zlib';

const MAX_LOG_ENTRIES = 10000;
const MAX_BODY_BYTES  = 50 * 1024; // 50 KB cap per body field

function getHeaderValue(headers, name) {
  if (!headers || !name) return null;

  const lookupName = name.toLowerCase();
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== lookupName) continue;
    if (Array.isArray(headerValue)) return headerValue.join(', ');
    return headerValue == null ? null : String(headerValue);
  }

  return null;
}

function getContentEncodings(headers) {
  const encodingHeader = getHeaderValue(headers, 'content-encoding');
  if (!encodingHeader) return [];

  return encodingHeader
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(part => part && part !== 'identity');
}

function getContentType(headers) {
  const contentType = getHeaderValue(headers, 'content-type');
  return contentType ? contentType.split(';')[0].trim().toLowerCase() : '';
}

function getCharset(headers) {
  const contentType = getHeaderValue(headers, 'content-type') || '';
  const match = contentType.match(/charset\s*=\s*['"]?([^;'"]+)/i);
  const charset = match ? match[1].trim().toLowerCase() : 'utf-8';

  switch (charset) {
    case 'utf-8':
    case 'utf8':
      return 'utf8';
    case 'utf-16le':
    case 'utf16le':
    case 'ucs-2':
    case 'ucs2':
      return 'utf16le';
    case 'latin1':
    case 'iso-8859-1':
    case 'iso8859-1':
      return 'latin1';
    case 'ascii':
    case 'us-ascii':
      return 'ascii';
    default:
      return 'utf8';
  }
}

function isTextLikeContentType(headers) {
  const contentType = getContentType(headers);

  if (!contentType) return true;
  if (contentType.startsWith('text/')) return true;

  return [
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-javascript',
    'application/typescript',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/graphql-response+json',
    'image/svg+xml'
  ].includes(contentType)
    || contentType.endsWith('+json')
    || contentType.endsWith('+xml');
}

function decompressBody(buffer, encodings) {
  let decoded = buffer;

  for (let i = encodings.length - 1; i >= 0; i--) {
    const encoding = encodings[i];

    switch (encoding) {
      case 'br':
        decoded = brotliDecompressSync(decoded);
        break;
      case 'gzip':
      case 'x-gzip':
        decoded = gunzipSync(decoded);
        break;
      case 'deflate':
        try {
          decoded = inflateSync(decoded);
        } catch {
          decoded = inflateRawSync(decoded);
        }
        break;
      default:
        throw new Error(`Unsupported content-encoding: ${encoding}`);
    }
  }

  return decoded;
}

function formatBinaryPlaceholder({ contentType, encodings, size }) {
  const typeLabel = contentType || 'application/octet-stream';
  const encodingLabel = encodings.length > 0 ? `; content-encoding=${encodings.join(', ')}` : '';
  return `[binary body omitted; content-type=${typeLabel}; ${size} bytes${encodingLabel}]`;
}

function decodeBodyForLogging(body, headers = {}) {
  if (body == null) return null;

  let buffer;
  if (Buffer.isBuffer(body)) {
    buffer = body;
  } else if (body instanceof Uint8Array) {
    buffer = Buffer.from(body);
  } else if (typeof body === 'string') {
    buffer = Buffer.from(body);
  } else {
    buffer = Buffer.from(String(body));
  }

  if (buffer.length === 0) return null;

  const encodings = getContentEncodings(headers);
  let decodedBuffer = buffer;

  if (encodings.length > 0) {
    try {
      decodedBuffer = decompressBody(buffer, encodings);
    } catch (error) {
      return `[unable to decode body for logging; content-encoding=${encodings.join(', ')}; error=${error.message}; ${buffer.length} bytes]`;
    }
  }

  if (!isTextLikeContentType(headers)) {
    return formatBinaryPlaceholder({
      contentType: getContentType(headers),
      encodings,
      size: decodedBuffer.length
    });
  }

  try {
    return decodedBuffer.toString(getCharset(headers));
  } catch {
    return decodedBuffer.toString('utf8');
  }
}

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
    if (action === 'bucket') {
      result = result.filter(e => !!e.appInfo.bucketSource);
    } else if (action === 'mock') {
      result = result.filter(e => e.appInfo.action === 'mock' && !e.appInfo.bucketSource);
    } else {
      result = result.filter(e => e.appInfo.action === action);
    }
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
  const bucketed = entries.filter(e => !!e.appInfo.bucketSource).length;
  const mocked   = entries.filter(e => e.appInfo.action === 'mock' && !e.appInfo.bucketSource).length;
  const proxied  = entries.filter(e => e.appInfo.action === 'proxy').length;
  const errors   = entries.filter(e => e.response.status >= 500).length;
  const avgLatency = total > 0
    ? Math.round(entries.reduce((s, e) => s + (e.latency || 0), 0) / total)
    : 0;
  return { total, bucketed, mocked, proxied, errors, avgLatency };
}

export const logManager = {
  addEntry,
  getEntries,
  clearEntries,
  getStats,
  decodeBodyForLogging,
  truncateBody,
  makeId
};
