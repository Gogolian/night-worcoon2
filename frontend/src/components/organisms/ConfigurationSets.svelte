<script>
  import { onDestroy, onMount } from 'svelte';
  import Button from '../atoms/Button.svelte';
  import { toast } from '../../stores/toast.js';

  let configSets = [];
  let activeConfigSet = 'default';
  let loading = false;
  let switchingSet = false;
  let savingActive = false;
  let creatingNew = false;
  let activeSaveTimer = null;
  let activeSaveStatus = 'idle';
  let lastSavedSignature = '';
  let latestActiveSaveRequestId = 0;

  let editForm = createForm();
  let newForm = createForm({ targetUrl: 'http://localhost:' });

  onMount(async () => {
    await loadConfigSets();
  });

  onDestroy(() => {
    clearTimeout(activeSaveTimer);
  });

  function createEmptyHeader() {
    return { name: '', value: '' };
  }

  function headersToRows(headers = {}) {
    if (Array.isArray(headers)) {
      return headers.length > 0 ? headers.map(({ name = '', value = '' }) => ({ name, value })) : [createEmptyHeader()];
    }

    const rows = Object.entries(headers).map(([name, value]) => ({ name, value }));
    return rows.length > 0 ? rows : [createEmptyHeader()];
  }

  function createForm(initial = {}) {
    return {
      name: initial.name ?? '',
      targetUrl: initial.targetUrl ?? '',
      requestHeaders: headersToRows(initial.requestHeaders || {}),
      changeOrigin: initial.changeOrigin ?? true,
      followRedirects: initial.followRedirects ?? true
    };
  }

  function formToPayload(form) {
    const requestHeaders = {};
    form.requestHeaders.forEach(({ name, value }) => {
      if (name.trim()) {
        requestHeaders[name.trim()] = value;
      }
    });

    return {
      name: form.name.trim(),
      targetUrl: form.targetUrl.trim(),
      requestHeaders,
      changeOrigin: form.changeOrigin,
      followRedirects: form.followRedirects
    };
  }

  function serializeForm(form) {
    return JSON.stringify(formToPayload(form));
  }

  function isValidForm(form) {
    return Boolean(form.name.trim() && form.targetUrl.trim());
  }

  function getActiveSet() {
    return configSets.find(set => set.id === activeConfigSet) || null;
  }

  function syncActiveFormFromList() {
    const activeSet = getActiveSet();
    editForm = activeSet ? createForm(activeSet) : createForm();
    lastSavedSignature = activeSet ? serializeForm(editForm) : '';
    activeSaveStatus = 'idle';
  }

  async function loadConfigSets() {
    try {
      const response = await fetch('/__api/config-sets');
      const data = await response.json();
      configSets = data.configSets || [];
      activeConfigSet = data.activeConfigSet || 'default';
      syncActiveFormFromList();
    } catch (err) {
      console.error('Failed to load config sets:', err);
    }
  }

  function updateConfigSetInList(updatedSet) {
    configSets = configSets.map(set => set.id === updatedSet.id ? { ...set, ...updatedSet } : set);
  }

  function hasPendingActiveChanges() {
    const activeSet = getActiveSet();
    if (!activeSet) return false;
    return serializeForm(editForm) !== lastSavedSignature;
  }

  function scheduleActiveSave() {
    clearTimeout(activeSaveTimer);

    if (!getActiveSet()) {
      activeSaveStatus = 'idle';
      return;
    }

    if (!hasPendingActiveChanges()) {
      activeSaveStatus = 'saved';
      return;
    }

    if (!isValidForm(editForm)) {
      activeSaveStatus = 'invalid';
      return;
    }

    activeSaveStatus = 'pending';
    activeSaveTimer = setTimeout(() => {
      saveActiveSet();
    }, 350);
  }

  async function saveActiveSet() {
    clearTimeout(activeSaveTimer);

    const activeSet = getActiveSet();
    if (!activeSet) {
      activeSaveStatus = 'idle';
      return true;
    }

    if (!isValidForm(editForm)) {
      activeSaveStatus = 'invalid';
      return false;
    }

    const signature = serializeForm(editForm);
    if (signature === lastSavedSignature) {
      activeSaveStatus = 'saved';
      return true;
    }

    savingActive = true;
    activeSaveStatus = 'saving';
    const requestId = ++latestActiveSaveRequestId;

    try {
      const response = await fetch(`/__api/config-sets/${activeSet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(editForm))
      });

      const data = await response.json();

      if (!data.success) {
        if (requestId === latestActiveSaveRequestId) {
          activeSaveStatus = 'error';
        }
        toast.show(data.error || 'Failed to save config set', 'error');
        return false;
      }

      if (requestId !== latestActiveSaveRequestId) {
        return true;
      }

      updateConfigSetInList(data.configSet);
      lastSavedSignature = signature;

      const currentSignature = serializeForm(editForm);
      if (currentSignature === lastSavedSignature) {
        activeSaveStatus = 'saved';
      } else {
        activeSaveStatus = 'pending';
        scheduleActiveSave();
      }

      return true;
    } catch (err) {
      if (requestId === latestActiveSaveRequestId) {
        activeSaveStatus = 'error';
      }
      toast.show(`Error: ${err.message}`, 'error');
      return false;
    } finally {
      if (requestId === latestActiveSaveRequestId) {
        savingActive = false;
      }
    }
  }

  async function flushActiveSaveBeforeNavigation() {
    if (!hasPendingActiveChanges() || !isValidForm(editForm)) {
      clearTimeout(activeSaveTimer);
      return true;
    }

    return saveActiveSet();
  }

  async function switchConfigSet(id) {
    if (id === activeConfigSet) return;

    const canSwitch = await flushActiveSaveBeforeNavigation();
    if (!canSwitch) return;

    switchingSet = true;
    try {
      const response = await fetch(`/__api/config-sets/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        activeConfigSet = id;
        syncActiveFormFromList();
        toast.show(data.message, 'success');
      } else {
        toast.show(data.error || 'Failed to activate config set', 'error');
      }
    } catch (err) {
      toast.show(`Error: ${err.message}`, 'error');
    } finally {
      switchingSet = false;
    }
  }

  function updateActiveField(field, value) {
    editForm = { ...editForm, [field]: value };
    scheduleActiveSave();
  }

  function updateActiveHeader(index, field, value) {
    const requestHeaders = editForm.requestHeaders.map((header, i) =>
      i === index ? { ...header, [field]: value } : header
    );
    editForm = { ...editForm, requestHeaders };
    scheduleActiveSave();
  }

  function addActiveHeaderRow() {
    editForm = { ...editForm, requestHeaders: [...editForm.requestHeaders, createEmptyHeader()] };
    scheduleActiveSave();
  }

  function removeActiveHeaderRow(index) {
    const requestHeaders = editForm.requestHeaders.filter((_, i) => i !== index);
    editForm = {
      ...editForm,
      requestHeaders: requestHeaders.length > 0 ? requestHeaders : [createEmptyHeader()]
    };
    scheduleActiveSave();
  }

  async function pasteIntoActiveHeaderValue(index) {
    try {
      if (!navigator?.clipboard?.readText) {
        toast.show('Clipboard paste is not available in this browser', 'error');
        return;
      }

      const clipboardText = await navigator.clipboard.readText();
      updateActiveHeader(index, 'value', clipboardText);
    } catch (err) {
      toast.show(`Clipboard paste failed: ${err.message}`, 'error');
    }
  }

  function clearActiveHeaderValue(index) {
    updateActiveHeader(index, 'value', '');
  }

  function startNewSet() {
    creatingNew = true;
    newForm = createForm({ targetUrl: 'http://localhost:' });
  }

  function cancelNewSet() {
    creatingNew = false;
    newForm = createForm({ targetUrl: 'http://localhost:' });
  }

  function updateNewField(field, value) {
    newForm = { ...newForm, [field]: value };
  }

  function updateNewHeader(index, field, value) {
    const requestHeaders = newForm.requestHeaders.map((header, i) =>
      i === index ? { ...header, [field]: value } : header
    );
    newForm = { ...newForm, requestHeaders };
  }

  function addNewHeaderRow() {
    newForm = { ...newForm, requestHeaders: [...newForm.requestHeaders, createEmptyHeader()] };
  }

  function removeNewHeaderRow(index) {
    const requestHeaders = newForm.requestHeaders.filter((_, i) => i !== index);
    newForm = {
      ...newForm,
      requestHeaders: requestHeaders.length > 0 ? requestHeaders : [createEmptyHeader()]
    };
  }

  async function pasteIntoNewHeaderValue(index) {
    try {
      if (!navigator?.clipboard?.readText) {
        toast.show('Clipboard paste is not available in this browser', 'error');
        return;
      }

      const clipboardText = await navigator.clipboard.readText();
      updateNewHeader(index, 'value', clipboardText);
    } catch (err) {
      toast.show(`Clipboard paste failed: ${err.message}`, 'error');
    }
  }

  function clearNewHeaderValue(index) {
    updateNewHeader(index, 'value', '');
  }

  async function createNewSet() {
    if (!isValidForm(newForm)) {
      toast.show('Name and Target URL are required', 'error');
      return;
    }

    loading = true;
    try {
      const response = await fetch('/__api/config-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(newForm))
      });

      const data = await response.json();

      if (data.success) {
        configSets = [...configSets, data.configSet];
        creatingNew = false;
        newForm = createForm({ targetUrl: 'http://localhost:' });
        toast.show('Config set created!', 'success');
      } else {
        toast.show(data.error || 'Failed to create config set', 'error');
      }
    } catch (err) {
      toast.show(`Error: ${err.message}`, 'error');
    } finally {
      loading = false;
    }
  }

  async function deleteSet(id) {
    if (!confirm('Are you sure you want to delete this config set?')) {
      return;
    }

    loading = true;
    try {
      const response = await fetch(`/__api/config-sets/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        configSets = configSets.filter(set => set.id !== id);
        toast.show('Config set deleted!', 'success');
      } else {
        toast.show(data.error || 'Failed to delete', 'error');
      }
    } catch (err) {
      toast.show(`Error: ${err.message}`, 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="config-sets">
  {#if configSets.length > 0}
    <div class="sets-list">
      {#each configSets as set (set.id)}
        <div
          class="set-item"
          class:active={set.id === activeConfigSet}
          class:switching={switchingSet}
        >
          {#if set.id === activeConfigSet}
            <div class="set-inline-editor">
              <div class="set-inline-header">
                <div>
                  <h3>{editForm.name || 'Active Configuration'}</h3>
                  <p>{editForm.targetUrl || 'Target URL required'}</p>
                </div>
                <div class="set-meta set-meta--editor">
                  <span class="active-badge">✓ Active</span>
                  {#if Object.keys(formToPayload(editForm).requestHeaders).length > 0}
                    <span class="headers-badge">{Object.keys(formToPayload(editForm).requestHeaders).length} headers</span>
                  {/if}
                  <span class:proxy-flag-on={editForm.changeOrigin} class:proxy-flag-off={!editForm.changeOrigin} class="proxy-flag">
                    Host {editForm.changeOrigin ? 'rewrite' : 'keep'}
                  </span>
                  <span class:proxy-flag-on={editForm.followRedirects} class:proxy-flag-off={!editForm.followRedirects} class="proxy-flag">
                    Redirects {editForm.followRedirects ? 'follow' : 'keep 3xx'}
                  </span>
                  {#if activeSaveStatus === 'saving'}
                    <span class="save-badge save-badge--saving">Saving…</span>
                  {:else if activeSaveStatus === 'pending'}
                    <span class="save-badge save-badge--pending">Unsaved changes…</span>
                  {:else if activeSaveStatus === 'saved'}
                    <span class="save-badge save-badge--saved">Autosaved</span>
                  {:else if activeSaveStatus === 'invalid'}
                    <span class="save-badge save-badge--warning">Name + URL required</span>
                  {:else if activeSaveStatus === 'error'}
                    <span class="save-badge save-badge--error">Save failed</span>
                  {/if}
                </div>
              </div>

              <div class="form-group">
                <label class="field-label" for={`config-set-name-${set.id}`}>Name</label>
                <input
                  id={`config-set-name-${set.id}`}
                  class="config-input"
                  type="text"
                  placeholder="e.g., Production, Staging, Local"
                  value={editForm.name}
                  on:input={(e) => updateActiveField('name', e.target.value)}
                />
              </div>

              <div class="form-group">
                <label class="field-label" for={`config-set-target-${set.id}`}>Target URL</label>
                <input
                  id={`config-set-target-${set.id}`}
                  class="config-input"
                  type="text"
                  placeholder="http://localhost:8078"
                  value={editForm.targetUrl}
                  on:input={(e) => updateActiveField('targetUrl', e.target.value)}
                />
              </div>

              <div class="form-group">
                <div class="field-label">Request Headers</div>
                <div class="headers-list">
                  {#each editForm.requestHeaders as header, index (index)}
                    <div class="header-row">
                      <input
                        class="config-input"
                        type="text"
                        placeholder="Header Name"
                        value={header.name}
                        on:input={(e) => updateActiveHeader(index, 'name', e.target.value)}
                      />
                      <div class="input-with-clear">
                        <input
                          class="config-input config-input--with-clear"
                          type="text"
                          placeholder="Header Value"
                          value={header.value}
                          on:input={(e) => updateActiveHeader(index, 'value', e.target.value)}
                        />
                        {#if header.value}
                          <button
                            type="button"
                            class="clear-input-btn"
                            on:click={() => clearActiveHeaderValue(index)}
                            aria-label="Clear header value"
                            title="Clear value"
                          >
                            ✕
                          </button>
                        {/if}
                      </div>
                      <button
                        type="button"
                        class="paste-btn"
                        on:pointerdown|preventDefault={() => pasteIntoActiveHeaderValue(index)}
                        disabled={savingActive}
                      >
                        <span class="material-symbols-outlined">content_paste</span>
                      </button>
                      <Button
                        variant="secondary"
                        size="small"
                        on:click={() => removeActiveHeaderRow(index)}
                        disabled={editForm.requestHeaders.length === 1 || savingActive}
                      >
                        ✕
                      </Button>
                    </div>
                  {/each}
                  <Button variant="secondary" size="small" on:click={addActiveHeaderRow} disabled={savingActive}>
                    + Add Header
                  </Button>
                </div>
              </div>

              <div class="form-group">
                <div class="field-label">NightWorcoon Proxy Behavior</div>
                <div class="proxy-options">
                  <label class="checkbox-row">
                    <input
                      type="checkbox"
                      checked={editForm.changeOrigin}
                      on:change={(e) => updateActiveField('changeOrigin', e.target.checked)}
                    />
                    <span>Rewrite Host/Origin to target (`changeOrigin`)</span>
                  </label>
                  <p class="field-hint">Turn this off to preserve the original incoming host headers when proxying through NightWorcoon.</p>

                  <label class="checkbox-row">
                    <input
                      type="checkbox"
                      checked={editForm.followRedirects}
                      on:change={(e) => updateActiveField('followRedirects', e.target.checked)}
                    />
                    <span>Follow upstream redirects (`followRedirects`)</span>
                  </label>
                  <p class="field-hint">Turn this off if you want NightWorcoon to surface the original upstream 3xx response instead of chasing it.</p>
                </div>
              </div>
            </div>
          {:else}
            <button
              class="set-clickable"
              on:click={() => switchConfigSet(set.id)}
              disabled={switchingSet}
            >
              <div class="set-info">
                <h3>{set.name}</h3>
                <p>{set.targetUrl}</p>
                <div class="set-meta">
                  {#if Object.keys(set.requestHeaders || {}).length > 0}
                    <span class="headers-badge">{Object.keys(set.requestHeaders).length} headers</span>
                  {/if}
                  <span class:proxy-flag-on={set.changeOrigin ?? true} class:proxy-flag-off={!(set.changeOrigin ?? true)} class="proxy-flag">
                    Host {set.changeOrigin ?? true ? 'rewrite' : 'keep'}
                  </span>
                  <span class:proxy-flag-on={set.followRedirects ?? true} class:proxy-flag-off={!(set.followRedirects ?? true)} class="proxy-flag">
                    Redirects {set.followRedirects ?? true ? 'follow' : 'keep 3xx'}
                  </span>
                </div>
              </div>
            </button>
            <div class="set-actions">
              <Button
                variant="secondary"
                size="small"
                on:click={() => deleteSet(set.id)}
                disabled={loading || switchingSet || configSets.length <= 1}
              >
                Delete
              </Button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="no-configs">No configuration sets available. Create one below.</p>
  {/if}

  <div class="add-set-section">
    <Button variant="primary" size="small" on:click={startNewSet} disabled={loading || switchingSet}>
      + Add New Config Set
    </Button>
  </div>

  {#if creatingNew}
    <div class="edit-form">
      <h3>New Config Set</h3>
      
      <div class="form-group">
        <label class="field-label" for="set-name">Name</label>
        <input
          id="set-name"
          class="config-input"
          type="text"
          placeholder="e.g., Production, Staging, Local"
          value={newForm.name}
          on:input={(e) => updateNewField('name', e.target.value)}
        />
      </div>

      <div class="form-group">
        <label class="field-label" for="set-target">Target URL</label>
        <input
          id="set-target"
          class="config-input"
          type="text"
          placeholder="http://localhost:8078"
          value={newForm.targetUrl}
          on:input={(e) => updateNewField('targetUrl', e.target.value)}
        />
      </div>

      <div class="form-group">
        <div class="field-label">Request Headers</div>
        <div class="headers-list">
          {#each newForm.requestHeaders as header, index (index)}
            <div class="header-row">
              <input
                class="config-input"
                type="text"
                placeholder="Header Name"
                value={header.name}
                on:input={(e) => updateNewHeader(index, 'name', e.target.value)}
              />
              <div class="input-with-clear">
                <input
                  class="config-input config-input--with-clear"
                  type="text"
                  placeholder="Header Value"
                  value={header.value}
                  on:input={(e) => updateNewHeader(index, 'value', e.target.value)}
                />
                {#if header.value}
                  <button
                    type="button"
                    class="clear-input-btn"
                    on:click={() => clearNewHeaderValue(index)}
                    aria-label="Clear header value"
                    title="Clear value"
                  >
                    ✕
                  </button>
                {/if}
              </div>
              <button
                type="button"
                class="paste-btn"
                on:pointerdown|preventDefault={() => pasteIntoNewHeaderValue(index)}
              >
                PASTE
              </button>
              <Button
                variant="secondary"
                size="small"
                on:click={() => removeNewHeaderRow(index)}
                disabled={newForm.requestHeaders.length === 1}
              >
                ✕
              </Button>
            </div>
          {/each}
          <Button variant="secondary" size="small" on:click={addNewHeaderRow}>
            + Add Header
          </Button>
        </div>
      </div>

      <div class="form-group">
        <div class="field-label">NightWorcoon Proxy Behavior</div>
        <div class="proxy-options">
          <label class="checkbox-row">
            <input
              type="checkbox"
              checked={newForm.changeOrigin}
              on:change={(e) => updateNewField('changeOrigin', e.target.checked)}
            />
            <span>Rewrite Host/Origin to target (`changeOrigin`)</span>
          </label>
          <p class="field-hint">Turn this off to preserve the original incoming host headers when proxying through NightWorcoon.</p>

          <label class="checkbox-row">
            <input
              type="checkbox"
              checked={newForm.followRedirects}
              on:change={(e) => updateNewField('followRedirects', e.target.checked)}
            />
            <span>Follow upstream redirects (`followRedirects`)</span>
          </label>
          <p class="field-hint">Turn this off if you want NightWorcoon to surface the original upstream 3xx response instead of chasing it.</p>
        </div>
      </div>

      <div class="form-actions">
        <Button variant="primary" size="small" on:click={createNewSet} disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </Button>
        <Button variant="secondary" size="small" on:click={cancelNewSet} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .config-sets {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sets-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .set-item {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    background-color: #0f1535;
    border-left: 3px solid #1a2847;
    transition: all 0.2s;
  }

  .set-item.active {
    border-left-color: #60a5fa;
    background-color: #1a2847;
  }

  .set-item.switching {
    opacity: 0.6;
  }

  .set-clickable {
    flex: 1;
    padding: 10px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.2s;
  }

  .set-clickable:hover:not(:disabled) {
    background-color: rgba(59, 130, 246, 0.1);
  }

  .set-clickable:disabled {
    cursor: default;
  }

  .set-item.active .set-clickable:disabled {
    cursor: default;
  }

  .set-info h3 {
    margin: 0 0 4px 0;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 600;
  }

  .set-info p {
    margin: 0 0 6px 0;
    color: #9ca3af;
    font-size: 11px;
    font-family: monospace;
  }

  .set-meta {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .set-meta--editor {
    justify-content: flex-end;
  }

  .headers-badge {
    display: inline-block;
    padding: 2px 6px;
    background-color: #2563eb;
    color: #e0e0e0;
    font-size: 10px;
    border-radius: 3px;
  }

  .proxy-flag {
    display: inline-block;
    padding: 2px 6px;
    font-size: 10px;
    border-radius: 3px;
  }

  .proxy-flag-on {
    background-color: #164e63;
    color: #cffafe;
  }

  .proxy-flag-off {
    background-color: #3f3f46;
    color: #e4e4e7;
  }

  .active-badge {
    display: inline-block;
    padding: 2px 6px;
    background-color: #16a34a;
    color: #e0e0e0;
    font-size: 10px;
    border-radius: 3px;
    font-weight: 600;
  }

  .set-actions {
    display: flex;
    gap: 6px;
    align-items: center;
    padding-right: 10px;
  }

  .no-configs {
    margin: 0;
    padding: 12px;
    color: #9ca3af;
    font-size: 12px;
    text-align: center;
    background-color: #0f1535;
  }

  .add-set-section {
    padding-top: 8px;
    border-top: 1px solid #1a2847;
  }

  .edit-form {
    margin-top: 10px;
    padding: 10px;
    background-color: #0f1535;
    border-left: 3px solid #60a5fa;
  }

  .set-inline-editor {
    flex: 1;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .set-inline-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .set-inline-header h3 {
    margin: 0 0 4px 0;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 600;
  }

  .set-inline-header p {
    margin: 0;
    color: #9ca3af;
    font-size: 11px;
    font-family: monospace;
    word-break: break-all;
  }

  .edit-form h3 {
    margin: 0 0 10px 0;
    color: #60a5fa;
    font-size: 13px;
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 8px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .headers-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .proxy-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    display: block;
    margin-bottom: 4px;
    color: #93c5fd;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .config-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #3f3f46;
    font-size: 12px;
    font-family: inherit;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
    background-color: #18212f;
    color: #e0e0e0;
  }

  .config-input:focus {
    outline: none;
    border-color: #60a5fa;
  }

  .config-input::placeholder {
    color: #6b7280;
  }

  .input-with-clear {
    position: relative;
    width: 100%;
  }

  .config-input--with-clear {
    padding-right: 30px;
  }

  .clear-input-btn {
    position: absolute;
    top: 50%;
    right: 7px;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: #9ca3af;
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }

  .clear-input-btn:hover {
    background-color: rgba(96, 165, 250, 0.14);
    color: #e5e7eb;
  }

  .checkbox-row {
    display: flex;
    gap: 8px;
    align-items: center;
    color: #e0e0e0;
    font-size: 12px;
  }

  .checkbox-row input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #60a5fa;
    flex-shrink: 0;
  }

  .field-hint {
    margin: 0;
    font-size: 11px;
    color: #6b7280;
  }

  .header-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto auto;
    gap: 6px;
    align-items: center;
  }

  .paste-btn {
    border: 2px solid #374151;
    background-color: #1a2847;
    color: #d4d4d8;
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .paste-btn .material-symbols-outlined {
    font-size: 16px;
    line-height: 1;
    vertical-align: middle;
    font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20;
  }

  .paste-btn:hover:not(:disabled) {
    border-color: #60a5fa;
    background-color: #1e293b;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
    transform: translateY(-1px);
  }

  .paste-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .paste-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .save-badge {
    display: inline-block;
    padding: 2px 6px;
    font-size: 10px;
    border-radius: 3px;
    font-weight: 600;
  }

  .save-badge--saving,
  .save-badge--pending {
    background-color: #1d4ed8;
    color: #dbeafe;
  }

  .save-badge--saved {
    background-color: #166534;
    color: #dcfce7;
  }

  .save-badge--warning {
    background-color: #92400e;
    color: #fef3c7;
  }

  .save-badge--error {
    background-color: #991b1b;
    color: #fee2e2;
  }

  .form-actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #1a2847;
  }

  @media (max-width: 900px) {
    .set-item {
      flex-direction: column;
    }

    .set-actions {
      padding: 0 10px 10px;
      justify-content: flex-end;
    }

    .set-inline-header {
      flex-direction: column;
    }
  }
</style>
