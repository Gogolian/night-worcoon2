<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import * as ace from 'ace-builds';
  import HttpMethodSelector from '../components/molecules/HttpMethodSelector.svelte';
  import MatchRecordingUrlInput from '../components/atoms/MatchRecordingUrlInput.svelte';
  import {
    requestMethod, requestPath, requestHeaders, requestBody,
    response, loading, requestError, requestTarget,
    fetchActiveHeaders, sendRequest
  } from '../stores/requester.js';

  // ── Ace – request body ─────────────────────────────────────────────────────
  let reqBodyContainer;
  let reqEditor   = null;
  let reqEditorInit = false;
  let reqDebounce = null;

  // ── Ace – response body ────────────────────────────────────────────────────
  let resBodyContainer;
  let resEditor  = null;
  let resEditorInit = false;

  // ── computed ───────────────────────────────────────────────────────────────
  $: noBodyMethods = ['GET', 'HEAD', 'OPTIONS'].includes($requestMethod);

  // When switching to a no-body method, destroy the body editor
  $: if (noBodyMethods && reqEditorInit) {
    destroyReqEditor();
  }

  onMount(() => {
    fetchActiveHeaders();
  });

  onDestroy(() => {
    destroyReqEditor();
    destroyResEditor();
    clearTimeout(reqDebounce);
  });

  // ── Request body editor ────────────────────────────────────────────────────

  afterUpdate(() => {
    if (!noBodyMethods && reqBodyContainer && !reqEditorInit) {
      initReqEditor();
    }
    if (resBodyContainer && $response && !resEditorInit) {
      initResEditor($response.body);
    }
  });

  function initReqEditor() {
    if (reqEditorInit || !reqBodyContainer) return;
    ace.config.set('basePath', 'https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/src-noconflict/');
    reqEditor = ace.edit(reqBodyContainer);
    reqEditor.setTheme('ace/theme/monokai');
    reqEditor.session.setMode('ace/mode/json');
    reqEditor.setFontSize(12);
    reqEditor.setOptions({ showPrintMargin: false, highlightActiveLine: true, wrap: true, tabSize: 2 });
    reqEditor.setValue($requestBody, -1);
    reqEditor.session.on('change', () => {
      clearTimeout(reqDebounce);
      reqDebounce = setTimeout(() => {
        requestBody.set(reqEditor.getValue());
      }, 300);
    });
    reqEditorInit = true;
  }

  function destroyReqEditor() {
    if (reqEditor) { reqEditor.destroy(); reqEditor = null; }
    reqEditorInit = false;
  }

  // ── Response body editor ────────────────────────────────────────────────────

  function initResEditor(raw) {
    if (resEditorInit || !resBodyContainer) return;
    ace.config.set('basePath', 'https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/src-noconflict/');
    resEditor = ace.edit(resBodyContainer);
    resEditor.setTheme('ace/theme/monokai');
    resEditor.setFontSize(12);
    resEditor.setOptions({ showPrintMargin: false, highlightActiveLine: false, wrap: true, tabSize: 2, readOnly: true });
    setResEditorContent(raw);
    resEditorInit = true;
  }

  function setResEditorContent(raw) {
    if (!resEditor) return;
    let pretty = raw;
    let mode = 'ace/mode/text';
    try {
      const parsed = JSON.parse(raw);
      pretty = JSON.stringify(parsed, null, 2);
      mode = 'ace/mode/json';
    } catch {}
    resEditor.session.setMode(mode);
    resEditor.setValue(pretty, -1);
  }

  function destroyResEditor() {
    if (resEditor) { resEditor.destroy(); resEditor = null; }
    resEditorInit = false;
  }

  // When response changes, update (or reinit) response editor
  $: if ($response !== null && resEditorInit && resEditor) {
    setResEditorContent($response.body ?? '');
  }
  $: if ($response !== null) {
    // Force re-init on next afterUpdate tick when response arrives
    destroyResEditor();
  }

  // ── Headers table helpers ──────────────────────────────────────────────────

  function addHeaderRow() {
    requestHeaders.update(rows => [...rows, { key: '', value: '', enabled: true }]);
  }

  function removeHeaderRow(i) {
    requestHeaders.update(rows => rows.filter((_, idx) => idx !== i));
  }

  function updateHeader(i, field, val) {
    requestHeaders.update(rows => {
      const updated = [...rows];
      updated[i] = { ...updated[i], [field]: val };
      // Auto-add a new empty row when the last row gets a key
      if (field === 'key' && val.trim() && i === rows.length - 1) {
        updated.push({ key: '', value: '', enabled: true });
      }
      return updated;
    });
  }

  // ── Status badge colour ────────────────────────────────────────────────────

  function statusClass(code) {
    if (!code) return 'status-unknown';
    if (code < 300) return 'status-2xx';
    if (code < 400) return 'status-3xx';
    if (code < 500) return 'status-4xx';
    return 'status-5xx';
  }

  // ── keyboard shortcut ──────────────────────────────────────────────────────

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendRequest();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="post-view">
  <h1>POST <span class="subtitle">— Request Client</span></h1>

  <!-- ── Target selector ───────────────────────────────────────── -->
  <div class="target-bar">
    <span class="target-label">Send to</span>
    <div class="target-toggle">
      <button
        class="target-btn"
        class:active={$requestTarget === 'proxy'}
        on:click={() => requestTarget.set('proxy')}
        title="Forward request to the configured target URL (end system)"
      >
        ↗️ End System
      </button>
      <button
        class="target-btn target-btn--local"
        class:active={$requestTarget === 'local'}
        on:click={() => requestTarget.set('local')}
        title="Send directly to NightWorcoon — plugin pipeline runs (bucket, mock, recorder…)"
      >
        ⚡ NightWorcoon
      </button>
    </div>
    {#if $requestTarget === 'local'}
      <span class="target-hint">Runs through plugin pipeline — bucket, mock &amp; recorder are active</span>
    {:else}
      <span class="target-hint">Bypasses plugins — goes straight to configured target URL</span>
    {/if}
  </div>

  <!-- ── URL bar ─────────────────────────────────────────────── -->
  <div class="url-bar" class:url-bar--local={$requestTarget === 'local'}>
    <div class="method-wrap">
      <HttpMethodSelector
        selected={$requestMethod}
        multiple={false}
        onChange={(m) => requestMethod.set(m)}
      />
    </div>

    <div class="path-wrap">
      <MatchRecordingUrlInput
        value={$requestPath}
        onInput={(e) => requestPath.set(e.target.value)}
        showFiles={false}
      />
    </div>

    <button
      class="send-btn"
      class:loading={$loading}
      disabled={$loading}
      on:click={sendRequest}
    >
      {#if $loading}
        <span class="spinner"></span> Sending…
      {:else}
        ▶ Send
      {/if}
    </button>
  </div>

  {#if $requestError}
    <div class="error-bar">{$requestError}</div>
  {/if}

  <div class="panels">
    <!-- ── Request panel ──────────────────────────────────────────────────── -->
    <div class="panel request-panel">

      {#if !noBodyMethods}
        <!-- Body section -->
        <div class="section-label">Body</div>
        <div class="req-ace-wrap" bind:this={reqBodyContainer}></div>
      {/if}

      <!-- Headers section -->
      <div class="section-label">
        Headers
        <span class="tab-count">{$requestHeaders.filter(h => h.enabled && h.key.trim()).length}</span>
      </div>
      <div class="headers-table">
        <div class="headers-table-head">
          <span class="col-en"></span>
          <span class="col-key">Key</span>
          <span class="col-val">Value</span>
          <span class="col-del"></span>
        </div>
        {#each $requestHeaders as row, i}
          <div class="header-row">
            <input
              type="checkbox"
              class="hdr-check"
              checked={row.enabled}
              on:change={(e) => updateHeader(i, 'enabled', e.target.checked)}
            />
            <input
              type="text"
              class="hdr-input hdr-key"
              placeholder="Header name"
              value={row.key}
              on:input={(e) => updateHeader(i, 'key', e.target.value)}
            />
            <input
              type="text"
              class="hdr-input hdr-val"
              placeholder="Value"
              value={row.value}
              on:input={(e) => updateHeader(i, 'value', e.target.value)}
            />
            {#if i < $requestHeaders.length - 1}
              <button class="hdr-del" on:click={() => removeHeaderRow(i)} title="Remove">✕</button>
            {:else}
              <span class="hdr-del-placeholder"></span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
    <!-- ── Response panel ─────────────────────────────────────────────────── -->
    <div class="panel response-panel">
      {#if !$response && !$loading}
        <div class="res-placeholder">
          <span class="placeholder-icon">⚡</span>
          <span>Send a request to see the response</span>
          <span class="shortcut-hint">Ctrl+Enter to send</span>
        </div>
      {:else if $loading}
        <div class="res-placeholder">
          <span class="placeholder-icon spin">⏳</span>
          <span>Waiting for response…</span>
        </div>
      {:else if $response}
        <div class="res-meta">
          <span class="status-badge {statusClass($response.status)}">{$response.status}</span>
          <span class="status-text">{$response.statusText ?? ''}</span>
          <span class="latency">{$response.latency} ms</span>
        </div>
        {#if $response.url}
          <div class="res-url" title={$response.url}>{$response.url}</div>
        {/if}

        <div class="section-label">Body</div>
        <div class="res-ace-wrap" bind:this={resBodyContainer}></div>

        <div class="section-label">
          Headers
          <span class="tab-count">{Object.keys($response.headers ?? {}).length}</span>
        </div>
        <div class="res-headers-table">
          {#each Object.entries($response.headers ?? {}) as [k, v]}
            <div class="res-header-row">
              <span class="res-hdr-key">{k}</span>
              <span class="res-hdr-val">{v}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .post-view {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    overflow: hidden;
  }

  h1 {
    font-size: 18px;
    font-weight: 700;
    color: #e0e0e0;
    margin: 0;
  }

  .subtitle {
    font-size: 13px;
    font-weight: 400;
    color: #6b7280;
  }

  /* ── Target selector ────────────────────────────────────────────── */
  .target-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .target-label {
    font-size: 11px;
    font-weight: 700;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  .target-toggle {
    display: flex;
    border: 1px solid #1a2847;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .target-btn {
    padding: 5px 14px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    border: none;
    background: #0d1626;
    color: #4b5563;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .target-btn:not(:last-child) {
    border-right: 1px solid #1a2847;
  }

  .target-btn:hover {
    background: #1a2847;
    color: #9ca3af;
  }

  .target-btn.active {
    background: #1a2847;
    color: #d4d4d8;
  }

  /* NightWorcoon button — highlighted amber when active (signals "plugin pipeline") */
  .target-btn--local.active {
    background: #451a03;
    color: #fbbf24;
    border-color: #92400e;
  }

  .target-hint {
    font-size: 11px;
    color: #4b5563;
    font-style: italic;
  }

  /* ── URL bar ──────────────────────────────────────────────── */
  .url-bar {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  /* Amber left-border accent when targeting NightWorcoon */
  .url-bar--local {
    border-left: 3px solid #b45309;
    padding-left: 10px;
  }

  .method-wrap {
    flex-shrink: 0;
  }

  .path-wrap {
    flex: 1;
    min-width: 0;
  }

  .send-btn {
    flex-shrink: 0;
    padding: 8px 20px;
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(96, 165, 250, 0.35);
    white-space: nowrap;
  }

  .send-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner {
    width: 12px; height: 12px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    display: inline-block;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .error-bar {
    background: #450a0a;
    border: 1px solid #7f1d1d;
    color: #fca5a5;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 12px;
  }

  /* ── Panels ─────────────────────────────────────────────────────────────── */
  .panels {
    display: flex;
    gap: 12px;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    background: #0f1535;
    border: 2px solid #1a2847;
    border-radius: 4px;
    overflow: hidden;
    min-width: 0;
  }

  .request-panel {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px;
    gap: 8px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0 2px;
    flex-shrink: 0;
  }

  .req-ace-wrap {
    height: 220px;
    border: 1px solid #1a2847;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    margin-bottom: 8px;
  }

  .tab-count {
    background: #1a2847;
    color: #9ca3af;
    border-radius: 10px;
    padding: 1px 6px;
    font-size: 10px;
  }

  /* ── Headers table ───────────────────────────────────────────────────────── */
  .headers-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .headers-table-head {
    display: grid;
    grid-template-columns: 20px 1fr 1fr 22px;
    gap: 6px;
    padding: 4px 2px;
    font-size: 10px;
    font-weight: 600;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .header-row {
    display: grid;
    grid-template-columns: 20px 1fr 1fr 22px;
    gap: 6px;
    align-items: center;
  }

  .hdr-check {
    accent-color: #60a5fa;
    width: 14px;
    height: 14px;
    cursor: pointer;
    justify-self: center;
  }

  .hdr-input {
    padding: 5px 8px;
    background: #1a2847;
    border: 1px solid #374151;
    border-radius: 3px;
    color: #d4d4d8;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    min-width: 0;
    transition: border-color 0.15s;
  }

  .hdr-input:focus { outline: none; border-color: #60a5fa; }
  .hdr-input::placeholder { color: #4b5563; }

  .hdr-del {
    background: transparent;
    border: none;
    color: #4b5563;
    font-size: 11px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    transition: color 0.15s, background 0.15s;
    justify-self: center;
  }

  .hdr-del:hover { color: #f87171; background: #2d1515; }
  .hdr-del-placeholder { width: 22px; }

  /* ── Ace ─────────────────────────────────────────────────────────────────── */
  .ace-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Response panel ──────────────────────────────────────────────────────── */
  .res-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #4b5563;
    font-size: 13px;
  }

  .placeholder-icon { font-size: 28px; }
  .shortcut-hint {
    font-size: 11px;
    color: #374151;
    background: #0a0e27;
    border: 1px solid #1a2847;
    padding: 2px 8px;
    border-radius: 10px;
    margin-top: 4px;
  }

  .spin { display: inline-block; animation: spin 1s linear infinite; }

  .res-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0 4px;
    flex-shrink: 0;
  }

  .res-url {
    font-size: 11px;
    font-family: 'Courier New', monospace;
    color: #4b5563;
    word-break: break-all;
    padding-bottom: 6px;
    flex-shrink: 0;
  }

  .status-badge {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
  }

  .status-2xx { background: #052e16; color: #4ade80; border: 1px solid #166534; }
  .status-3xx { background: #172554; color: #93c5fd; border: 1px solid #1e40af; }
  .status-4xx { background: #431407; color: #fb923c; border: 1px solid #9a3412; }
  .status-5xx { background: #450a0a; color: #f87171; border: 1px solid #7f1d1d; }
  .status-unknown { background: #1a2847; color: #9ca3af; border: 1px solid #374151; }

  .status-text {
    font-size: 12px;
    color: #9ca3af;
  }

  .latency {
    margin-left: auto;
    font-size: 11px;
    color: #6b7280;
    font-family: monospace;
  }

  .response-panel {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 12px 12px;
    gap: 8px;
  }

  .res-ace-wrap {
    height: 240px;
    border: 1px solid #1a2847;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    margin-bottom: 8px;
  }

  .res-headers-table {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex-shrink: 0;
  }

  .res-header-row {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 3px;
    font-size: 12px;
    font-family: 'Courier New', monospace;
  }

  .res-header-row:hover { background: #1a2847; }

  .res-hdr-key {
    color: #60a5fa;
    word-break: break-all;
    flex-shrink: 0;
  }

  .res-hdr-val {
    color: #d4d4d8;
    word-break: break-all;
  }
</style>
