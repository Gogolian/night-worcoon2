<script>
  import { createEventDispatcher } from 'svelte';
  import saveIcon from '../../assets/save.svg';

  const dispatch = createEventDispatcher();

  export let isSaving = false;

  async function handleClick(event) {
    event.stopPropagation();
    
    isSaving = true;
    try {
      dispatch('save');
    } finally {
      isSaving = false;
    }
  }
</script>

<button
  class="save-btn"
  disabled={isSaving}
  on:click={handleClick}
  title="Save"
>
  {#if isSaving}
    <span>Saving...</span>
  {:else}
    <img src={saveIcon} alt="save" class="save-icon" />
  {/if}
</button>

<style>
  .save-btn {
    padding: 4px 6px;
    height: min-content;
    background-color: rgba(59, 130, 246, 0.2);
    border: 1px solid #93c5fd;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
    font-size: 11px;
    font-weight: 500;
  }

  .save-btn:hover:not(:disabled) {
    background-color: rgba(59, 130, 246, 0.3);
  }

  .save-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .save-icon {
    width: 14px;
    height: 14px;
    filter: invert(42%) sepia(84%) saturate(1269%) hue-rotate(198deg) brightness(98%) contrast(95%);
  }
</style>
