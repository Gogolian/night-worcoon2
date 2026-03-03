<script>
  import { onMount } from 'svelte';
  import { plugins, togglePlugin } from '../../stores/plugins.js';
  import PluginHeader from '../../components/organisms/PluginHeader.svelte';
  import PluginSection from '../../components/molecules/PluginSection.svelte';
  import Card from '../../components/molecules/Card.svelte';
  import Button from '../../components/atoms/Button.svelte';
  import Input from '../../components/atoms/Input.svelte';
  import Badge from '../../components/atoms/Badge.svelte';
  import DeleteButton from '../../components/atoms/DeleteButton.svelte';

  $: plugin = $plugins.find(p => p.name === 'bucket');

  // ── State ─────────────────────────────────────────────────────────────────────

  let collections = [];          // [{ path, idPattern, resourceCount }]
  let bucketData = {};           // { [path]: [resource, ...] }

  let selectedDataIndex = 0;     // which collection is shown in the data viewer
  let editingResource = null;    // { collectionIndex, id, jsonText } | null
  let editError = '';

  const ID_PATTERNS = ['uuid', 'numeric', 'alphanumeric', 'custom'];

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  onMount(async () => {
    await loadCollections();
    await loadData();
  });

  // ── API helpers ───────────────────────────────────────────────────────────────

  async function loadCollections() {
    try {
      const res = await fetch('/__api/bucket/collections');
      const data = await res.json();
      collections = data.collections || [];
    } catch (err) {
      console.error('Bucket: failed to load collections', err);
    }
  }

  async function loadData() {
    try {
      const res = await fetch('/__api/bucket/data');
      bucketData = await res.json();
    } catch (err) {
      console.error('Bucket: failed to load data', err);
    }
  }

  async function saveCollection(index) {
    const col = collections[index];
    try {
      await fetch(`/__api/bucket/collections/${index}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: col.path, idPattern: col.idPattern })
      });
      await loadCollections();
    } catch (err) {
      console.error('Bucket: failed to save collection', err);
    }
  }

  async function addCollection() {
    try {
      const res = await fetch('/__api/bucket/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/api/new-collection', idPattern: 'uuid' })
      });
      if (res.ok) {
        await loadCollections();
      }
    } catch (err) {
      console.error('Bucket: failed to add collection', err);
    }
  }

  async function removeCollection(index) {
    try {
      await fetch(`/__api/bucket/collections/${index}`, { method: 'DELETE' });
      if (selectedDataIndex >= index && selectedDataIndex > 0) {
        selectedDataIndex = selectedDataIndex - 1;
      }
      await loadCollections();
      await loadData();
    } catch (err) {
      console.error('Bucket: failed to remove collection', err);
    }
  }

  async function clearCollection(index) {
    try {
      await fetch(`/__api/bucket/data/${index}`, { method: 'DELETE' });
      await loadCollections();
      await loadData();
    } catch (err) {
      console.error('Bucket: failed to clear collection', err);
    }
  }

  async function clearAllData() {
    try {
      await fetch('/__api/bucket/data', { method: 'DELETE' });
      await loadCollections();
      await loadData();
    } catch (err) {
      console.error('Bucket: failed to clear all data', err);
    }
  }

  async function deleteResource(collectionIndex, id) {
    try {
      await fetch(`/__api/bucket/data/${collectionIndex}/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      await loadCollections();
      await loadData();
    } catch (err) {
      console.error('Bucket: failed to delete resource', err);
    }
  }

  async function saveEditedResource() {
    editError = '';
    let parsed;
    try {
      parsed = JSON.parse(editingResource.jsonText);
    } catch {
      editError = 'Invalid JSON';
      return;
    }
    try {
      const res = await fetch(
        `/__api/bucket/data/${editingResource.collectionIndex}/${encodeURIComponent(editingResource.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        }
      );
      if (!res.ok) {
        const err = await res.json();
        editError = err.error || 'Save failed';
        return;
      }
      editingResource = null;
      await loadData();
    } catch (err) {
      editError = 'Request failed';
      console.error('Bucket: failed to save resource', err);
    }
  }

  // ── Reactive helpers ──────────────────────────────────────────────────────────

  function openEditor(collectionIndex, resource) {
    editError = '';
    editingResource = {
      collectionIndex,
      id: resource.id,
      jsonText: JSON.stringify(resource, null, 2)
    };
  }

  function getResourcesForSelected() {
    if (!collections[selectedDataIndex]) return [];
    const key = collections[selectedDataIndex].path;
    return bucketData[key] || [];
  }

  function handlePatternSelect(index, pattern) {
    collections[index].idPattern = pattern;
    collections = [...collections];
    saveCollection(index);
  }

  function handlePathChange(index) {
    saveCollection(index);
  }

  async function handleToggle() {
    if (plugin) await togglePlugin(plugin.name, !plugin.enabled);
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  $: selectedResources = getResourcesForSelected();
  $: totalResources = Object.values(bucketData).reduce((sum, arr) => sum + arr.length, 0);
</script>

<div class="plugin-page">
  {#if plugin}
    <PluginHeader {plugin} onToggle={handleToggle} />

    <!-- ── Collections ─────────────────────────────────────────────────────── -->
    <PluginSection title="Collections">
      <div class="collections-list">
        {#each collections as col, i (i)}
          <div class="collection-card">
            <div class="collection-card-header">
              <span class="collection-index">#{i}</span>
              <Badge
                text="{col.resourceCount ?? 0} resource{(col.resourceCount ?? 0) === 1 ? '' : 's'}"
                variant={col.resourceCount > 0 ? 'info' : 'default'}
              />
              <div class="collection-card-actions">
                <DeleteButton on:delete={() => removeCollection(i)} />
              </div>
            </div>

            <div class="collection-field">
              <span class="field-label">Path</span>
              <Input
                placeholder="/api/resource"
                value={col.path}
                on:change={(e) => { col.path = e.target.value; handlePathChange(i); }}
              />
            </div>

            <div class="collection-field">
              <span class="field-label">ID Pattern</span>
              <div class="pattern-buttons">
                {#each ID_PATTERNS as pattern}
                  <button
                    class="pattern-btn"
                    class:active={col.idPattern === pattern}
                    on:click={() => handlePatternSelect(i, pattern)}
                  >
                    {pattern === 'uuid' ? 'UUID' :
                     pattern === 'numeric' ? 'Numeric' :
                     pattern === 'alphanumeric' ? 'Alphanumeric' : 'Custom'}
                  </button>
                {/each}
              </div>
              {#if col.idPattern !== 'uuid' && col.idPattern !== 'numeric' && col.idPattern !== 'alphanumeric'}
                <div class="custom-pattern-input">
                  <Input
                    placeholder="regexp, e.g. [A-Z]{3}-\d{4}"
                    value={col.idPattern}
                    on:change={(e) => { col.idPattern = e.target.value; saveCollection(i); }}
                  />
                  <span class="pattern-hint">Alphanumeric candidates tested against this pattern (up to 10 attempts)</span>
                </div>
              {/if}
            </div>
          </div>
        {/each}

        {#if collections.length === 0}
          <p class="empty-state">No collections configured. Add one below.</p>
        {/if}
      </div>

      <div class="add-collection-row">
        <Button variant="secondary" on:click={addCollection}>+ Add Collection</Button>
      </div>
    </PluginSection>

    <!-- ── Bucket Contents ─────────────────────────────────────────────────── -->
    <PluginSection title="Bucket Contents">
      <div class="data-viewer">
        <div class="data-viewer-toolbar">
          <div class="collection-tabs">
            {#each collections as col, i}
              <button
                class="tab-btn"
                class:active={selectedDataIndex === i}
                on:click={() => { selectedDataIndex = i; }}
              >
                {col.path}
                <span class="tab-count">{(bucketData[col.path] || []).length}</span>
              </button>
            {/each}
          </div>
          <div class="data-actions">
            {#if collections[selectedDataIndex]}
              <Button variant="danger" size="small" on:click={() => clearCollection(selectedDataIndex)}>
                Clear collection
              </Button>
            {/if}
            <Button variant="danger" size="small" on:click={clearAllData} disabled={totalResources === 0}>
              Clear all ({totalResources})
            </Button>
            <Button variant="secondary" size="small" on:click={async () => { await loadCollections(); await loadData(); }}>
              Refresh
            </Button>
          </div>
        </div>

        {#if collections.length === 0}
          <p class="empty-state">No collections configured.</p>
        {:else if selectedResources.length === 0}
          <p class="empty-state">No resources in this collection.</p>
        {:else}
          <div class="resource-list">
            {#each selectedResources as resource}
              <div class="resource-row">
                <span class="resource-id">{resource.id}</span>
                <span class="resource-preview">{JSON.stringify(resource).slice(0, 120)}{JSON.stringify(resource).length > 120 ? '…' : ''}</span>
                <div class="resource-actions">
                  <Button variant="secondary" size="small" on:click={() => openEditor(selectedDataIndex, resource)}>
                    Edit
                  </Button>
                  <DeleteButton on:delete={() => deleteResource(selectedDataIndex, resource.id)} />
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </PluginSection>

    <!-- ── About ───────────────────────────────────────────────────────────── -->
    <PluginSection title="About">
      <div class="about-content">
        <p><strong>Purpose:</strong> In-memory CRUD storage with JSON file persistence. Intercepts requests matching configured collection paths and handles POST / GET / PATCH / DELETE automatically.</p>
        <p><strong>Execution order:</strong> Runs <em>before</em> the Mock plugin. On a cache miss the request falls through to Mock, then to the proxy target.</p>
        <p><strong>POST /collection</strong> — creates a resource, returns 201 with generated ID.</p>
        <p><strong>GET /collection</strong> — returns the full list, 200.</p>
        <p><strong>GET /collection/:id</strong> — returns the resource if found; falls through to Mock/proxy if not.</p>
        <p><strong>PATCH /collection/:id</strong> — full override (keeps ID); falls through on miss.</p>
        <p><strong>DELETE /collection/:id</strong> — removes resource; falls through on miss.</p>
        <p><strong>Persistence:</strong> Data saved to <code>bucket/data.json</code> using atomic writes with 100 ms debounce.</p>
      </div>
    </PluginSection>
  {/if}
</div>

<!-- ── JSON editor modal ──────────────────────────────────────────────────── -->
{#if editingResource}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={() => (editingResource = null)}>
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Edit resource <code>{editingResource.id}</code></span>
        <button class="modal-close" on:click={() => (editingResource = null)}>✕</button>
      </div>
      <textarea
        class="json-editor"
        bind:value={editingResource.jsonText}
        spellcheck="false"
        rows="18"
      ></textarea>
      {#if editError}
        <p class="edit-error">{editError}</p>
      {/if}
      <div class="modal-footer">
        <Button variant="secondary" on:click={() => (editingResource = null)}>Cancel</Button>
        <Button variant="primary" on:click={saveEditedResource}>Save</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .plugin-page {
    padding: 16px;
    max-width: 1000px;
  }

  /* ── Collections ─────────────────────────────────────────────────────────── */
  .collections-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .collection-card {
    border: 1px solid #1a2847;
    border-radius: 4px;
    background: #0d1626;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .collection-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .collection-index {
    font-size: 11px;
    color: #6b7280;
    font-weight: 600;
    min-width: 20px;
  }

  .collection-card-actions {
    margin-left: auto;
  }

  .collection-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 11px;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  /* ── Pattern buttons ─────────────────────────────────────────────────────── */
  .pattern-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .pattern-btn {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    border: 1px solid #374151;
    border-radius: 3px;
    background: #1a2234;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .pattern-btn:hover {
    border-color: #60a5fa;
    color: #93c5fd;
  }

  .pattern-btn.active {
    background: #1d3a6e;
    border-color: #3b82f6;
    color: #93c5fd;
  }

  .custom-pattern-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
  }

  .pattern-hint {
    font-size: 10px;
    color: #6b7280;
  }

  /* ── Add collection ──────────────────────────────────────────────────────── */
  .add-collection-row {
    margin-top: 12px;
    display: flex;
    justify-content: flex-start;
  }

  /* ── Data viewer ─────────────────────────────────────────────────────────── */
  .data-viewer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .data-viewer-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .collection-tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    border: 1px solid #374151;
    border-radius: 3px;
    background: #1a2234;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    border-color: #60a5fa;
    color: #93c5fd;
  }

  .tab-btn.active {
    background: #1d3a6e;
    border-color: #3b82f6;
    color: #93c5fd;
  }

  .tab-count {
    background: #0f1535;
    color: #6b7280;
    border-radius: 10px;
    padding: 1px 5px;
    font-size: 10px;
    font-weight: 700;
  }

  .tab-btn.active .tab-count {
    color: #93c5fd;
  }

  .data-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  /* ── Resource list ───────────────────────────────────────────────────────── */
  .resource-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .resource-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    background: #0d1626;
    border: 1px solid #1a2847;
    border-radius: 3px;
    font-size: 12px;
    min-width: 0;
  }

  .resource-id {
    color: #60a5fa;
    font-weight: 600;
    font-family: monospace;
    white-space: nowrap;
    flex-shrink: 0;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .resource-preview {
    color: #6b7280;
    font-family: monospace;
    font-size: 11px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .resource-actions {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-shrink: 0;
  }

  /* ── Empty / shared ──────────────────────────────────────────────────────── */
  .empty-state {
    font-size: 13px;
    color: #6b7280;
    padding: 8px 0;
    margin: 0;
  }

  /* ── About ───────────────────────────────────────────────────────────────── */
  .about-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .about-content p {
    font-size: 13px;
    color: #d4d4d8;
    margin: 0;
    line-height: 1.6;
  }

  .about-content strong {
    color: #60a5fa;
  }

  .about-content em {
    color: #fbbf24;
    font-style: normal;
  }

  .about-content code {
    background: #1a2234;
    color: #93c5fd;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 12px;
  }

  /* ── Modal ───────────────────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: #12192b;
    border: 2px solid #1a2847;
    border-radius: 6px;
    width: 560px;
    max-width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #1a2847;
    border-bottom: 1px solid #0f1535;
  }

  .modal-title {
    font-size: 13px;
    font-weight: 600;
    color: #d4d4d8;
  }

  .modal-title code {
    color: #60a5fa;
    font-size: 12px;
  }

  .modal-close {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 2px 4px;
  }

  .modal-close:hover {
    color: #d4d4d8;
  }

  .json-editor {
    flex: 1;
    padding: 12px;
    background: #0d1626;
    color: #e0e0e0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    border: none;
    resize: none;
    line-height: 1.5;
    overflow-y: auto;
  }

  .json-editor:focus {
    outline: none;
  }

  .edit-error {
    font-size: 12px;
    color: #f87171;
    padding: 6px 14px;
    margin: 0;
    background: rgba(239, 68, 68, 0.1);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 14px;
    background: #1a2847;
    border-top: 1px solid #0f1535;
  }
</style>
