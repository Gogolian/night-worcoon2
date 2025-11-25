<script>
  import { plugins } from '../../stores/plugins.js';
  import Card from '../../components/molecules/Card.svelte';

  $: plugin = $plugins.find(p => p.name === 'mock');
  $: options = plugin?.options || {};
</script>

<div class="plugin-page">
  <div class="plugin-header">
    <div class="plugin-title-row">
      <h1>Mock Plugin</h1>
      <span class="plugin-status" class:enabled={plugin?.enabled}>
        {plugin?.enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
    <p class="plugin-description-text">
      {plugin?.description || 'Returns mock responses for specific endpoints'}
    </p>
  </div>

  <div class="plugin-section">
    <h2>Configuration</h2>
    <Card>
      <div class="options-grid">
        {#each Object.entries(options) as [key, option]}
          <div class="option-item">
            <div class="option-header">
              <label class="option-label">{option.label}</label>
              <span class="option-type">{option.type}</span>
            </div>
            <p class="option-description">{option.description}</p>
            {#if option.type === 'number'}
              <input type="number" value={option.default} class="option-input" />
            {:else}
              <input type="text" value={option.default} class="option-input" />
            {/if}
          </div>
        {/each}
      </div>
    </Card>
  </div>

  <div class="plugin-section">
    <h2>About</h2>
    <Card>
      <div class="about-content">
        <p><strong>Execution Order:</strong> #{plugin?.order || 'N/A'}</p>
        <p><strong>Purpose:</strong> Returns predefined mock responses without proxying to the target server.</p>
        <p><strong>Impact:</strong> Can completely bypass the proxy for matched endpoints.</p>
        <p><strong>Use Case:</strong> Testing frontend with fake data, simulating API responses, or offline development.</p>
      </div>
    </Card>
  </div>

  <div class="plugin-section">
    <h2>Mock Rules</h2>
    <Card>
      <div class="mock-rules-content">
        <p class="mock-hint">Mock rules are currently configured in the plugin code. Future versions will support UI-based rule management.</p>
      </div>
    </Card>
  </div>
</div>

<style>
  .plugin-page {
    padding: 16px;
    max-width: 1000px;
  }

  .plugin-header {
    margin-bottom: 24px;
  }

  .plugin-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .plugin-header h1 {
    font-size: 24px;
    font-weight: 600;
    color: #d4d4d8;
    margin: 0;
  }

  .plugin-status {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    background-color: #374151;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .plugin-status.enabled {
    background-color: #1e3a8a;
    color: #60a5fa;
  }

  .plugin-description-text {
    font-size: 13px;
    color: #9ca3af;
    margin: 0;
  }

  .plugin-section {
    margin-bottom: 20px;
  }

  .plugin-section h2 {
    font-size: 16px;
    font-weight: 600;
    color: #d4d4d8;
    margin: 0 0 12px 0;
  }

  .options-grid {
    display: grid;
    gap: 20px;
  }

  .option-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .option-label {
    font-size: 13px;
    font-weight: 600;
    color: #d4d4d8;
  }

  .option-type {
    font-size: 11px;
    color: #6b7280;
    font-family: 'Courier New', monospace;
    background-color: #1a2847;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .option-description {
    font-size: 12px;
    color: #9ca3af;
    margin: 0;
  }

  .option-input {
    padding: 6px 10px;
    background-color: #1a2847;
    border: 1px solid #374151;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 13px;
    font-family: inherit;
  }

  .option-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .about-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
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

  .mock-rules-content {
    padding: 8px 0;
  }

  .mock-hint {
    font-size: 12px;
    color: #9ca3af;
    font-style: italic;
    margin: 0;
  }
</style>
