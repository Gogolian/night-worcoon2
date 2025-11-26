<script>
  import Button from '../atoms/Button.svelte';
  import HttpMethodSelector from './HttpMethodSelector.svelte';

  export let rule;
  export let index;
  export let onRemove;
  export let onMethodChange;
  export let onUrlChange;
  export let onActionChange;
</script>

<div class="rule-card">
  <div class="rule-header">
    <span class="rule-number">Rule #{index + 1}</span>
    <Button variant="danger" size="small" on:click={() => onRemove(index)}>
      Remove
    </Button>
  </div>
  
  <div class="rule-field">
    <div class="method-action-row">
      <div class="method-section">
        <span class="field-label">HTTP Method</span>
        <HttpMethodSelector 
          selected={rule.method}
          multiple={true}
          onChange={(methods) => onMethodChange(index, methods)}
        />
      </div>
      <div class="action-section">
        <span class="field-label">Action</span>
        <div class="action-buttons-compact">
          <button
            class="action-button-compact"
            class:active={rule.action === 'RET_REC'}
            on:click={() => onActionChange(index, 'RET_REC')}
          >
            RET_REC
          </button>
          <button
            class="action-button-compact"
            class:active={rule.action === 'PASS'}
            on:click={() => onActionChange(index, 'PASS')}
          >
            PASS
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="rule-field">
    <span class="field-label">URL Pattern</span>
    <input 
      type="text" 
      class="url-input"
      placeholder="e.g., /api/users or /api/*/details"
      value={rule.url}
      on:input={(e) => onUrlChange(index, e)}
    />
  </div>
</div>

<style>
  .rule-card {
    padding: 16px;
    background-color: #0f1535;
    border: 2px solid #1a2847;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .rule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid #1a2847;
  }

  .rule-number {
    font-size: 13px;
    font-weight: 600;
    color: #60a5fa;
  }

  .rule-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .url-input {
    padding: 8px 12px;
    background-color: #1a2847;
    border: 2px solid #374151;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 13px;
    font-family: 'Courier New', monospace;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .url-input:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
  }

  .url-input::placeholder {
    color: #6b7280;
  }

  .method-action-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .method-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .action-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 160px;
  }

  .action-buttons-compact {
    display: flex;
    gap: 6px;
  }

  .action-button-compact {
    flex: 1;
    padding: 6px 14px;
    background-color: #1a2847;
    border: 2px solid #374151;
    border-radius: 4px;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .action-button-compact:hover {
    border-color: #60a5fa;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
  }

  .action-button-compact.active {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    color: #ffffff;
    border-color: #60a5fa;
    box-shadow: 0 2px 8px rgba(96, 165, 250, 0.4);
  }
</style>
