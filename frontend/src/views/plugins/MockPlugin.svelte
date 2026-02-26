<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { plugins, togglePlugin } from '../../stores/plugins.js';
  import { activeRecordingsFolder, prefetchTopLevel } from '../../stores/recordingsDirs.js';
  import { pendingMockEntry } from '../../stores/logs.js';
  import PluginHeader from '../../components/organisms/PluginHeader.svelte';
  import PluginSection from '../../components/molecules/PluginSection.svelte';
  import RuleSetManager from '../../components/organisms/RuleSetManager.svelte';
  import MockRulesList from '../../components/organisms/MockRulesList.svelte';
  import MockFallback from '../../components/organisms/MockFallback.svelte';

  $: plugin = $plugins.find(p => p.name === 'mock');

  let rules = [];
  let fallback = 'PASS';
  let fallback_fallback = 'PASS';
  let recordingsFolder = 'active';
  let availableSets = [];
  let currentSetName = 'active';

  onMount(async () => {
    // Capture and clear the pending entry synchronously before any awaits.
    // This prevents a race where a stale async onMount chain from a previously
    // destroyed component consumes the pending entry that belongs to the new instance.
    const pending = get(pendingMockEntry);
    if (pending) pendingMockEntry.set(null);

    await loadAvailableSets();
    await loadServerConfig();
    await loadActiveConfig();

    // If a log entry was pending (user clicked "Mock" from Logs view), pre-fill a rule
    if (pending) {
      try {
        const u = new URL(pending.request.url, 'http://x');
        const pathname = u.pathname;
        const bodyStr = pending.response.body || '{}';
        // Validate / pretty-print body
        let prettyBody = bodyStr;
        try { prettyBody = JSON.stringify(JSON.parse(bodyStr), null, 2); } catch {}
        const newRule = {
          method: [pending.request.method],
          url: pathname,
          action: 'RET_INLINE',
          inlineResponse: {
            statusCode: pending.response.status || 200,
            headers: {},
            body: prettyBody
          }
        };
        rules = [newRule, ...rules];
        await saveActiveRuleSet();
      } catch (err) {
        console.error('Failed to create rule from log entry:', err);
      }
    }
  });

  async function loadServerConfig() {
    try {
      const response = await fetch('/__api/config');
      const config = await response.json();
      if (config.activeRulesSet) {
        currentSetName = config.activeRulesSet;
      }
    } catch (err) {
      console.error('Failed to load server config:', err);
    }
  }

  async function handleToggle() {
    if (plugin) {
      await togglePlugin(plugin.name, !plugin.enabled);
    }
  }

  async function loadAvailableSets() {
    try {
      const response = await fetch('/__api/rules/sets');
      const data = await response.json();
      availableSets = data.sets || [];
    } catch (err) {
      console.error('Failed to load rule sets:', err);
    }
  }

  async function loadActiveConfig() {
    try {
      const response = await fetch(`/__api/rules/sets/${currentSetName}`);
      const data = await response.json();
      rules = data.rules || [];
      fallback = data.fallback || 'PASS';
      fallback_fallback = data.fallback_fallback || 'PASS';
      recordingsFolder = data.recordingsFolder || 'active';
      activeRecordingsFolder.set(recordingsFolder);
      prefetchTopLevel(recordingsFolder);
    } catch (err) {
      console.error('Failed to load active config:', err);
    }
  }

  async function loadRuleSet(name) {
    if (name === currentSetName) return;

    try {
      const response = await fetch(`/__api/rules/sets/${name}`);
      const data = await response.json();
      rules = data.rules || [];
      fallback = data.fallback || 'PASS';
      fallback_fallback = data.fallback_fallback || 'PASS';
      recordingsFolder = data.recordingsFolder || 'active';
      currentSetName = name;
      activeRecordingsFolder.set(recordingsFolder);
      prefetchTopLevel(recordingsFolder);
      
      // Save the active rules set to state
      await fetch('/__api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeRulesSet: name })
      });
    } catch (err) {
      console.error('Failed to load rule set:', err);
    }
  }

  async function saveActiveRuleSet() {
    try {
      await fetch(`/__api/rules/sets/${currentSetName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, fallback, fallback_fallback, recordingsFolder })
      });
    } catch (err) {
      console.error('Failed to save rules:', err);
    }
  }

  async function saveRuleSetAs(name) {
    if (!name.trim()) {
      return;
    }

    try {
      const response = await fetch(`/__api/rules/sets/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, fallback, fallback_fallback, recordingsFolder })
      });
      if (response.ok) {
        await loadAvailableSets();
      }
    } catch (err) {
      console.error('Failed to save rule set:', err);
    }
  }

  async function addRule() {
    rules = [...rules, { method: ['GET'], url: '', action: 'RET_REC' }];
    await saveActiveRuleSet();
  }

  async function removeRule(index) {
    rules = rules.filter((_, i) => i !== index);
    await saveActiveRuleSet();
  }

  async function updateRuleMethod(index, methods) {
    rules[index].method = methods;
    rules = [...rules]; // Trigger reactivity
    await saveActiveRuleSet();
  }

  async function updateRuleUrl(index, event) {
    rules[index].url = event.target.value;
    await saveActiveRuleSet();
  }

  async function updateRuleAction(index, action) {
    rules[index].action = action;
    // When switching to RET_INLINE, seed an empty inlineResponse if not present
    if (action === 'RET_INLINE' && !rules[index].inlineResponse) {
      rules[index].inlineResponse = { statusCode: 200, headers: {}, body: '{}' };
    }
    rules = [...rules];
    await saveActiveRuleSet();
  }

  async function updateRuleInlineResponse(index, inlineResponse) {
    rules[index].inlineResponse = inlineResponse;
    rules = [...rules];
    await saveActiveRuleSet();
  }

  async function updateFallback(action) {
    fallback = action;
    await saveActiveRuleSet();
  }

  async function updateFallbackFallback(action) {
    fallback_fallback = action;
    await saveActiveRuleSet();
  }

  async function updateRecordingsFolder(folder) {
    recordingsFolder = folder;
    activeRecordingsFolder.set(folder);
    prefetchTopLevel(folder);
    await saveActiveRuleSet();
  }
</script>

<div class="plugin-page">
  {#if plugin}
    <PluginHeader {plugin} onToggle={handleToggle} />

    <PluginSection title="Rule Set Management">
      {#if currentSetName}
      <RuleSetManager
        {availableSets}
        {currentSetName}
        onLoad={loadRuleSet}
        onSaveAs={saveRuleSetAs}
      />
      {/if}
    </PluginSection>

    <PluginSection title="Mock Rules">
      <MockRulesList
        {rules}
        onAddRule={addRule}
        onRemoveRule={removeRule}
        onUpdateMethod={updateRuleMethod}
        onUpdateUrl={updateRuleUrl}
        onUpdateAction={updateRuleAction}
        onUpdateInlineResponse={updateRuleInlineResponse}
      />
    </PluginSection>

    <PluginSection title="Fallback">
      <MockFallback 
        {fallback} 
        {fallback_fallback} 
        {recordingsFolder}
        onChange={updateFallback} 
        onChangeFallbackFallback={updateFallbackFallback}
        onChangeRecordingsFolder={updateRecordingsFolder}
      />
    </PluginSection>

    <PluginSection title="About">
      <div class="about-content">
        <p><strong>Execution Order:</strong> #{plugin.order || 'N/A'}</p>
        <p><strong>Purpose:</strong> Route requests to return recordings from the recorder plugin or pass to target server.</p>
        <p><strong>RET_REC:</strong> Returns response from active recordings folder matching the request.</p>
        <p><strong>PASS:</strong> Forwards the request to the target server.</p>
        <p><strong>Fallback Fallback:</strong> When primary fallback is RET_REC and no recording is found, you can choose to return a 500 error, 200 success, or PASS the request through.</p>
      </div>
    </PluginSection>
  {/if}
</div>

<style>
  .plugin-page {
    padding: 16px;
    max-width: 1000px;
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
