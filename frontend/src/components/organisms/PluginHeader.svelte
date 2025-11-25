<script>
  import Button from '../atoms/Button.svelte';
  import StatusBadge from '../atoms/StatusBadge.svelte';

  export let plugin;
  export let onToggle;
</script>

<div class="plugin-header">
  <div class="plugin-title-row">
    <h1>{plugin.name.charAt(0).toUpperCase() + plugin.name.slice(1)} Plugin</h1>
    <div class="plugin-controls">
      <StatusBadge enabled={plugin.enabled} />
      <Button on:click={onToggle}>
        {plugin.enabled ? 'Disable' : 'Enable'}
      </Button>
    </div>
  </div>
  <p class="plugin-description-text">
    {plugin.description || 'No description available'}
  </p>
</div>

<style>
  .plugin-header {
    margin-bottom: 24px;
  }

  .plugin-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .plugin-header h1 {
    font-size: 24px;
    font-weight: 600;
    color: #d4d4d8;
    margin: 0;
  }

  .plugin-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .plugin-description-text {
    font-size: 13px;
    color: #9ca3af;
    margin: 0;
  }
</style>
