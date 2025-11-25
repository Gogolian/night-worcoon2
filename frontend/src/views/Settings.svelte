<script>
  import { onMount } from 'svelte';
  import Button from '../components/atoms/Button.svelte';
  import Input from '../components/atoms/Input.svelte';
  import Label from '../components/atoms/Label.svelte';
  import StatusMessage from '../components/molecules/StatusMessage.svelte';

  let proxyPort = '8079';
  let debugLogs = false;
  let configSets = [];
  let activeConfigSet = 'default';
  let editingSet = null;
  let savedMessage = null;
  let loading = false;

  onMount(async () => {
    await loadConfig();
    await loadConfigSets();
  });

  async function loadConfig() {
    try {
      const response = await fetch('/__api/config');
      const data = await response.json();
      proxyPort = String(data.proxyPort);
      debugLogs = data.debugLogs || false;
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }

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
      savedMessage = { type: 'error', text: 'Name and Target URL are required' };
      setTimeout(() => savedMessage = null, 3000);
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
        savedMessage = { type: 'success', text: 'Config set saved!' };
        editingSet = null;
        await loadConfigSets();
      } else {
        savedMessage = { type: 'error', text: data.error || 'Failed to save' };
      }
    } catch (err) {
      savedMessage = { type: 'error', text: `Error: ${err.message}` };
    } finally {
      loading = false;
      setTimeout(() => savedMessage = null, 3000);
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
        savedMessage = { type: 'success', text: 'Config set deleted!' };
        await loadConfigSets();
      } else {
        savedMessage = { type: 'error', text: data.error || 'Failed to delete' };
      }
    } catch (err) {
      savedMessage = { type: 'error', text: `Error: ${err.message}` };
    } finally {
      loading = false;
      setTimeout(() => savedMessage = null, 3000);
    }
  }

  async function handleSave(autoRestart = false) {
    loading = true;
    try {
      const response = await fetch('/__api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proxyPort: parseInt(proxyPort, 10),
          debugLogs,
          autoRestart
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        savedMessage = { type: 'success', text: data.message };
      } else {
        savedMessage = { type: 'error', text: 'Failed to save settings' };
      }
    } catch (err) {
      savedMessage = { type: 'error', text: `Error: ${err.message}` };
    } finally {
      loading = false;
      setTimeout(() => {
        savedMessage = null;
      }, 5000);
    }
  }
  
  async function handleRestart() {
    if (!confirm('Are you sure you want to restart the server?')) {
      return;
    }
    
    loading = true;
    try {
      const response = await fetch('/__api/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        savedMessage = { type: 'success', text: data.message };
      }
    } catch (err) {
      savedMessage = { type: 'error', text: `Error: ${err.message}` };
    } finally {
      loading = false;
      setTimeout(() => {
        savedMessage = null;
      }, 5000);
    }
  }

</script>

<div class="settings-view">
  <h1>Settings</h1>

  <div class="settings-grid">
    <div class="card">
      <h2>Configuration Sets</h2>
      <div class="card-content">
        {#if savedMessage}
          <StatusMessage type={savedMessage.type}>
            {savedMessage.text}
          </StatusMessage>
        {/if}

        <div class="sets-list">
          {#each configSets as set (set.id)}
            <div class="set-item" class:active={set.id === activeConfigSet}>
              <div class="set-info">
                <h3>{set.name}</h3>
                <p>{set.targetUrl}</p>
                {#if Object.keys(set.requestHeaders || {}).length > 0}
                  <span class="headers-badge">{Object.keys(set.requestHeaders).length} headers</span>
                {/if}
              </div>
              <div class="set-actions">
                <Button
                  variant="secondary"
                  size="small"
                  on:click={() => startEditSet(set)}
                  disabled={loading}
                >
                  Edit
                </Button>
                {#if set.id !== activeConfigSet}
                  <Button
                    variant="secondary"
                    size="small"
                    on:click={() => deleteSet(set.id)}
                    disabled={loading || configSets.length <= 1}
                  >
                    Delete
                  </Button>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <div class="add-set-section">
          <Button variant="primary" size="small" on:click={startNewSet} disabled={loading}>
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
    </div>

    <div class="card">
      <h2>Server Configuration</h2>
      <div class="card-content">
        <div class="form-group">
          <Label htmlFor="proxy-port" text="Proxy Port" />
          <Input
            id="proxy-port"
            type="number"
            placeholder="8079"
            bind:value={proxyPort}
          />
          <p class="field-hint">Port where proxy listens</p>
        </div>

        <div class="form-group">
          <div class="checkbox-group">
            <input
              id="debug-logs"
              type="checkbox"
              bind:checked={debugLogs}
              class="checkbox-input"
            />
            <Label htmlFor="debug-logs" text="Debug Proxy (Enable Logs)" />
          </div>
          <p class="field-hint">Show detailed logging for all proxy requests</p>
        </div>

        <div class="form-actions">
          <Button variant="primary" size="small" on:click={() => handleSave(false)} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="primary" size="small" on:click={() => handleSave(true)} disabled={loading}>
            Save & Restart
          </Button>
        </div>
        
        <div class="restart-section">
          <Button variant="secondary" size="small" on:click={handleRestart} disabled={loading}>
            🔄 Restart Server
          </Button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-view {
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h1 {
    color: #e0e0e0;
    font-size: 16px;
    margin: 0 0 10px 0;
    font-weight: 600;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 10px;
  }

  .card {
    background: #12192b;
    border: 1px solid #1a2847;
    overflow: hidden;
  }

  .card h2 {
    background-color: #1a2847;
    color: #93c5fd;
    margin: 0;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #0f1535;
  }

  .card-content {
    padding: 8px;
  }

  .form-group {
    margin-bottom: 8px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .field-hint {
    margin: 2px 0 0 0;
    font-size: 11px;
    color: #6b7280;
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

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .checkbox-input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #60a5fa;
  }

  .form-actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #1a2847;
  }
  
  .restart-section {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #1a2847;
  }

  .sets-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
  }

  .set-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: #0f1535;
    border-left: 3px solid #1a2847;
    transition: border-color 0.2s;
  }

  .set-item.active {
    border-left-color: #60a5fa;
    background-color: #1a2847;
  }

  .set-info h3 {
    margin: 0 0 4px 0;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 600;
  }

  .set-info p {
    margin: 0 0 4px 0;
    color: #9ca3af;
    font-size: 11px;
    font-family: monospace;
  }

  .headers-badge {
    display: inline-block;
    padding: 2px 6px;
    background-color: #2563eb;
    color: #e0e0e0;
    font-size: 10px;
    border-radius: 3px;
  }

  .set-actions {
    display: flex;
    gap: 6px;
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
</style>
