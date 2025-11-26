<script>
  export let selected;
  export let onChange;
</script>

<div class="fallback-fallback-buttons">
  <button
    class="fallback-option"
    class:active={selected === '500'}
    on:click={() => onChange('500')}
  >
    Return 500
  </button>
  <button
    class="fallback-option"
    class:active={selected === '200'}
    on:click={() => onChange('200')}
  >
    Return 200
  </button>
  <button
    class="fallback-option"
    class:active={selected === 'PASS'}
    on:click={() => onChange('PASS')}
  >
    PASS
  </button>
</div>

<style>
  .fallback-fallback-buttons {
    display: flex;
    gap: 8px;
  }

  .fallback-option {
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

  .fallback-option:hover {
    border-color: #60a5fa;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
  }

  .fallback-option.active {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    color: #ffffff;
    border-color: #60a5fa;
    box-shadow: 0 2px 8px rgba(96, 165, 250, 0.4);
  }
</style>
