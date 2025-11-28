<script>
  import { createEventDispatcher } from 'svelte';
  import duplicateIcon from '../../assets/copy.svg';

  const dispatch = createEventDispatcher();

  let isDuplicating = false;

  async function handleClick(event) {
    event.stopPropagation();
    
    isDuplicating = true;
    try {
      dispatch('duplicate');
    } finally {
      isDuplicating = false;
    }
  }
</script>

<button
  class="duplicate-btn"
  disabled={isDuplicating}
  on:click={handleClick}
  title="Duplicate file"
>
  {#if isDuplicating}
    <span>Duplicating...</span>
  {:else}
    <img src={duplicateIcon} alt="Duplicate" class="duplicate-icon" />
  {/if}
</button>

<style>
  .duplicate-btn {
    padding: 4px 6px;
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

  .duplicate-btn:hover:not(:disabled) {
    background-color: rgba(59, 130, 246, 0.3);
  }

  .duplicate-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .duplicate-icon {
    width: 14px;
    height: 14px;
    filter: invert(42%) sepia(84%) saturate(1269%) hue-rotate(198deg) brightness(98%) contrast(95%);
  }
</style>
