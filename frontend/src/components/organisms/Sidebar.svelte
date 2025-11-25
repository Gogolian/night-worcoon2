<script>
  export let items = []; // Array of { id, label, icon?, active? }
  export let onItemClick;
</script>

<aside class="sidebar-organism">
  <nav class="sidebar-nav">
    {#each items as item (item.id)}
      <button
        class="sidebar-item"
        class:active={item.active}
        class:plugin-item={item.isPlugin}
        on:click={() => onItemClick(item.id)}
      >
        {#if item.icon}
          <span class="sidebar-icon">{item.icon}</span>
        {/if}
        <span class="sidebar-label">{item.label}</span>
      </button>
    {/each}
  </nav>
</aside>

<style>
  .sidebar-organism {
    width: 200px;
    background-color: #0f1535;
    border-right: 1px solid #1a2847;
    height: calc(100vh - 44px);
    overflow-y: auto;
    position: sticky;
    top: 44px;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    background-color: transparent;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    font-family: inherit;
    border-left: 3px solid transparent;
  }

  .sidebar-item:hover {
    background-color: #1a2847;
    color: #d4d4d8;
  }

  .sidebar-item.active {
    background-color: #1e3a8a;
    color: #60a5fa;
    border-left-color: #60a5fa;
  }

  .sidebar-item.plugin-item {
    padding-left: 24px;
    font-size: 12px;
    background-color: rgba(26, 40, 71, 0.3);
  }

  .sidebar-item.plugin-item:hover {
    background-color: #1a2847;
  }

  .sidebar-item.plugin-item.active {
    background-color: #1e3a8a;
  }

  .sidebar-icon {
    font-size: 14px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .sidebar-label {
    flex: 1;
  }
</style>
