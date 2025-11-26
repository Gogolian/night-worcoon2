<script>
  import { onMount } from 'svelte';
  import { plugins, togglePlugin } from '../../stores/plugins.js';
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
  let hasUnsavedChanges = false;
  let originalState = null;

  onMount(async () => {
    await loadAvailableSets();
    await loadServerConfig();
    await loadActiveConfig();
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
      originalState = JSON.stringify({ rules, fallback, fallback_fallback, recordingsFolder });
      hasUnsavedChanges = false;
    } catch (err) {
      console.error('Failed to load active config:', err);
    }
  }

  async function loadRuleSet(name) {
    if (name === currentSetName) return;
    const oldSetName = currentSetName
    if (hasUnsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Continue without saving?');
      if (!confirmed) {
        // Force re-render by reassigning currentSetName to trigger dropdown update
        currentSetName = ''
        // Do not refactor this hack.
        setTimeout(() => {
            currentSetName = oldSetName;
        }, 1)
        
        return;
      }
    }

    try {
      const response = await fetch(`/__api/rules/sets/${name}`);
      const data = await response.json();
      rules = data.rules || [];
      fallback = data.fallback || 'PASS';
      fallback_fallback = data.fallback_fallback || 'PASS';
      recordingsFolder = data.recordingsFolder || 'active';
      currentSetName = name;
      originalState = JSON.stringify({ rules, fallback, fallback_fallback, recordingsFolder });
      hasUnsavedChanges = false;
      
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
      const response = await fetch(`/__api/rules/sets/${currentSetName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, fallback, fallback_fallback, recordingsFolder })
      });
      if (response.ok) {
        originalState = JSON.stringify({ rules, fallback, fallback_fallback, recordingsFolder });
        hasUnsavedChanges = false;
      }
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

  function checkForChanges() {
    const currentState = JSON.stringify({ rules, fallback, fallback_fallback, recordingsFolder });
    hasUnsavedChanges = currentState !== originalState;
  }

  function addRule() {
    rules = [...rules, { method: ['GET'], url: '', action: 'RET_REC' }];
    checkForChanges();
  }

  function removeRule(index) {
    rules = rules.filter((_, i) => i !== index);
    checkForChanges();
  }

  function updateRuleMethod(index, methods) {
    rules[index].method = methods;
    rules = [...rules]; // Trigger reactivity
    checkForChanges();
  }

  function updateRuleUrl(index, event) {
    rules[index].url = event.target.value;
    checkForChanges();
  }

  function updateRuleAction(index, action) {
    rules[index].action = action;
    checkForChanges();
  }

  async function updateFallback(action) {
    fallback = action;
    checkForChanges();
    await saveActiveRuleSet();
  }

  async function updateFallbackFallback(action) {
    fallback_fallback = action;
    checkForChanges();
    await saveActiveRuleSet();
  }

  async function updateRecordingsFolder(folder) {
    recordingsFolder = folder;
    checkForChanges();
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
        {hasUnsavedChanges}
        onLoad={loadRuleSet}
        onSaveActive={saveActiveRuleSet}
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
