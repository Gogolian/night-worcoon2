import { writable, get } from 'svelte/store';

// Core stores
export const logEntries  = writable([]);
export const logTotal    = writable(0);
export const logStats    = writable({ total: 0, bucketed: 0, mocked: 0, proxied: 0, errors: 0, avgLatency: 0 });
export const logsLoading = writable(false);

// Active filter state (shared between store and view)
export const urlFilter    = writable('');
export const methodFilter = writable('');
export const statusFilter = writable('');
export const actionFilter = writable('');

/**
 * When a user clicks "Mock" on a log entry this holds the entry
 * so MockPlugin can consume it on mount and pre-fill a new rule.
 */
export const pendingMockEntry = writable(null);

let pollingInterval = null;

/**
 * Fetch log entries from the server, applying current filters.
 * @param {object} [filters]
 * @param {boolean} [silent] - If true, skip logsLoading toggling (for background polls)
 */
export async function fetchEntries(filters = {}, silent = false) {
  if (!silent) logsLoading.set(true);
  try {
    const params = new URLSearchParams();
    if (filters.url)    params.set('url',    filters.url);
    if (filters.method) params.set('method', filters.method);
    if (filters.status) params.set('status', filters.status);
    if (filters.action) params.set('action', filters.action);
    params.set('limit',  String(filters.limit  ?? 200));
    params.set('offset', String(filters.offset ?? 0));

    const res = await fetch(`/__api/logs/entries?${params}`);
    if (!res.ok) throw new Error('Failed to fetch log entries');
    const data = await res.json();
    const newEntries = data.entries || [];
    const newTotal   = data.total ?? 0;

    // Smart diff: only update stores when the data actually changed.
    // If the total count and the first entry's id both match, the list is identical.
    if (silent) {
      const current = get(logEntries);
      const unchanged =
        newTotal === get(logTotal) &&
        newEntries.length === current.length &&
        (newEntries.length === 0 || newEntries[0]?.id === current[0]?.id);
      if (!unchanged) {
        logEntries.set(newEntries);
        logTotal.set(newTotal);
      }
    } else {
      logEntries.set(newEntries);
      logTotal.set(newTotal);
    }
  } catch (err) {
    console.error('Error fetching log entries:', err);
  } finally {
    if (!silent) logsLoading.set(false);
  }
}

/**
 * Fetch aggregate stats.
 * Only updates the store when values have actually changed.
 */
export async function fetchStats() {
  try {
    const res = await fetch('/__api/logs/stats');
    if (!res.ok) throw new Error('Failed to fetch log stats');
    const data = await res.json();
    // Shallow compare — skip store update if all values are identical
    const prev = get(logStats);
    if (
      data.total       !== prev.total       ||
      data.bucketed    !== prev.bucketed    ||
      data.mocked      !== prev.mocked      ||
      data.proxied     !== prev.proxied     ||
      data.errors      !== prev.errors      ||
      data.avgLatency  !== prev.avgLatency
    ) {
      logStats.set(data);
    }
  } catch (err) {
    console.error('Error fetching log stats:', err);
  }
}

/**
 * Clear all log entries on the server, then refresh locally.
 */
export async function clearLogs() {
  try {
    const res = await fetch('/__api/logs/clear', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear logs');
    logEntries.set([]);
    logTotal.set(0);
    logStats.set({ total: 0, bucketed: 0, mocked: 0, proxied: 0, errors: 0, avgLatency: 0 });
  } catch (err) {
    console.error('Error clearing logs:', err);
    throw err;
  }
}

let _currentFilters = {};

/**
 * Start polling every 3 seconds. Call stopPolling() on component destroy.
 * @param {object} [filters] - Initial filter values
 */
export function startPolling(filters = {}) {
  _currentFilters = filters;
  fetchEntries(filters, false);
  fetchStats();
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => {
    fetchEntries(_currentFilters, true);  // silent — no loading spinner churn
    fetchStats();
  }, 3000);
}

/** Update live filters used by the polling loop. */
export function updatePollingFilters(filters) {
  _currentFilters = filters;
}

/** Stop the polling loop. */
export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/** Format a millisecond latency value for display. */
export function formatLatency(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Return a CSS colour class for an HTTP status code. */
export function statusClass(code) {
  if (!code) return 'status-unknown';
  if (code < 300) return 'status-2xx';
  if (code < 400) return 'status-3xx';
  if (code < 500) return 'status-4xx';
  return 'status-5xx';
}
