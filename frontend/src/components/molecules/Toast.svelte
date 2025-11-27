<script>
  import { toast } from '../../stores/toast.js';
  import { fly, fade } from 'svelte/transition';

  function getIcon(type) {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  }
</script>

<div class="toast-container">
  {#each $toast as item (item.id)}
    <div 
      class="toast toast-{item.type}"
      transition:fly="{{ y: -20, duration: 300 }}"
      role="alert"
    >
      <span class="toast-icon">{getIcon(item.type)}</span>
      <span class="toast-message">{item.message}</span>
      <button class="toast-close" on:click={() => toast.dismiss(item.id)}>
        ✕
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 300px;
    max-width: 500px;
    padding: 12px 16px;
    background: #1a2847;
    border-left: 4px solid;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
  }

  .toast-icon {
    font-size: 16px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .toast-message {
    flex: 1;
    color: #e0e0e0;
    font-size: 13px;
    line-height: 1.4;
  }

  .toast-close {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: color 0.2s;
  }

  .toast-close:hover {
    color: #e0e0e0;
  }

  .toast-success {
    border-left-color: #4ade80;
  }

  .toast-success .toast-icon {
    color: #4ade80;
  }

  .toast-error {
    border-left-color: #f87171;
  }

  .toast-error .toast-icon {
    color: #f87171;
  }

  .toast-warning {
    border-left-color: #fbbf24;
  }

  .toast-warning .toast-icon {
    color: #fbbf24;
  }

  .toast-info {
    border-left-color: #60a5fa;
  }

  .toast-info .toast-icon {
    color: #60a5fa;
  }
</style>
