<script>
  export let selected;
  export let onChange;
  export let compact = false;
</script>

<div class="action-buttons" class:compact>
  <button
    class="action-button"
    class:compact
    class:active={selected === 'RET_REC'}
    on:click={() => onChange('RET_REC')}
  >
    RET_REC
  </button>
  <button
    class="action-button"
    class:compact
    class:active={selected === 'PASS'}
    on:click={() => onChange('PASS')}
  >
    PASS
  </button>
</div>

<style>
  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .action-buttons.compact {
    gap: 6px;
  }

  .action-button {
    flex: 1;
    padding: 10px 20px;
    background-color: #1a2847;
    border: 2px solid #374151;
    border-radius: 4px;
    color: #9ca3af;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .action-button.compact {
    padding: 6px 14px;
    font-size: 11px;
  }

  .action-button:hover {
    border-color: #60a5fa;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
  }

  .action-button.active {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    color: #ffffff;
    border-color: #60a5fa;
    box-shadow: 0 2px 8px rgba(96, 165, 250, 0.4);
  }
</style>
