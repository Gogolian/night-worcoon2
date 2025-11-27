<script>

  import Card from '../components/molecules/Card.svelte';
  import ConfigurationSets from '../components/organisms/ConfigurationSets.svelte';
  import { proxyStatus, fetchProxyStatus, checkServerHealth } from '../stores/proxy.js';
  import { onMount, onDestroy } from 'svelte';

  let healthCheckInterval;

  onMount(async () => {
    fetchProxyStatus();
    
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
</script>

<div class="dashboard-view">
  <h1>Dashboard</h1>

  <div class="dashboard-grid">
    <Card title="Configuration Sets">
      <ConfigurationSets />
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
</style>
