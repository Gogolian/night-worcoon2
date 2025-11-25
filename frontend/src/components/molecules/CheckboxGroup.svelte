<script>
  import Checkbox from '../atoms/Checkbox.svelte';
  import Label from '../atoms/Label.svelte';

  export let id = '';
  export let label = '';
  export let checked = false;
  export let disabled = false;
  export let required = false;
</script>

<div class="checkbox-group">
  <Checkbox {id} bind:checked {disabled} on:change />
  <Label htmlFor={id} text={label} {required} />
</div>

<style>
  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
