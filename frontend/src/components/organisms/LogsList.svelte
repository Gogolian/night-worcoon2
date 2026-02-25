<script>
  import { createEventDispatcher } from 'svelte';
  import { statusClass, formatLatency, pendingMockEntry } from '../../stores/logs.js';
  import { currentRoute } from '../../stores/router.js';

  const dispatch = createEventDispatcher();

  export let entries = [];
  export let selectedEntry = null;
  export let hasSelection = false;

  function handleClick(entry) {
    dispatch('entrySelect', entry.id === selectedEntry?.id ? null : entry);
  }

  function handleMock(event, entry) {
    event.stopPropagation();
    pendingMockEntry.set(entry);
    currentRoute.set('plugin-mock');
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function shortUrl(url) {
    try {
      const u = new URL(url, 'http://x');
      return u.pathname + (u.search || '');
    } catch {
      return url;
    }
  }
</script>

<div class="logs-list-wrap">
  {#if entries.length === 0}
    <div class="empty-state">
      <p>No log entries yet — send a request through the proxy to see it here.</p>
    </div>
  {:else}
    <div class="list-header row">
      <span class="col-time">Time</span>
      <span class="col-method">Method</span>
      <span class="col-url">URL</span>
      <span class="col-status">Status</span>
      <span class="col-action">Action</span>
      <span class="col-rule">Rule</span>
      <span class="col-lat">Latency</span>
      <span class="col-mock"></span>
    </div>
    <div class="entries-scroll" class:has-selection={hasSelection}>
      {#each entries as entry (entry.id)}
        <div
          class="entry-row row"
          class:selected={selectedEntry?.id === entry.id}
          class:is-error={entry.response.status >= 500}
          class:is-warn={entry.response.status >= 400 && entry.response.status < 500}
          on:click={() => handleClick(entry)}
          on:keydown={(e) => e.key === 'Enter' && handleClick(entry)}
          role="button"
          tabindex="0"
        >
          <span class="col-time dim">{fmtTime(entry.timestamp)}</span>
          <span class="col-method">
            <span class="method-badge method-{entry.request.method.toLowerCase()}">{entry.request.method}</span>
          </span>
          <span class="col-url url-text" title={entry.request.url}>{shortUrl(entry.request.url)}</span>
          <span class="col-status">
            <span class="status-badge {statusClass(entry.response.status)}">{entry.response.status}</span>
          </span>
          <span class="col-action">
            {#if entry.appInfo.action === 'mock'}
              <span class="action-badge mock">Mock</span>
            {:else}
              <span class="action-badge proxy">Proxy</span>
            {/if}
          </span>
          <span class="col-rule dim" title={entry.appInfo.ruleMatched || ''}>{entry.appInfo.ruleMatched || '—'}</span>
          <span class="col-lat dim">{formatLatency(entry.latency)}</span>
          <span class="col-mock">
            <button class="mock-btn" on:click={(e) => handleMock(e, entry)} title="Create mock rule from this entry">Mock</button>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .logs-list-wrap {
    background: #0b0f2a;
    border: 1px solid #1a2847;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 8px;
    position: relative;
  }

  .empty-state {
    padding: 24px;
    text-align: center;
    color: #4b5563;
    font-size: 12px;
  }

  .row {
    display: grid;
    grid-template-columns: 90px 72px 1fr 64px 60px 140px 66px 52px;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
  }

  .list-header {
    background: #0f1535;
    border-bottom: 1px solid #1a2847;
    padding-top: 6px;
    padding-bottom: 6px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4b5563;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .entries-scroll {
    max-height: 560px;
    overflow-y: auto;
    transition: max-height 0.2s ease;
  }
  .entries-scroll.has-selection {
    max-height: 240px;
  }

  .entry-row {
    border-bottom: 1px solid #111827;
    padding-top: 5px;
    padding-bottom: 5px;
    cursor: pointer;
    transition: background 0.1s;
    font-size: 12px;
  }
  .entry-row:hover { background: #131c3a; }
  .entry-row.selected { background: #1e3a8a22; border-left: 2px solid #3b82f6; }
  .entry-row.is-error { background: #1a0a0a; }
  .entry-row.is-error:hover { background: #1f1010; }
  .entry-row.is-warn { background: #1a1200; }

  .dim { color: #6b7280; }

  .url-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #c7d2fe;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 11px;
  }

  /* HTTP method badges */
  .method-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    font-family: monospace;
  }
  .method-get    { background: #0c2a1a; color: #4ade80; border: 1px solid #14532d; }
  .method-post   { background: #0c1a2a; color: #60a5fa; border: 1px solid #1e3a5f; }
  .method-put    { background: #2a1a0c; color: #fb923c; border: 1px solid #7c2d12; }
  .method-patch  { background: #1a1a0c; color: #facc15; border: 1px solid #713f12; }
  .method-delete { background: #2a0c0c; color: #f87171; border: 1px solid #7f1d1d; }
  .method-options,.method-head { background: #1a1a2a; color: #a78bfa; border: 1px solid #3730a3; }

  /* Status badges */
  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: monospace;
  }
  :global(.status-2xx)     { background: #0c2a1a; color: #4ade80; }
  :global(.status-3xx)     { background: #0c1a2a; color: #60a5fa; }
  :global(.status-4xx)     { background: #2a1a0c; color: #fb923c; }
  :global(.status-5xx)     { background: #2a0c0c; color: #f87171; }
  :global(.status-unknown) { background: #1a1a1a; color: #6b7280; }

  /* Action badges */
  .action-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 3px;
    letter-spacing: 0.05em;
  }
  .action-badge.mock  { background: #0c2a1a; color: #4ade80; border: 1px solid #14532d; }
  .action-badge.proxy { background: #1a1a3a; color: #818cf8; border: 1px solid #3730a3; }

  .col-rule {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11px;
  }
  .col-lat { text-align: right; font-family: monospace; font-size: 11px; }

  .mock-btn {
    background: #1a1a3a;
    border: 1px solid #4c1d95;
    color: #a78bfa;
    padding: 2px 7px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .mock-btn:hover {
    background: #2e1065;
    border-color: #7c3aed;
    color: #c4b5fd;
  }
</style>
