<script>
  import Label from '../atoms/Label.svelte';
  import Input from '../atoms/Input.svelte';

  export let folders = [];
  export let selectedFolder = 'active';
  export let filterText = '';
  export let loading = false;
</script>

<div class="recordings-controls">
  <div class="control-group">
    <Label htmlFor="folder-select" text="Recording Folder" />
    <select 
      id="folder-select" 
      bind:value={selectedFolder}
      class="folder-select"
      disabled={loading || folders.length === 0}
    >
      {#if folders.length === 0}
        <option value="">No folders available</option>
      {:else}
        {#each folders as folder}
          <option value={folder}>{folder}</option>
        {/each}
      {/if}
    </select>
  </div>

  <div class="control-group">
    <Label htmlFor="filter-input" text="Filter Files" />
    <Input
      id="filter-input"
      type="text"
      placeholder="Type to filter... e.g., bff/one/etc or POST"
      bind:value={filterText}
      disabled={loading}
    />
  </div>
</div>

<style>
  .recordings-controls {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .folder-select {
    padding: 6px 8px;
    background-color: #0f1535;
    border: 1px solid #1a2847;
    color: #e0e0e0;
    font-size: 12px;
    border-radius: 3px;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .folder-select:hover:not(:disabled) {
    border-color: #3b82f6;
  }

  .folder-select:focus {
    outline: none;
    border-color: #60a5fa;
  }

  .folder-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
