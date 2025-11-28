<script>
  import Button from "../atoms/Button.svelte";
  import DuplicateButton from "../atoms/DuplicateButton.svelte";
  import SaveButton from "../atoms/SaveButton.svelte";

  export let availableSets = [];
  export let currentSetName = "active";
  export let onLoad;
  export let onSaveAs;

  let showSaveAsDetails = false;
  let saveAsName = "";

  async function handleSaveAs() {
    await onSaveAs(saveAsName);
    showSaveAsDetails = false;
    saveAsName = "";
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
    <DuplicateButton
      on:duplicate={() => (showSaveAsDetails = !showSaveAsDetails)}
    />
    {#if showSaveAsDetails}
      <div class="save-as-details">
        <input
          type="text"
          class="save-name-input"
          placeholder="Enter rule set name"
          bind:value={saveAsName}
        />
        <SaveButton on:save={handleSaveAs} />
      </div>
    {/if}
  </div>
</div>

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
  .save-as-details {
    display: flex;
    align-items: center;
    gap: 8px;
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
    box-sizing: border-box;
  }

  .save-name-input:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
  }
</style>
