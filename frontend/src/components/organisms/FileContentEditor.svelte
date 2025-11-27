<script>
  import Button from '../atoms/Button.svelte';
  import { toast } from '../../stores/toast.js';

  export let selectedFile = null;
  export let selectedFolder = '';
  export let fileContent = null;
  export let originalContent = null;
  export let loadingContent = false;
  export let saving = false;

  $: isModified = fileContent !== originalContent && originalContent !== null;

  async function saveFileContent() {
    // Validate JSON
    try {
      JSON.parse(fileContent);
    } catch (err) {
      toast.show('Invalid JSON: ' + err.message, 'error');
      return;
    }

    saving = true;
    try {
      const cleanPath = selectedFile.startsWith('/') ? selectedFile.substring(1) : selectedFile;
      const response = await fetch(`/__api/recordings/content/${selectedFolder}/${cleanPath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: fileContent
      });

      if (!response.ok) {
        throw new Error('Failed to save file');
      }

      originalContent = fileContent;
      toast.show('File saved successfully', 'success');
    } catch (err) {
      console.error('Failed to save file:', err);
      toast.show('Failed to save file', 'error');
    } finally {
      saving = false;
    }
  }

  async function copyFileContent() {
    try {
      await navigator.clipboard.writeText(fileContent);
      toast.show('File content copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy content:', err);
      toast.show('Failed to copy to clipboard', 'error');
    }
  }
</script>

{#if selectedFile}
  <div class="file-content-section">
    <div class="content-header">
      <h2>File Content: {selectedFile}</h2>
      {#if !loadingContent && fileContent}
        <div class="content-actions">
          <Button 
            variant="secondary" 
            size="small" 
            on:click={copyFileContent}
          >
            Copy File Contents
          </Button>
          <Button 
            variant="primary" 
            size="small" 
            on:click={saveFileContent}
            disabled={!isModified || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      {/if}
    </div>
    <div class="content-body">
      {#if loadingContent}
        <div class="loading-content">
          <p>Loading content...</p>
        </div>
      {:else if fileContent !== null}
        <textarea 
          class="content-textarea"
          bind:value={fileContent}
          spellcheck="false"
        />
      {:else}
        <p class="content-error">Failed to load content</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .file-content-section {
    margin-top: 10px;
    background: #12192b;
    border: 1px solid #1a2847;
  }

  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #1a2847;
    padding: 8px 12px;
    border-bottom: 1px solid #0f1535;
  }

  .content-header h2 {
    color: #93c5fd;
    font-size: 12px;
    font-weight: 600;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .content-actions {
    display: flex;
    gap: 6px;
  }

  .content-body {
    padding: 0;
    max-height: 500px;
    overflow: hidden;
    display: flex;
  }

  .loading-content,
  .content-error {
    text-align: center;
    padding: 20px;
    color: #9ca3af;
    font-size: 13px;
  }

  .content-error {
    color: #f87171;
  }

  .content-textarea {
    flex: 1;
    width: 100%;
    min-height: 500px;
    max-height: 500px;
    padding: 12px;
    background-color: #0f1535;
    border: none;
    color: #e0e0e0;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    line-height: 1.5;
    resize: none;
    overflow: auto;
  }

  .content-textarea:focus {
    outline: none;
    background-color: #12192b;
  }
</style>
