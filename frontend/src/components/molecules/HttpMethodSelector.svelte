<script>
  export let selected = 'GET'; // For single mode: string, for multiple mode: array
  export let onChange = () => {};
  export let multiple = false; // false = radio (single), true = checkbox (multiple)

  const methods = [
    { name: 'GET', color: '#10b981' },      // green
    { name: 'POST', color: '#3b82f6' },     // blue
    { name: 'PATCH', color: '#8b5cf6' },    // purple
    { name: 'PUT', color: '#f59e0b' },      // orange
    { name: 'DELETE', color: '#ef4444' },   // red
    { name: 'OPTIONS', color: '#6b7280' },   // gray
    { name: 'HEAD', color: '#06b6d4' }     // cyan
  ];

  function handleClick(method) {
    if (multiple) {
      // Multiple selection mode (checkbox)
      const selectedArray = Array.isArray(selected) ? selected : [];
      if (selectedArray.includes(method)) {
        selected = selectedArray.filter(m => m !== method);
      } else {
        selected = [...selectedArray, method];
      }
    } else {
      // Single selection mode (radio)
      selected = method;
    }
    onChange(selected);
  }

  $: isSelected = (method) => {
    if (multiple) {
      return Array.isArray(selected) && selected.includes(method);
    }
    return selected === method;
  };
</script>

<div class="method-selector">
  {#each methods as method}
    <button
      class="method-button"
      class:active={isSelected(method.name)}
      style="--method-color: {method.color}"
      on:click={() => handleClick(method.name)}
    >
      {method.name}
    </button>
  {/each}
</div>

<style>
  .method-selector {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .method-button {
    padding: 6px 14px;
    border: 2px solid;
    border-color: var(--method-color);
    background-color: #1a2847;
    color: var(--method-color);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    opacity: 0.4;
  }

  .method-button:hover {
    opacity: 0.7;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
  }

  .method-button:active {
    transform: translateY(0);
  }

  .method-button.active {
    opacity: 1;
    background: linear-gradient(135deg, var(--method-color) 0%, var(--method-color) 100%);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    filter: brightness(0.9);
  }

  .method-button.active:hover {
    filter: brightness(1);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  }
</style>
