<script>
  export let id = '';
  export let checked = false;
  export let disabled = false;
</script>

<input
  {id}
  type="checkbox"
  bind:checked
  {disabled}
  on:change
  class="checkbox-atom"
/>

<style>
  .checkbox-atom {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #60a5fa;
  }

  .checkbox-atom:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
