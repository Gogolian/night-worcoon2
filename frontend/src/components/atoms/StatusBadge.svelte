<script>
  export let enabled = false;
  export let enabledText = 'Enabled';
  export let disabledText = 'Disabled';
</script>

<span class="status-badge" class:enabled>
  {enabled ? enabledText : disabledText}
</span>

<style>
  .status-badge {
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background-color: #1a2847;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 2px solid #374151;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .status-badge.enabled {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    color: #ffffff;
    border-color: #60a5fa;
    box-shadow: 0 2px 8px rgba(96, 165, 250, 0.4);
  }
</style>
