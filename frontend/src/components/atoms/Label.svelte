<script>
  export let htmlFor = '';
  export let text = '';
  export let required = false;
</script>

<label for={htmlFor} class="label-atom">
  {text}
  {#if required}
    <span class="required">*</span>
  {/if}
</label>

<style>
  .label-atom {
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    color: #d4d4d8;
    display: block;
    font-weight: 500;
  }

  .required {
    color: #f87171;
    margin-left: 3px;
  }
</style>
