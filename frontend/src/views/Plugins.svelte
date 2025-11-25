<script>
  import { onMount } from 'svelte';
  import { plugins, fetchPlugins, togglePlugin } from '../stores/plugins.js';
  import Checkbox from '../components/atoms/Checkbox.svelte';
  import Card from '../components/molecules/Card.svelte';

  onMount(() => {
    fetchPlugins();
  });

  async function handleToggle(pluginName, event) {
    const enabled = event.target.checked;
    console.log(`Toggle ${pluginName} to ${enabled}`);
    await togglePlugin(pluginName, enabled);
  }
</script>

<div class="plugins-view">
  <div class="plugins-header">
    <h1>Plugins</h1>
    <p class="plugins-description">
      Enable or disable proxy plugins to customize request/response handling
    </p>
  </div>

  <div class="plugins-grid">
    {#each $plugins as plugin, index (plugin.name)}
      <Card>
        <div class="plugin-card">
          <div class="plugin-order">
            <div class="order-badge" class:enabled={plugin.enabled}>
              {index + 1}
            </div>
            {#if index < $plugins.length - 1}
              <div class="order-arrow">↓</div>
            {/if}
          </div>
          <div class="plugin-info">
            <h3 class="plugin-name">{plugin.name}</h3>
            <p class="plugin-description">{plugin.description}</p>
            {#if Object.keys(plugin.options || {}).length > 0}
              <div class="plugin-options-hint">
                {Object.keys(plugin.options).length} options available
              </div>
            {/if}
          </div>
          <div class="plugin-control">
            <Checkbox
              checked={plugin.enabled}
              on:change={(e) => handleToggle(plugin.name, e)}
              label={plugin.enabled ? 'Enabled' : 'Disabled'}
            />
          </div>
        </div>
      </Card>
    {/each}
  </div>

  {#if $plugins.length === 0}
    <div class="empty-state">
      <p>No plugins available</p>
    </div>
  {/if}
</div>

<style>
  .plugins-view {
    padding: 16px;
  }

  .plugins-header {
    margin-bottom: 20px;
  }

  .plugins-header h1 {
    font-size: 20px;
    font-weight: 600;
    color: #d4d4d8;
    margin: 0 0 6px 0;
  }

  .plugins-description {
    font-size: 12px;
    color: #9ca3af;
    margin: 0;
  }

  .plugins-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 900px;
  }

  .plugin-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .plugin-order {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .order-badge {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: #374151;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    border: 2px solid #4b5563;
  }

  .order-badge.enabled {
    background-color: #1e3a8a;
    color: #60a5fa;
    border-color: #3b82f6;
  }

  .order-arrow {
    color: #4b5563;
    font-size: 16px;
    line-height: 1;
  }

  .plugin-info {
    flex: 1;
    min-width: 0;
  }

  .plugin-name {
    font-size: 14px;
    font-weight: 600;
    color: #d4d4d8;
    margin: 0 0 4px 0;
    font-family: 'Courier New', monospace;
  }

  .plugin-description {
    font-size: 12px;
    color: #9ca3af;
    margin: 0 0 6px 0;
    line-height: 1.4;
  }

  .plugin-options-hint {
    font-size: 11px;
    color: #6b7280;
    font-style: italic;
  }

  .plugin-control {
    flex-shrink: 0;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: #6b7280;
    font-size: 13px;
  }
</style>
