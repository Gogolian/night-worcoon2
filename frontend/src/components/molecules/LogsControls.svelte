<script>
  import { urlFilter, methodFilter, statusFilter, actionFilter, logStats, updatePollingFilters } from '../../stores/logs.js';

  export let totalCount = 0;
  export let onClear;

  const methods = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  const statuses = [
    { value: '',    label: 'All statuses' },
    { value: '2xx', label: '2xx Success' },
    { value: '3xx', label: '3xx Redirect' },
    { value: '4xx', label: '4xx Client Error' },
    { value: '5xx', label: '5xx Server Error' }
  ];

  // Propagate filter changes to the polling loop
  function onFilterChange() {
    updatePollingFilters({
      url:    $urlFilter    || undefined,
      method: $methodFilter || undefined,
      status: $statusFilter || undefined,
      action: $actionFilter || undefined
    });
  }
</script>

<div class="logs-controls">
  <div class="filters">
    <input
      class="url-filter"
      type="text"
      placeholder="Filter by URL…"
      bind:value={$urlFilter}
      on:input={onFilterChange}
    />

    <select bind:value={$methodFilter} on:change={onFilterChange} class="method-select">
      {#each methods as m}
        <option value={m}>{m || 'All methods'}</option>
      {/each}
    </select>

    <select bind:value={$statusFilter} on:change={onFilterChange} class="status-select">
      {#each statuses as s}
        <option value={s.value}>{s.label}</option>
      {/each}
    </select>

    <div class="action-toggle">
      <button
        class="toggle-btn"
        class:active={$actionFilter === ''}
        on:click={() => { actionFilter.set(''); onFilterChange(); }}
      >All</button>
      <button
        class="toggle-btn mock-btn"
        class:active={$actionFilter === 'mock'}
        on:click={() => { actionFilter.set('mock'); onFilterChange(); }}
      >Mock</button>
      <button
        class="toggle-btn proxy-btn"
        class:active={$actionFilter === 'proxy'}
        on:click={() => { actionFilter.set('proxy'); onFilterChange(); }}
      >Proxy</button>
    </div>
  </div>

  <div class="right-controls">
    <div class="stats-strip">
      <span class="stat" title="Total entries in buffer">{$logStats.total} total</span>
      <span class="stat mock" title="Mocked requests">{$logStats.mocked} mock</span>
      <span class="stat proxy" title="Proxied requests">{$logStats.proxied} proxy</span>
      <span class="stat error" title="5xx responses">{$logStats.errors} err</span>
      <span class="stat latency" title="Average latency">{$logStats.avgLatency}ms avg</span>
    </div>
    <button class="clear-btn" on:click={onClear} title="Clear all logs">Clear</button>
  </div>
</div>

<style>
  .logs-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    flex-wrap: wrap;
  }

  .url-filter {
    flex: 1;
    min-width: 160px;
    background: #0f1535;
    border: 1px solid #1a2847;
    color: #e0e0e0;
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
  }
  .url-filter:focus {
    outline: none;
    border-color: #3b82f6;
  }
  .url-filter::placeholder { color: #4b5563; }

  .method-select, .status-select {
    background: #0f1535;
    border: 1px solid #1a2847;
    color: #e0e0e0;
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
  }
  .method-select:focus, .status-select:focus { outline: none; border-color: #3b82f6; }

  .action-toggle {
    display: flex;
    border: 1px solid #1a2847;
    border-radius: 4px;
    overflow: hidden;
  }
  .toggle-btn {
    background: #0f1535;
    border: none;
    color: #9ca3af;
    padding: 5px 10px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }
  .toggle-btn + .toggle-btn { border-left: 1px solid #1a2847; }
  .toggle-btn:hover { background: #1a2847; color: #d4d4d8; }
  .toggle-btn.active { background: #1e3a8a; color: #60a5fa; }
  .toggle-btn.mock-btn.active { background: #1a3a1a; color: #4ade80; }
  .toggle-btn.proxy-btn.active { background: #1a1a3a; color: #818cf8; }

  .right-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .stats-strip {
    display: flex;
    gap: 8px;
    font-size: 11px;
  }
  .stat { color: #6b7280; }
  .stat.mock   { color: #4ade80; }
  .stat.proxy  { color: #818cf8; }
  .stat.error  { color: #f87171; }
  .stat.latency { color: #fbbf24; }

  .clear-btn {
    background: #1a1a30;
    border: 1px solid #374151;
    color: #9ca3af;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }
  .clear-btn:hover { background: #2d1515; border-color: #f87171; color: #f87171; }
</style>
