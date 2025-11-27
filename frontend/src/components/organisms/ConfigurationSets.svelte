<script>
  import { onMount } from 'svelte';
  import Button from '../atoms/Button.svelte';
  import Input from '../atoms/Input.svelte';
  import Label from '../atoms/Label.svelte';
  import { toast } from '../../stores/toast.js';

  let configSets = [];
  let activeConfigSet = 'default';
  let editingSet = null;
  let loading = false;
  let switchingSet = false;

  onMount(async () => {
    await loadConfigSets();
  });

  async function loadConfigSets() {
    try {
      const response = await fetch('/__api/config-sets');
      const data = await response.json();
      configSets = data.configSets || [];
      activeConfigSet = data.activeConfigSet || 'default';
    } catch (err) {
      console.error('Failed to load config sets:', err);
    }
  }

  async function switchConfigSet(id) {
    switchingSet = true;
    try {
      const response = await fetch(`/__api/config-sets/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (data.success) {
        activeConfigSet = id;
        toast.show(data.message, 'success');
      }
    } catch (err) {
      toast.show(`Error: ${err.message}`, 'error');
    } finally {
      switchingSet = false;
    }
  }

  // Edit form state
  let editForm = {
    name: '',
    targetUrl: '',
    requestHeaders: [{ name: '', value: '' }]
  };

  function startEditSet(set) {
    editingSet = set.id;
    editForm.name = set.name;
    editForm.targetUrl = set.targetUrl;
    
    const headers = set.requestHeaders || {};
    if (Object.keys(headers).length > 0) {
      editForm.requestHeaders = Object.entries(headers).map(([name, value]) => ({ name, value }));
    } else {
      editForm.requestHeaders = [{ name: '', value: '' }];
    }
  }

  function startNewSet() {
    editingSet = 'new';
    editForm.name = '';
    editForm.targetUrl = 'http://localhost:';
    editForm.requestHeaders = [{ name: '', value: '' }];
  }

  function cancelEdit() {
    editingSet = null;
  }
  
  function addHeaderRow() {
    editForm.requestHeaders = [...editForm.requestHeaders, { name: '', value: '' }];
  }
  
  function removeHeaderRow(index) {
    editForm.requestHeaders = editForm.requestHeaders.filter((_, i) => i !== index);
    if (editForm.requestHeaders.length === 0) {
      editForm.requestHeaders = [{ name: '', value: '' }];
    }
  }

  async function saveSet() {
    if (!editForm.name.trim() || !editForm.targetUrl.trim()) {
      toast.show('Name and Target URL are required', 'error');
      return;
    }

    loading = true;
    try {
      const parsedHeaders = {};
      editForm.requestHeaders.forEach(({ name, value }) => {
        if (name.trim()) {
          parsedHeaders[name.trim()] = value;
        }
      });

      const payload = {
        name: editForm.name.trim(),
        targetUrl: editForm.targetUrl.trim(),
        requestHeaders: parsedHeaders
      };

      let response;
      if (editingSet === 'new') {
        response = await fetch('/__api/config-sets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`/__api/config-sets/${editingSet}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();
      
      if (data.success) {
        toast.show('Config set saved!', 'success');
        editingSet = null;
        await loadConfigSets();
      } else {
        toast.show(data.error || 'Failed to save', 'error');
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
        toast.show('Config set deleted!', 'success');
        await loadConfigSets();
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
          <button 
            class="set-clickable"
            on:click={() => switchConfigSet(set.id)}
            disabled={switchingSet || set.id === activeConfigSet}
          >
            <div class="set-info">
              <h3>{set.name}</h3>
              <p>{set.targetUrl}</p>
              <div class="set-meta">
                {#if Object.keys(set.requestHeaders || {}).length > 0}
                  <span class="headers-badge">{Object.keys(set.requestHeaders).length} headers</span>
                {/if}
                {#if set.id === activeConfigSet}
                  <span class="active-badge">✓ Active</span>
                {/if}
              </div>
            </div>
          </button>
          <div class="set-actions">
            <Button
              variant="secondary"
              size="small"
              on:click={() => startEditSet(set)}
              disabled={loading || switchingSet}
            >
              Edit
            </Button>
            {#if set.id !== activeConfigSet}
              <Button
                variant="secondary"
                size="small"
                on:click={() => deleteSet(set.id)}
                disabled={loading || switchingSet || configSets.length <= 1}
              >
                Delete
              </Button>
            {/if}
          </div>
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

  {#if editingSet}
    <div class="edit-form">
      <h3>{editingSet === 'new' ? 'New Config Set' : 'Edit Config Set'}</h3>
      
      <div class="form-group">
        <Label htmlFor="set-name" text="Name" />
        <Input
          id="set-name"
          type="text"
          placeholder="e.g., Production, Staging, Local"
          bind:value={editForm.name}
        />
      </div>

      <div class="form-group">
        <Label htmlFor="set-target" text="Target URL" />
        <Input
          id="set-target"
          type="text"
          placeholder="http://localhost:8078"
          bind:value={editForm.targetUrl}
        />
      </div>

      <div class="form-group">
        <Label text="Request Headers" />
        <div class="headers-list">
          {#each editForm.requestHeaders as header, index (index)}
            <div class="header-row">
              <Input
                type="text"
                placeholder="Header Name"
                bind:value={header.name}
              />
              <Input
                type="text"
                placeholder="Header Value"
                bind:value={header.value}
              />
              <Button
                variant="secondary"
                size="small"
                on:click={() => removeHeaderRow(index)}
                disabled={editForm.requestHeaders.length === 1}
              >
                ✕
              </Button>
            </div>
          {/each}
          <Button variant="secondary" size="small" on:click={addHeaderRow}>
            + Add Header
          </Button>
        </div>
      </div>

      <div class="form-actions">
        <Button variant="primary" size="small" on:click={saveSet} disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="secondary" size="small" on:click={cancelEdit} disabled={loading}>
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
    align-items: center;
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
  }

  .headers-badge {
    display: inline-block;
    padding: 2px 6px;
    background-color: #2563eb;
    color: #e0e0e0;
    font-size: 10px;
    border-radius: 3px;
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

  .header-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 6px;
    align-items: center;
  }

  .form-actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #1a2847;
  }
</style>
