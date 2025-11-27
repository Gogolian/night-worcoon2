<script>
  export let text = '';
  export let variant = 'default'; // default, success, error, warning, info, primary, secondary
  export let size = 'small'; // small, medium
</script>

<span class="badge badge-{variant} badge-{size}">
  {text}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 600;
    white-space: nowrap;
  }

  .badge-small {
    font-size: 10px;
  }

  .badge-medium {
    font-size: 11px;
    padding: 3px 8px;
  }

  .badge-default {
    background-color: #374151;
    color: #e0e0e0;
  }

  .badge-success {
    background-color: #16a34a;
    color: #e0e0e0;
  }

  .badge-error {
    background-color: #dc2626;
    color: #e0e0e0;
  }

  .badge-warning {
    background-color: #f59e0b;
    color: #1f2937;
  }

  .badge-info {
    background-color: #3b82f6;
    color: #e0e0e0;
  }

  .badge-primary {
    background-color: #60a5fa;
    color: #0f1535;
  }

  .badge-secondary {
    background-color: #2563eb;
    color: #e0e0e0;
  }
</style>
