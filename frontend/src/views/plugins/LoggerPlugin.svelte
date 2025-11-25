<script>
  import { plugins, togglePlugin } from '../../stores/plugins.js';
  import PluginHeader from '../../components/organisms/PluginHeader.svelte';
  import PluginSection from '../../components/molecules/PluginSection.svelte';
  import PluginOption from '../../components/molecules/PluginOption.svelte';

  $: plugin = $plugins.find(p => p.name === 'logger');
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
        <p><strong>Purpose:</strong> Logs all HTTP requests and responses with configurable detail levels.</p>
        <p><strong>Impact:</strong> No modification to requests or responses, only logging.</p>
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

  .about-content strong {
    color: #60a5fa;
  }
</style>
