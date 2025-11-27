<script>
  import { onMount } from 'svelte';
  import Button from '../components/atoms/Button.svelte';
  import Input from '../components/atoms/Input.svelte';
  import Label from '../components/atoms/Label.svelte';
  import ConfigurationSets from '../components/organisms/ConfigurationSets.svelte';
  import { toast } from '../stores/toast.js';

  let proxyPort = '8079';
  let debugLogs = false;
  let loading = false;

  onMount(async () => {
    await loadConfig();
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
        toast.show(data.message, 'success');
      } else {
        toast.show('Failed to save settings', 'error');
      }
    } catch (err) {
      toast.show(`Error: ${err.message}`, 'error');
    } finally {
      loading = false;
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
        toast.show(data.message, 'success');
      }
    } catch (err) {
      toast.show(`Error: ${err.message}`, 'error');
    } finally {
      loading = false;
    }
  }

</script>

<div class="settings-view">
  <h1>Settings</h1>

  <div class="settings-grid">
    <div class="card">
      <h2>Configuration Sets</h2>
      <div class="card-content">
        <ConfigurationSets />
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
</style>
