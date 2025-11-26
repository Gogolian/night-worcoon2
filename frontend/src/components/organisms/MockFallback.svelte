<script>
  import ActionButtons from '../molecules/ActionButtons.svelte';
  import FallbackFallbackSelector from '../molecules/FallbackFallbackSelector.svelte';

  export let fallback;
  export let fallback_fallback = 'PASS';
  export let recordingsFolder = 'active';
  export let onChange;
  export let onChangeFallbackFallback;
  export let onChangeRecordingsFolder;
</script>

<div class="fallback-container">
  <div class="fallback-section">
    <p class="fallback-description">When no rules match, the request will:</p>
    <ActionButtons selected={fallback} {onChange} />
  </div>

  {#if fallback === 'RET_REC'}
    <div class="fallback-fallback-section">
      <div class="recordings-folder-field">
        <label class="field-label" for="recordings-folder">Recordings Folder</label>
        <input 
          id="recordings-folder"
          type="text" 
          class="recordings-folder-input"
          placeholder="active"
          value={recordingsFolder}
          on:input={(e) => onChangeRecordingsFolder(e.target.value)}
        />
      </div>
      
      <p class="fallback-description">If no recording is found:</p>
      <FallbackFallbackSelector selected={fallback_fallback} onChange={onChangeFallbackFallback} />
    </div>
  {/if}
</div>

<style>
  .fallback-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .fallback-section,
  .fallback-fallback-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fallback-fallback-section {
    padding: 16px;
    background-color: rgba(96, 165, 250, 0.05);
    border: 2px solid rgba(96, 165, 250, 0.2);
    border-radius: 4px;
  }

  .fallback-description {
    font-size: 13px;
    color: #9ca3af;
    margin: 0;
  }

  .recordings-folder-field {
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

  .recordings-folder-input {
    padding: 8px 12px;
    background-color: #1a2847;
    border: 2px solid #374151;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 13px;
    font-family: 'Courier New', monospace;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .recordings-folder-input:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.1);
  }

  .recordings-folder-input::placeholder {
    color: #6b7280;
  }
</style>
