<script>
  import Checkbox from '../atoms/Checkbox.svelte';

  export let optionKey;
  export let option;
</script>

<div class="option-item">
  <div class="option-header">
    <span class="option-label">{option.label}</span>
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

<style>
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
</style>
