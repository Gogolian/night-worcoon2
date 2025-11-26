<script>
  import StatusMessage from '../components/molecules/StatusMessage.svelte';
  import Card from '../components/molecules/Card.svelte';
  import { proxyStatus, fetchProxyStatus, checkServerHealth } from '../stores/proxy.js';
  import { onMount, onDestroy } from 'svelte';

  let healthCheckInterval;
  let configSets = [];
  let activeConfigSet = 'default';
  let switchingSet = false;

  onMount(async () => {
    fetchProxyStatus();
    await loadConfigSets();
    
    // Start health check every 2 seconds
    healthCheckInterval = setInterval(() => {
      checkServerHealth();
    }, 2000);
  });

  onDestroy(() => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
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
        proxyStatus.update(s => ({ ...s, error: null, message: data.message }));
      }
    } catch (err) {
      proxyStatus.update(s => ({ ...s, error: `Error: ${err.message}` }));
    } finally {
      switchingSet = false;
    }
  }
</script>

<div class="dashboard-view">
  <h1>Dashboard</h1>

  {#if !$proxyStatus.serverOnline}
    <StatusMessage type="error">
      Server Offline: The proxy server is not responding. Please start the server on port 8079.
    </StatusMessage>
  {/if}

  <div class="dashboard-grid">
    <Card title="Active Configuration">
      {#if configSets.length > 0}
        <div class="config-selector">
          {#each configSets as set (set.id)}
            <button
              class="config-option"
              class:active={set.id === activeConfigSet}
              on:click={() => switchConfigSet(set.id)}
              disabled={switchingSet || set.id === activeConfigSet}
            >
              <span class="config-name">{set.name}</span>
              <span class="config-url">{set.targetUrl}</span>
              {#if set.id === activeConfigSet}
                <span class="active-badge">✓ Active</span>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <p class="no-configs">No configuration sets available. Create one in Settings.</p>
      {/if}
    </Card>

    <Card title="Quick Stats">
      <div class="stat-item">
        <span class="stat-label">Server:</span>
        <span class="stat-value" class:online={$proxyStatus.serverOnline} class:offline={!$proxyStatus.serverOnline}>
          {$proxyStatus.serverOnline ? '🟢 Online' : '🔴 Offline'}
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Proxy:</span>
        <span class="stat-value">8079</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Target:</span>
        <span class="stat-value">8078</span>
      </div>

    </Card>
  </div>
</div>

<style>
  .dashboard-view {
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

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 10px;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #1a2847;
    font-size: 12px;
  }

  .stat-item:last-child {
    border-bottom: none;
  }

  .stat-label {
    color: #9ca3af;
    font-weight: 500;
  }

  .stat-value {
    color: #d4d4d8;
    font-weight: 600;
  }

  .stat-value.online {
    color: #4ade80;
  }

  .stat-value.offline {
    color: #f87171;
  }

  .config-selector {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .config-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px;
    background-color: #0f1535;
    border: 1px solid #1a2847;
    border-left: 3px solid #1a2847;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .config-option:hover:not(:disabled) {
    background-color: #1a2847;
    border-left-color: #3b82f6;
  }

  .config-option.active {
    border-left-color: #60a5fa;
    background-color: #1a2847;
    cursor: default;
  }

  .config-option:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .config-name {
    font-size: 13px;
    font-weight: 600;
    color: #e0e0e0;
    margin-bottom: 2px;
  }

  .config-url {
    font-size: 11px;
    color: #9ca3af;
    font-family: monospace;
    margin-bottom: 4px;
  }

  .active-badge {
    font-size: 10px;
    color: #4ade80;
    font-weight: 600;
  }

  .no-configs {
    margin: 0;
    padding: 8px;
    color: #9ca3af;
    font-size: 12px;
    text-align: center;
  }
</style>
