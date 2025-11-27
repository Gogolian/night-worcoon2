<script>
  import { createEventDispatcher } from 'svelte';
  import Badge from '../atoms/Badge.svelte';
  import DeleteButton from '../atoms/DeleteButton.svelte';

  const dispatch = createEventDispatcher();

  export let files = [];
  export let selectedFile = null;
  export let loading = false;
  export let hasSelection = false;

  let oldestFile = null;
  let newestFile = null;

  $: findOldestNewest(files);

  function extractTimestamp(filename) {
    // Extract timestamp from format: GET_nq_nb_20251122_225827_257.json
    // Pattern: YYYYMMDD_HHMMSS
    const match = filename.match(/(\d{8})_(\d{6})_\d+\.json$/);
    if (match) {
      const dateStr = match[1]; // YYYYMMDD
      const timeStr = match[2]; // HHMMSS
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = timeStr.substring(0, 2);
      const minute = timeStr.substring(2, 4);
      const second = timeStr.substring(4, 6);
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    }
    return null;
  }

  function findOldestNewest(filesList) {
    if (filesList.length === 0) {
      oldestFile = null;
      newestFile = null;
      return;
    }

    let oldest = null;
    let newest = null;
    let oldestTime = null;
    let newestTime = null;

    filesList.forEach(file => {
      const timestamp = extractTimestamp(file);
      if (timestamp) {
        if (!oldestTime || timestamp < oldestTime) {
          oldestTime = timestamp;
          oldest = file;
        }
        if (!newestTime || timestamp > newestTime) {
          newestTime = timestamp;
          newest = file;
        }
      }
    });

    oldestFile = oldest;
    newestFile = newest;
  }

  function handleFileClick(file) {
    dispatch('fileSelect', file);
  }

  function handleFileDelete(file) {
    dispatch('fileDelete', file);
  }
</script>

<div class="recordings-content">
  <div class="loading-bar" class:visible={loading}></div>
  {#if !loading && files.length === 0}
    <div class="empty-state">
      <p>No files to display</p>
    </div>
  {:else}
    <div class="files-list">
      <div class="files-header">
        <span class="file-count">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="files-scroll" class:has-selection={hasSelection}>
        {#each files as file}
          <div 
            class="file-item" 
            class:selected={selectedFile === file}
            on:click={() => handleFileClick(file)}
            on:keydown={(e) => e.key === 'Enter' && handleFileClick(file)}
            role="button"
            tabindex="0"
          >
            <span class="file-path">{file}</span>
            <div class="file-actions">
              <div class="file-badges">
                {#if file === oldestFile && file === newestFile}
                  <Badge text="ONLY" variant="info" size="small" />
                {:else if file === oldestFile}
                  <Badge text="OLDEST" variant="warning" size="small" />
                {:else if file === newestFile}
                  <Badge text="NEWEST" variant="success" size="small" />
                {/if}
              </div>
              <DeleteButton on:delete={() => handleFileDelete(file)} />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .recordings-content {
    background: #12192b;
    border: 1px solid #1a2847;
    position: relative;
  }

  .loading-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%);
    background-size: 200% 100%;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }

  .loading-bar.visible {
    opacity: 1;
    animation: loading 1.5s ease-in-out infinite;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
  }

  .files-list {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .files-header {
    background-color: #1a2847;
    padding: 8px 12px;
    border-bottom: 1px solid #0f1535;
    flex-shrink: 0;
  }

  .files-scroll {
    overflow-y: auto;
    overflow-x: hidden;
    max-height: 600px;
  }

  .files-scroll.has-selection {
    max-height: 220px;
  }

  .file-count {
    color: #93c5fd;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .file-item {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid #1a2847;
    transition: background-color 0.2s;
    cursor: pointer;
  }

  .file-item:hover {
    background-color: #0f1535;
  }

  .file-item.selected {
    background-color: #1a2847;
    border-left: 3px solid #60a5fa;
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .file-path {
    color: #e0e0e0;
    font-size: 12px;
    font-family: 'Courier New', monospace;
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .file-badges {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
</style>
