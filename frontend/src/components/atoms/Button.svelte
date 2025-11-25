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
    border: none;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
    font-family: inherit;
    font-size: 12px;
  }

  .button-atom:disabled {
    opacity: 0.5;
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
    background-color: #2563eb;
    color: #e0e0e0;
  }

  .button-primary:hover:not(:disabled) {
    background-color: #1d4ed8;
  }

  .button-secondary {
    background-color: #3f3f46;
    color: #d4d4d8;
  }

  .button-secondary:hover:not(:disabled) {
    background-color: #52525b;
  }

  .button-danger {
    background-color: #dc2626;
    color: #fecaca;
  }

  .button-danger:hover:not(:disabled) {
    background-color: #b91c1c;
  }
</style>
