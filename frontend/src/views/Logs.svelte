<script>
  import { onMount, onDestroy } from 'svelte';
  import LogsControls from '../components/molecules/LogsControls.svelte';
  import LogsList from '../components/organisms/LogsList.svelte';
  import LogDetail from '../components/organisms/LogDetail.svelte';
  import { toast } from '../stores/toast.js';
  import {
    logEntries, logTotal,
    urlFilter, methodFilter, statusFilter, actionFilter,
    startPolling, stopPolling, updatePollingFilters, clearLogs
  } from '../stores/logs.js';

  let selectedEntry = null;

  function currentFilters() {
    return {
      url:    $urlFilter    || undefined,
      method: $methodFilter || undefined,
      status: $statusFilter || undefined,
      action: $actionFilter || undefined
    };
  }

  onMount(() => {
    startPolling(currentFilters());
  });

  onDestroy(() => {
    stopPolling();
  });

  // Reactively update the polling filters whenever a filter store changes
  $: {
    // Touch all four stores so Svelte tracks them
    const f = {
      url:    $urlFilter    || undefined,
      method: $methodFilter || undefined,
      status: $statusFilter || undefined,
      action: $actionFilter || undefined
    };
    updatePollingFilters(f);
  }

  async function handleClear() {
    try {
      await clearLogs();
      selectedEntry = null;
      toast.show('Logs cleared', 'success');
    } catch {
      toast.show('Failed to clear logs', 'error');
    }
  }

  function handleEntrySelect(event) {
    const entry = event.detail;
    selectedEntry = entry; // null means deselect
  }

  function handleDetailClose() {
    selectedEntry = null;
  }
</script>

<div class="logs-view">
  <h1>Logs</h1>

  <LogsControls
    totalCount={$logTotal}
    onClear={handleClear}
  />

  <LogsList
    entries={$logEntries}
    bind:selectedEntry={selectedEntry}
    hasSelection={selectedEntry !== null}
    on:entrySelect={handleEntrySelect}
  />

  {#if selectedEntry}
    <LogDetail
      entry={selectedEntry}
      on:close={handleDetailClose}
    />
  {/if}
</div>

<style>
  .logs-view {
    max-width: 1250px;
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  h1 {
    color: #e0e0e0;
    font-size: 16px;
    margin: 0 0 10px 0;
    font-weight: 600;
  }
</style>
