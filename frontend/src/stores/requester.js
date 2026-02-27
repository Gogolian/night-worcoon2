import { writable, get } from 'svelte/store';

export const requestMethod  = writable('GET');
export const requestPath    = writable('');
export const requestHeaders = writable([{ key: '', value: '', enabled: true }]);
export const requestBody    = writable('{\n  \n}');
export const response       = writable(null);
export const loading        = writable(false);
export const requestError   = writable(null);

// Set to true by loadFromLogEntry so fetchActiveHeaders() won't clobber pre-loaded headers
let _headersPreloaded = false;

/**
 * Fetch active config set headers and pre-populate the headers table.
 * Appends one empty row at the end for new entries.
 */
export async function fetchActiveHeaders() {
  if (_headersPreloaded) {
    _headersPreloaded = false;
    return;
  }
  try {
    const res = await fetch('/__api/config-sets');
    if (!res.ok) return;
    const data = await res.json();
    const activeSet = (data.configSets || []).find(s => s.id === data.activeConfigSet);
    if (activeSet?.requestHeaders && Object.keys(activeSet.requestHeaders).length > 0) {
      const rows = Object.entries(activeSet.requestHeaders).map(([key, value]) => ({
        key, value, enabled: true
      }));
      requestHeaders.set([...rows, { key: '', value: '', enabled: true }]);
    }
  } catch {
    // silently ignore — headers table stays with one empty row
  }
}

/**
 * Pre-fill the requester from a log entry so user can replay the request.
 */
export function loadFromLogEntry(entry) {
  requestMethod.set(entry.request.method || 'GET');

  // Strip the origin/host — keep only path+query
  let path = entry.request.url || '';
  try {
    const u = new URL(path);
    path = u.pathname + (u.search || '');
  } catch {
    // already a path-only string
  }
  requestPath.set(path);

  // Convert headers object to editable rows
  const hdrs = entry.request.headers || {};
  const rows = Object.entries(hdrs)
    .filter(([k]) => !['host', 'content-length'].includes(k.toLowerCase()))
    .map(([key, value]) => ({ key, value, enabled: true }));
  requestHeaders.set([...rows, { key: '', value: '', enabled: true }]);

  // Body — try to pretty-print JSON
  let body = entry.request.body || '';
  try {
    body = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    // leave as-is
  }
  requestBody.set(body || '{\n  \n}');

  // Signal that headers are already populated — skip fetchActiveHeaders
  _headersPreloaded = true;

  // Clear any previous response
  response.set(null);
  requestError.set(null);
}

/**
 * Send the configured request through the backend proxy endpoint.
 */
export async function sendRequest() {
  loading.set(true);
  requestError.set(null);
  try {
    const method  = get(requestMethod);
    const path    = get(requestPath);
    const hdrs    = get(requestHeaders)
      .filter(h => h.enabled && h.key.trim())
      .reduce((acc, h) => { acc[h.key.trim()] = h.value.trim(); return acc; }, {});
    const bodyVal = get(requestBody);
    const noBody  = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

    const res = await fetch('/__api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, path, headers: hdrs, body: noBody ? undefined : bodyVal })
    });

    const data = await res.json();
    if (!res.ok && data.error) {
      requestError.set(data.error);
    } else {
      response.set(data);
    }
  } catch (e) {
    requestError.set(e.message);
  } finally {
    loading.set(false);
  }
}
