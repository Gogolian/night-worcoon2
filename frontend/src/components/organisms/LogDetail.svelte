<script>
  import { statusClass, formatLatency } from '../../stores/logs.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let entry = null;

  let activeTab = 'request'; // 'request' | 'response' | 'app'
  let headersExpanded = true;
  let bodyExpanded = true;

  $: if (entry) activeTab = 'request';

  function tryPrettyJson(str) {
    if (!str) return null;
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }

  function fmtTimestamp(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }) + '.' + String(new Date(iso).getMilliseconds()).padStart(3, '0');
  }

  function mockSourceLabel(src) {
    if (!src) return '—';
    if (src === 'recording') return 'Recording file';
    if (src === 'fallback')  return 'Fallback (no recording)';
    return src;
  }

  function headerValues(value) {
    return Array.isArray(value) ? value : [value];
  }
</script>

{#if entry}
<div class="log-detail">
  <div class="detail-header">
    <div class="header-left">
      <span class="method-badge method-{entry.request.method.toLowerCase()}">{entry.request.method}</span>
      <span class="detail-url" title={entry.request.url}>{entry.request.url}</span>
    </div>
    <div class="header-right">
      <span class="status-badge {statusClass(entry.response.status)}">{entry.response.status}</span>
      <span class="latency-badge">{formatLatency(entry.latency)}</span>
      {#if entry.appInfo.action === 'mock'}
        <span class="action-badge mock">Mock</span>
      {:else}
        <span class="action-badge proxy">Proxy</span>
      {/if}
      <span class="dim ts">{fmtTimestamp(entry.timestamp)}</span>
      <button class="close-btn" on:click={() => dispatch('close')} title="Close">✕</button>
    </div>
  </div>

  <div class="detail-tabs">
    <button class="tab" class:active={activeTab === 'request'}  on:click={() => activeTab = 'request'} >Request</button>
    <button class="tab" class:active={activeTab === 'response'} on:click={() => activeTab = 'response'}>Response</button>
    <button class="tab" class:active={activeTab === 'app'}      on:click={() => activeTab = 'app'}     >App Info</button>
  </div>

  <div class="detail-body">
    <!-- REQUEST TAB -->
    {#if activeTab === 'request'}
      <div class="section">
        <button class="section-title" on:click={() => headersExpanded = !headersExpanded}>
          <span class="chevron">{headersExpanded ? '▾' : '▸'}</span> Headers
        </button>
        {#if headersExpanded}
          <div class="headers-table">
            {#each Object.entries(entry.request.headers || {}) as [k, v]}
              <div class="header-row">
                <span class="header-key">{k}</span>
                <span class="header-val">
                  {#each headerValues(v) as value, index (index)}
                    <span class="header-val-line">{value}</span>
                  {/each}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="section">
        <button class="section-title" on:click={() => bodyExpanded = !bodyExpanded}>
          <span class="chevron">{bodyExpanded ? '▾' : '▸'}</span> Body
          {#if entry.request.body}
            <span class="byte-count">{entry.request.body.length} chars</span>
          {/if}
        </button>
        {#if bodyExpanded}
          {#if entry.request.body}
            <pre class="body-pre">{tryPrettyJson(entry.request.body)}</pre>
          {:else}
            <p class="empty-body">No body</p>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- RESPONSE TAB -->
    {#if activeTab === 'response'}
      <div class="section">
        <button class="section-title" on:click={() => headersExpanded = !headersExpanded}>
          <span class="chevron">{headersExpanded ? '▾' : '▸'}</span> Headers
        </button>
        {#if headersExpanded}
          <div class="headers-table">
            {#each Object.entries(entry.response.headers || {}) as [k, v]}
              <div class="header-row">
                <span class="header-key">{k}</span>
                <span class="header-val">
                  {#each headerValues(v) as value, index (index)}
                    <span class="header-val-line">{value}</span>
                  {/each}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="section">
        <button class="section-title" on:click={() => bodyExpanded = !bodyExpanded}>
          <span class="chevron">{bodyExpanded ? '▾' : '▸'}</span> Body
          {#if entry.response.size != null}
            <span class="byte-count">{entry.response.size} bytes</span>
          {/if}
        </button>
        {#if bodyExpanded}
          {#if entry.response.body}
            <pre class="body-pre">{tryPrettyJson(entry.response.body)}</pre>
          {:else}
            <p class="empty-body">No body</p>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- APP INFO TAB -->
    {#if activeTab === 'app'}
      <div class="app-info-grid">
        <div class="info-row">
          <span class="info-key">Action</span>
          <span class="info-val">
            {#if entry.appInfo.action === 'mock'}
              <span class="action-badge mock">Mock</span>
            {:else}
              <span class="action-badge proxy">Proxy</span>
            {/if}
          </span>
        </div>
        <div class="info-row">
          <span class="info-key">Rule matched</span>
          <span class="info-val code">{entry.appInfo.ruleMatched ?? '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Mock source</span>
          <span class="info-val">{mockSourceLabel(entry.appInfo.mockSource)}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Latency</span>
          <span class="info-val code">{formatLatency(entry.latency)}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Status</span>
          <span class="info-val">
            <span class="status-badge {statusClass(entry.response.status)}">{entry.response.status}</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-key">Response size</span>
          <span class="info-val code">{entry.response.size != null ? entry.response.size + ' bytes' : '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Timestamp</span>
          <span class="info-val code">{fmtTimestamp(entry.timestamp)}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Entry ID</span>
          <span class="info-val code dim">{entry.id}</span>
        </div>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .log-detail {
    background: #0b0f2a;
    border: 1px solid #1a2847;
    border-radius: 6px;
    overflow: hidden;
    animation: slideIn 0.15s ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #0f1535;
    border-bottom: 1px solid #1a2847;
    gap: 8px;
    flex-wrap: wrap;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .detail-url {
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 12px;
    color: #c7d2fe;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ts { font-size: 11px; font-family: monospace; }
  .dim { color: #6b7280; }

  .close-btn {
    background: transparent;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 13px;
    padding: 2px 4px;
    border-radius: 3px;
    transition: color 0.15s;
  }
  .close-btn:hover { color: #f87171; }

  /* Method / status / action badges — shared with LogsList */
  .method-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    font-family: monospace;
    flex-shrink: 0;
  }
  .method-get    { background: #0c2a1a; color: #4ade80; border: 1px solid #14532d; }
  .method-post   { background: #0c1a2a; color: #60a5fa; border: 1px solid #1e3a5f; }
  .method-put    { background: #2a1a0c; color: #fb923c; border: 1px solid #7c2d12; }
  .method-patch  { background: #1a1a0c; color: #facc15; border: 1px solid #713f12; }
  .method-delete { background: #2a0c0c; color: #f87171; border: 1px solid #7f1d1d; }
  .method-options,.method-head { background: #1a1a2a; color: #a78bfa; border: 1px solid #3730a3; }

  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
  }
  :global(.status-2xx)     { background: #0c2a1a; color: #4ade80; }
  :global(.status-3xx)     { background: #0c1a2a; color: #60a5fa; }
  :global(.status-4xx)     { background: #2a1a0c; color: #fb923c; }
  :global(.status-5xx)     { background: #2a0c0c; color: #f87171; }
  :global(.status-unknown) { background: #1a1a1a; color: #6b7280; }

  .latency-badge {
    font-size: 11px;
    color: #fbbf24;
    font-family: monospace;
  }

  .action-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 3px;
    letter-spacing: 0.05em;
  }
  .action-badge.mock  { background: #0c2a1a; color: #4ade80; border: 1px solid #14532d; }
  .action-badge.proxy { background: #1a1a3a; color: #818cf8; border: 1px solid #3730a3; }

  /* Tabs */
  .detail-tabs {
    display: flex;
    background: #0f1535;
    border-bottom: 1px solid #1a2847;
  }
  .tab {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #6b7280;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab:hover { color: #d4d4d8; }
  .tab.active { color: #60a5fa; border-bottom-color: #3b82f6; }

  /* Body */
  .detail-body {
    padding: 10px 12px;
    max-height: 420px;
    overflow-y: auto;
  }

  .section { margin-bottom: 10px; }
  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    padding: 4px 0;
    margin-bottom: 4px;
    font-family: inherit;
    transition: color 0.15s;
  }
  .section-title:hover { color: #d4d4d8; }
  .chevron { font-size: 10px; }
  .byte-count { color: #4b5563; font-size: 10px; font-weight: 400; }

  .headers-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 4px;
    max-height: 180px;
    overflow-y: auto;
    background: #060912;
    border: 1px solid #1a2847;
    border-radius: 4px;
    padding: 4px 8px;
  }
  .header-row {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 8px;
    font-size: 11px;
    font-family: monospace;
    padding: 1px 0;
    border-bottom: 1px solid #0e1530;
  }
  .header-row:last-child { border-bottom: none; }
  .header-key { color: #818cf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header-val {
    color: #c7d2fe;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .header-val-line { white-space: normal; word-break: break-all; }

  .body-pre {
    background: #060912;
    border: 1px solid #1a2847;
    border-radius: 4px;
    padding: 8px;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 11px;
    color: #a5f3fc;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 300px;
    overflow-y: auto;
    margin: 0;
  }
  .empty-body {
    color: #4b5563;
    font-size: 12px;
    padding: 4px 0;
  }

  /* App info grid */
  .app-info-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .info-row {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 8px;
    font-size: 12px;
    padding: 5px 8px;
    background: #060912;
    border: 1px solid #0e1530;
    border-radius: 4px;
    align-items: center;
  }
  .info-key { color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .info-val { color: #e0e0e0; }
  .info-val.code { font-family: monospace; color: #c7d2fe; }
</style>
