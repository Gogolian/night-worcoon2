<script>
  import { plugins, togglePlugin } from '../../stores/plugins.js';
  import PluginHeader from '../../components/organisms/PluginHeader.svelte';
  import PluginSection from '../../components/molecules/PluginSection.svelte';
  import PluginOption from '../../components/molecules/PluginOption.svelte';

  $: plugin = $plugins.find(p => p.name === 'recorder');
  $: options = plugin?.options || {};

  async function handleToggle() {
    if (plugin) {
      await togglePlugin(plugin.name, !plugin.enabled);
    }
  }
</script>

<div class="plugin-page">
  {#if plugin}
    <PluginHeader {plugin} onToggle={handleToggle} />

    <PluginSection title="Configuration">
      <div class="options-grid">
        {#each Object.entries(options) as [key, option]}
          <PluginOption optionKey={key} {option} />
        {/each}
      </div>
    </PluginSection>

    <PluginSection title="About">
      <div class="about-content">
        <p><strong>Execution Order:</strong> #{plugin.order || 'N/A'}</p>
        <p><strong>Purpose:</strong> Captures and stores HTTP request/response pairs for later replay or analysis.</p>
        <p><strong>Impact:</strong> No modification to requests or responses, only recording.</p>
        <p><strong>Storage:</strong> Files are organized by path structure in <code>recordings/active/</code></p>
      </div>
    </PluginSection>

    <PluginSection title="Recording Info">
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
    </PluginSection>
  {/if}
</div>

<style>
  .plugin-page {
    padding: 16px;
    max-width: 1000px;
  }

  .options-grid {
    display: grid;
    gap: 20px;
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
