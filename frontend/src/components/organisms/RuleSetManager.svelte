<script>
  import Button from '../atoms/Button.svelte';

  export let availableSets = [];
  export let currentSetName = 'active';
  export let hasUnsavedChanges = false;
  export let onLoad;
  export let onSaveActive;
  export let onSaveAs;

  let showSaveAsDetails = false;
  let saveAsName = '';

  async function handleSaveAs() {
    await onSaveAs(saveAsName);
    showSaveAsDetails = false;
    saveAsName = '';
  }
</script>

<div class="rule-set-controls">
  <div class="rule-set-selector">
    <span class="field-label">Active Rule Set</span>
    <select 
      class="rule-set-dropdown"
      value={currentSetName}
      on:change={(e) => onLoad(e.target.value)}
    >
      {#each availableSets as setName}
        <option value={setName}>{setName}</option>
      {/each}
    </select>
    {#if hasUnsavedChanges}
      <span class="unsaved-badge">Unsaved changes</span>
    {/if}
  </div>
  
  <div class="rule-set-actions">
    <Button on:click={onSaveActive}>
      Save to Active
    </Button>
    <Button variant={ !showSaveAsDetails ? "secondary" : "primary" } on:click={() => showSaveAsDetails = !showSaveAsDetails}>
      Save As...
    </Button>
  </div>
</div>

{#if showSaveAsDetails}
<div class="save-as-details">
    <input 
      type="text" 
      class="save-name-input"
      placeholder="Enter rule set name"
      bind:value={saveAsName}
    />
    <Button size="small" on:click={handleSaveAs}>Save</Button>
</div>
{/if}

<style>
  .rule-set-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .rule-set-selector {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rule-set-dropdown {
    flex: 1;
    padding: 8px 12px;
    background-color: #1a2847;
    border: 2px solid #374151;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .rule-set-dropdown:hover {
    border-color: #60a5fa;
  }

  .rule-set-dropdown:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
  }

  .unsaved-badge {
    padding: 4px 10px;
    background-color: rgba(251, 146, 60, 0.15);
    border: 2px solid rgba(251, 146, 60, 0.4);
    border-radius: 4px;
    color: #fb923c;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .rule-set-actions {
    display: flex;
    gap: 8px;
  }
  .save-as-details{
    margin-top: 20px;
    margin-bottom: 5px;
  }

  .save-name-input {
    width: 100%;
    padding: 8px 12px;
    background-color: #1a2847;
    border: 2px solid #374151;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 13px;
    font-family: inherit;
    margin-bottom: 16px;
    box-sizing: border-box;
  }

  .save-name-input:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
  }
</style>
