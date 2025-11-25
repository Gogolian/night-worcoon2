<script>
  import { plugins } from '../../stores/plugins.js';
  import Card from '../../components/molecules/Card.svelte';
  import Checkbox from '../../components/atoms/Checkbox.svelte';

  $: plugin = $plugins.find(p => p.name === 'recorder');
  $: options = plugin?.options || {};
</script>

<div class="plugin-page">
  <div class="plugin-header">
    <div class="plugin-title-row">
      <h1>Recorder Plugin</h1>
      <span class="plugin-status" class:enabled={plugin?.enabled}>
        {plugin?.enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
    <p class="plugin-description-text">
      {plugin?.description || 'Records requests and responses to JSON files'}
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
            {#if option.type === 'boolean'}
              <Checkbox
                checked={option.default}
                label={option.default ? 'Yes' : 'No'}
              />
            {:else if option.type === 'number'}
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
        <p><strong>Purpose:</strong> Captures and stores HTTP request/response pairs for later replay or analysis.</p>
        <p><strong>Impact:</strong> No modification to requests or responses, only recording.</p>
        <p><strong>Storage:</strong> Files are organized by path structure in <code>recordings/active/</code></p>
      </div>
    </Card>
  </div>

  <div class="plugin-section">
    <h2>Recording Info</h2>
    <Card>
      <div class="recording-info">
        <div class="info-row">
          <span class="info-label">File Format:</span>
          <code class="info-value">METHOD_qp_bp_TIMESTAMP.json</code>
        </div>
        <div class="info-row">
          <span class="info-label">Deduplication:</span>
          <span class="info-value">Automatic (keeps newest)</span>
        </div>
        <div class="info-row">
          <span class="info-label">Organization:</span>
          <span class="info-value">By URL path structure</span>
        </div>
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

  .about-content code {
    background-color: #1a2847;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #60a5fa;
  }

  .about-content strong {
    color: #60a5fa;
  }

  .recording-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #1a2847;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-label {
    font-size: 13px;
    color: #9ca3af;
    font-weight: 500;
  }

  .info-value {
    font-size: 13px;
    color: #d4d4d8;
    font-family: 'Courier New', monospace;
  }

  code.info-value {
    background-color: #1a2847;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    color: #60a5fa;
  }
</style>
