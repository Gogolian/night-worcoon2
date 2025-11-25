<script>
  export let type = 'text';
  export let placeholder = '';
  export let value = '';
  export let disabled = false;
</script>

{#if type === 'text'}
  <input
    class="input-atom"
    type="text"
    {placeholder}
    bind:value
    {disabled}
    on:change
  />
{:else if type === 'email'}
  <input
    class="input-atom"
    type="email"
    {placeholder}
    bind:value
    {disabled}
    on:change
  />
{:else if type === 'password'}
  <input
    class="input-atom"
    type="password"
    {placeholder}
    bind:value
    {disabled}
    on:change
  />
{:else if type === 'number'}
  <input
    class="input-atom"
    type="number"
    {placeholder}
    bind:value
    {disabled}
    on:change
  />
{/if}

<style>
  .input-atom {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #3f3f46;
    font-size: 12px;
    font-family: inherit;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
    background-color: #18212f;
    color: #e0e0e0;
  }

  .input-atom:focus {
    outline: none;
    border-color: #60a5fa;
  }

  .input-atom:disabled {
    background-color: #0f1535;
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-atom::placeholder {
    color: #6b7280;
  }
</style>
