<script>
  import { createEventDispatcher } from 'svelte';
  import delIcon from '../../assets/del.svg';

  const dispatch = createEventDispatcher();

  let isConfirmState = false;
  let isDisabled = false;

  function handleClick(event) {
    event.stopPropagation();
    
    if (isConfirmState) {
      // Second click - confirm deletion
      dispatch('delete');
      isConfirmState = false;
      isDisabled = false;
    } else {
      // First click - enter confirm state
      isConfirmState = true;
      isDisabled = true;
      
      // Enable button after 500ms
      setTimeout(() => {
        isDisabled = false;
      }, 200);
    }
  }

  function handleMouseLeave() {
    if (isConfirmState) {
      isConfirmState = false;
      isDisabled = false;
    }
  }
</script>

<button
  class="delete-btn"
  class:confirm-state={isConfirmState}
  disabled={isDisabled}
  on:click={handleClick}
  on:mouseleave={handleMouseLeave}
  title={isConfirmState ? 'Click again to confirm deletion' : 'Delete file'}
>
{#if isConfirmState}
  Confirm Delete
{:else}
  <img src={delIcon} alt="Delete" class="delete-icon" />
{/if}

</button>

<style>
  .delete-btn {
    padding: 4px 6px;
    background-color: rgba(239, 68, 68, 0.2);
    border: 1px solid #f87171;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ef4444;
    font-size: 11px;
    font-weight: 500;
  }

  .delete-btn:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.3);
  }

  .delete-btn.confirm-state {
    background-color: #ef4444;
    border-color: #dc2626;
    color: #ffffff;
  }

  .delete-btn:disabled {
    cursor: not-allowed;
    background-color: #6b7280;
    border-color: #4b5563;
    color: #9ca3af;
  }

  .delete-icon {
    width: 14px;
    height: 14px;
    filter: invert(47%) sepia(89%) saturate(2361%) hue-rotate(335deg) brightness(98%) contrast(93%);
  }
</style>
