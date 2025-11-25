<script>
  export let type = 'success'; // 'success' | 'error' | 'loading' | 'info'
  export let message = '';
  export let onDismiss = null;
</script>

<div class="status-message status-{type}">
  <div class="status-content">
    <span class="status-icon">
      {#if type === 'success'}
        ✓
      {:else if type === 'error'}
        ✕
      {:else if type === 'loading'}
        ⟳
      {:else if type === 'info'}
        ℹ
      {/if}
    </span>
    <span class="status-text">
      <slot>{message}</slot>
    </span>
  </div>
  {#if onDismiss}
    <button class="dismiss-btn" on:click={onDismiss}>×</button>
  {/if}
</div>

<style>
  .status-message {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    font-size: 12px;
    margin-bottom: 8px;
    border-left: 3px solid;
  }

  .status-content {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }

  .status-icon {
    font-weight: 600;
    font-size: 13px;
    flex-shrink: 0;
  }

  .status-text {
    display: flex;
    flex-direction: column;
  }

  .dismiss-btn {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    margin-left: 8px;
    opacity: 0.6;
    transition: opacity 0.2s ease;
    color: inherit;
  }

  .dismiss-btn:hover {
    opacity: 0.9;
  }

  /* Success */
  .status-success {
    background-color: #064e3b;
    color: #a7f3d0;
    border-left-color: #10b981;
  }

  /* Error */
  .status-error {
    background-color: #7f1d1d;
    color: #fecaca;
    border-left-color: #ef4444;
  }

  /* Loading */
  .status-loading {
    background-color: #1e3a8a;
    color: #93c5fd;
    border-left-color: #3b82f6;
  }

  .status-loading .status-icon {
    animation: spin 1s linear infinite;
  }

  /* Info */
  .status-info {
    background-color: #4c1d95;
    color: #d8b4fe;
    border-left-color: #a855f7;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
