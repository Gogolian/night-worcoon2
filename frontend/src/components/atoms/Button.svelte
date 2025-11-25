<script>
  export let variant = 'primary'; // 'primary' | 'secondary' | 'danger'
  export let size = 'medium'; // 'small' | 'medium' | 'large'
  export let disabled = false;
</script>

<button
  class="button-atom button-{variant} button-{size}"
  {disabled}
  on:click
>
  <slot />
</button>

<style>
  .button-atom {
    border: 2px solid #374151;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
    font-size: 12px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .button-atom:hover:not(:disabled) {
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
    transform: translateY(-1px);
  }

  .button-atom:active:not(:disabled) {
    transform: translateY(0);
  }

  .button-atom:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Sizes */
  .button-small {
    padding: 6px 12px;
    font-size: 11px;
  }

  .button-medium {
    padding: 8px 16px;
    font-size: 12px;
  }

  .button-large {
    padding: 10px 20px;
    font-size: 13px;
  }

  /* Variants */
  .button-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    color: #ffffff;
    border-color: #60a5fa;
  }

  .button-primary:hover:not(:disabled) {
    border-color: #60a5fa;
    box-shadow: 0 2px 8px rgba(96, 165, 250, 0.4);
  }

  .button-secondary {
    background-color: #1a2847;
    color: #d4d4d8;
    border-color: #374151;
  }

  .button-secondary:hover:not(:disabled) {
    border-color: #60a5fa;
    background-color: #1e293b;
  }

  .button-danger {
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
    color: #ffffff;
    border-color: #ef4444;
  }

  .button-danger:hover:not(:disabled) {
    border-color: #ef4444;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  }
</style>
