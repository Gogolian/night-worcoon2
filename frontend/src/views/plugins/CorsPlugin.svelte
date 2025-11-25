<script>
  import { plugins, togglePlugin } from '../../stores/plugins.js';
  import PluginHeader from '../../components/organisms/PluginHeader.svelte';
  import PluginSection from '../../components/molecules/PluginSection.svelte';
  import PluginOption from '../../components/molecules/PluginOption.svelte';

  $: plugin = $plugins.find(p => p.name === 'cors');
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
        <p><strong>Purpose:</strong> Adds CORS headers to enable cross-origin requests in development.</p>
        <p><strong>Impact:</strong> Modifies response headers to include Access-Control-* headers.</p>
        <p><strong>Headers Added:</strong></p>
        <ul>
          <li>Access-Control-Allow-Origin</li>
          <li>Access-Control-Allow-Methods</li>
          <li>Access-Control-Allow-Headers</li>
          <li>Access-Control-Allow-Credentials</li>
        </ul>
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

  .about-content ul {
    margin: 0;
    padding-left: 20px;
    color: #9ca3af;
  }

  .about-content li {
    font-size: 12px;
    line-height: 1.8;
    font-family: 'Courier New', monospace;
  }

  .about-content strong {
    color: #60a5fa;
  }
</style>
