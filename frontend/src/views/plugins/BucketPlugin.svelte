<script>
  import { onMount } from 'svelte';
  import { plugins, togglePlugin } from '../../stores/plugins.js';
  import PluginHeader from '../../components/organisms/PluginHeader.svelte';
  import PluginSection from '../../components/molecules/PluginSection.svelte';
  import Button from '../../components/atoms/Button.svelte';
  import Input from '../../components/atoms/Input.svelte';
  import Badge from '../../components/atoms/Badge.svelte';
  import DeleteButton from '../../components/atoms/DeleteButton.svelte';
  import JsonTemplateEditor from '../../components/molecules/JsonTemplateEditor.svelte';

  $: plugin = $plugins.find(p => p.name === 'bucket');

  // ── State ─────────────────────────────────────────────────────────────────────

  let collections = [];          // [{ path, idPattern, resourceCount, _templateText, _templateError }]

  const TEMPLATE_PLACEHOLDER = '{\n  "id": "{{ :id }}",\n  "email": "{{ email }}",\n  "firstName": "{{ firstName }}",\n  "active": "{{ boolean }}",\n  "phone": "{{ phoneNumber }}"\n}';
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
      collections = (data.collections || []).map(col => ({
        ...col,
        _templateText: col.responseTemplate ? JSON.stringify(col.responseTemplate, null, 2) : '',
        _templateError: ''
      }));
    } catch (err) {
      console.error('Bucket: failed to load collections', err);
    }
  }

  async function loadData() {
    try {
      const res = await fetch('/__api/bucket/data');
      if (!res.ok) {
        console.error('Bucket: loadData returned', res.status);
        bucketData = {};
        return;
      }
      const data = await res.json();
      // Validate: each value should be an array
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        bucketData = data;
      } else {
        bucketData = {};
      }
    } catch (err) {
      console.error('Bucket: failed to load data', err);
      bucketData = {};
    }
  }

  async function saveCollection(index) {
    const col = collections[index];
    try {
      const res = await fetch(`/__api/bucket/collections/${index}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: col.path,
          idPattern: col.idPattern,
          idLength: (col.idLength && col.idLength > 0) ? col.idLength : null,
          responseTemplate: (() => {
            const t = col._templateText && col._templateText.trim();
            if (!t) return null;
            try { return JSON.parse(t); } catch { return undefined; }
          })()
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Bucket: saveCollection failed:', errData.error || res.status);
        // Re-sync UI with the actual server state to avoid stale/invalid values
        await loadCollections();
        return;
      }
      const data = await res.json();
      if (data.collection) {
        // Update from server response so UI reflects normalized values (trimmed path, etc.)
        // Keep _templateText since we just sent it and it was accepted
        collections[index] = {
          ...data.collection,
          _templateText: collections[index]._templateText ?? '',
          _templateError: ''
        };
        collections = [...collections];
      }
      await loadData();
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

  function handleIdLengthChange(index, value) {
    const num = parseInt(value, 10);
    collections[index].idLength = (!isNaN(num) && num > 0) ? num : undefined;
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
  $: totalResources = Object.values(bucketData).reduce((sum, val) => sum + (Array.isArray(val) ? val.length : 0), 0);
</script>

<div class="plugin-page">
  {#if plugin}
    <PluginHeader {plugin} onToggle={handleToggle} />

    <!-- ── Collections ─────────────────────────────────────────────────────── -->
    <PluginSection title="Collections">
      <div class="collections-list">
        {#each collections as col, i (col.path)}
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
                    class:active={pattern === 'custom'
                      ? (col.idPattern !== 'uuid' && col.idPattern !== 'numeric' && col.idPattern !== 'alphanumeric')
                      : col.idPattern === pattern}
                    on:click={() => {
                      if (pattern === 'custom') {
                        // Switch to custom only if currently on a preset; initialize with empty string
                        // to show the regexp input rather than sending literal 'custom' to backend
                        if (col.idPattern === 'uuid' || col.idPattern === 'numeric' || col.idPattern === 'alphanumeric') {
                          handlePatternSelect(i, '[A-Z]{3}-\\d{4}');
                        }
                      } else {
                        handlePatternSelect(i, pattern);
                      }
                    }}
                  >
                    {pattern === 'uuid' ? 'UUID' :
                     pattern === 'numeric' ? 'Numeric' :
                     pattern === 'alphanumeric' ? 'Alphanumeric' : 'Custom'}
                  </button>
                {/each}
              </div>

              {#if col.idPattern === 'numeric'}
                <div class="id-length-row">
                  <span class="field-label">Length (zero-pad)</span>
                  <input
                    class="id-length-input"
                    type="number"
                    min="1"
                    max="20"
                    placeholder="e.g. 6"
                    value={col.idLength ?? ''}
                    on:change={(e) => handleIdLengthChange(i, e.target.value)}
                  />
                  <span class="pattern-hint">e.g. length 6 → 000001, 000002… (leave empty for no padding)</span>
                </div>
              {:else if col.idPattern === 'alphanumeric'}
                <div class="id-length-row">
                  <span class="field-label">Length</span>
                  <input
                    class="id-length-input"
                    type="number"
                    min="1"
                    max="64"
                    placeholder="8"
                    value={col.idLength ?? ''}
                    on:change={(e) => handleIdLengthChange(i, e.target.value)}
                  />
                  <span class="pattern-hint">number of characters (default: 8)</span>
                </div>
              {:else if col.idPattern !== 'uuid'}
                <div class="custom-pattern-input">
                  <Input
                    placeholder="regexp, e.g. [A-Z]{3}-\d{4}"
                    value={col.idPattern}
                    on:change={(e) => { col.idPattern = e.target.value; saveCollection(i); }}
                  />
                  <span class="pattern-hint">Regexp pattern — IDs are generated to structurally match it (supports [a-z], \d, \w, &#123;n&#125;, &#123;n,m&#125;, groups)</span>
                </div>
              {/if}
            </div>

            <div class="collection-field">
              <span class="field-label">Response Template <span class="optional-hint">(optional, POST only)</span></span>
              <JsonTemplateEditor
                value={col._templateText ?? ''}
                placeholder={TEMPLATE_PLACEHOLDER}
                height={180}
                showTokenRef={true}
                on:change={(e) => {
                  const text = (e.detail || '').trim();
                  collections[i]._templateText = text;
                  if (!text) {
                    collections[i]._templateError = '';
                    saveCollection(i);
                    return;
                  }
                  try {
                    JSON.parse(text);
                    collections[i]._templateError = '';
                    saveCollection(i);
                  } catch (_) {
                    // Don't save or re-render — user is still typing
                  }
                }}
              />
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
              {@const jsonStr = JSON.stringify(resource)}
              <div class="resource-row">
                <span class="resource-id">{resource.id}</span>
                <span class="resource-preview">{jsonStr.slice(0, 120)}{jsonStr.length > 120 ? '…' : ''}</span>
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

        <h4 class="about-subtitle">Response Template Tokens</h4>
        <p>Use <code>&#123;&#123; token &#125;&#125;</code> placeholders in the Response Template to auto-generate values on POST. Request body fields not covered by the template are preserved.</p>

        <table class="token-docs-table">
          <thead>
            <tr><th>Token</th><th>Description</th><th>Example output</th></tr>
          </thead>
          <tbody>
            <tr><td><code>:id</code></td><td>Generated resource ID (same as collection ID)</td><td><code>a3f8b2c1-...</code></td></tr>
            <tr><td><code>uuid</code></td><td>Random UUID (independent of :id)</td><td><code>d4e5f6a7-...</code></td></tr>
            <tr><td><code>email</code></td><td>Random email from Polish name pools</td><td><code>jan.kowalski@wp.pl</code></td></tr>
            <tr><td><code>phoneNumber</code></td><td>Polish mobile number: 48 + 9 digits</td><td><code>48501234567</code></td></tr>
            <tr><td><code>firstName</code></td><td>Random Polish first name</td><td><code>Katarzyna</code></td></tr>
            <tr><td><code>lastName</code></td><td>Random Polish surname</td><td><code>Nowak</code></td></tr>
            <tr><td><code>date</code></td><td>Current timestamp, ISO 8601</td><td><code>2026-03-06T14:30:00.000Z</code></td></tr>
            <tr><td><code>boolean</code></td><td>Random true or false</td><td><code>true</code></td></tr>
            <tr><td><code>integer</code></td><td>Random integer 1–1000</td><td><code>742</code></td></tr>
            <tr><td><code>integer:min:max</code></td><td>Random integer in given range</td><td><code>&#123;&#123; integer:1:100 &#125;&#125;</code> → <code>47</code></td></tr>
            <tr><td><code>location.streetName</code></td><td>Random Polish street name</td><td><code>Marszałkowska</code></td></tr>
            <tr><td><code>location.streetNr</code></td><td>Street number 1–150 (~15% with letter)</td><td><code>42A</code></td></tr>
            <tr><td><code>location.zipCode</code></td><td>Polish zip code xx-xxx</td><td><code>02-456</code></td></tr>
            <tr><td><code>location.flatNr</code></td><td>Flat number 1–200</td><td><code>17</code></td></tr>
            <tr><td><code>headers.X</code></td><td>Value of request header <em>X</em></td><td><code>&#123;&#123; headers.UserId &#125;&#125;</code> → header value</td></tr>
            <tr><td><code>body.X</code></td><td>Value of request body field <em>X</em></td><td><code>&#123;&#123; body.role &#125;&#125;</code> → body value</td></tr>
            <tr><td><code><em>regexp</em></code></td><td>Fallback — generate value matching regexp pattern</td><td><code>&#123;&#123; [A-Z]&#123;3&#125;-\d&#123;4&#125; &#125;&#125;</code> → <code>ABC-1234</code></td></tr>
          </tbody>
        </table>

        <p class="about-note"><strong>Resolution order:</strong> :id → built-in tokens → integer:min:max → headers.X / body.X → regexp pattern fallback. Types: <code>boolean</code> returns JS boolean, <code>integer</code> and <code>location.flatNr</code> return JS numbers, all others return strings.</p>
      </div>
    </PluginSection>
  {/if}
</div>

<svelte:window on:keydown={(e) => { if (editingResource && e.key === 'Escape') editingResource = null; }} />

<!-- ── JSON editor modal ──────────────────────────────────────────────────── -->
{#if editingResource}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={() => (editingResource = null)}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Edit resource {editingResource.id}">
      <div class="modal-header">
        <span class="modal-title">Edit resource <code>{editingResource.id}</code></span>
        <button class="modal-close" on:click={() => (editingResource = null)} aria-label="Close dialog">✕</button>
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

  .id-length-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .id-length-row .field-label {
    flex-shrink: 0;
  }

  .id-length-input {
    width: 72px;
    padding: 5px 7px;
    border: 1px solid #3f3f46;
    font-size: 12px;
    font-family: inherit;
    background-color: #18212f;
    color: #e0e0e0;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .id-length-input:focus {
    outline: none;
    border-color: #60a5fa;
  }

  .pattern-hint {
    font-size: 10px;
    color: #6b7280;
  }

  .optional-hint {
    font-size: 10px;
    color: #6b7280;
    font-weight: normal;
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

  .about-subtitle {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
    margin: 6px 0 2px;
    border-bottom: 1px solid #1a2847;
    padding-bottom: 4px;
  }

  .about-note {
    font-size: 11px !important;
    color: #6b7280 !important;
  }

  .token-docs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .token-docs-table th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    padding: 5px 8px;
    border-bottom: 1px solid #1a2847;
    background: #0d1626;
  }

  .token-docs-table td {
    padding: 4px 8px;
    color: #d4d4d8;
    border-bottom: 1px solid #111827;
    vertical-align: top;
    line-height: 1.5;
  }

  .token-docs-table tr:hover td {
    background: rgba(96, 165, 250, 0.04);
  }

  .token-docs-table code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background: #1a2234;
    color: #93c5fd;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 11px;
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
