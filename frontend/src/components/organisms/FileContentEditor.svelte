<script>
  import { onMount, afterUpdate } from 'svelte';
  import Button from '../atoms/Button.svelte';
  import { toast } from '../../stores/toast.js';
  import * as ace from 'ace-builds';

  export let selectedFile = null;
  export let selectedFolder = '';
  export let fileContent = null;
  export let originalContent = null;
  export let loadingContent = false;
  export let saving = false;

  let editor;
  let editorContainer;
  let editorInitialized = false;
  let selectedTheme = 'monokai';
  let fontSize = 12;

  const themes = [
    { value: 'monokai', label: 'Monokai' },
    { value: 'github', label: 'GitHub' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'twilight', label: 'Twilight' },
    { value: 'solarized_dark', label: 'Solarized Dark' },
    { value: 'solarized_light', label: 'Solarized Light' },
    { value: 'dracula', label: 'Dracula' },
    { value: 'nord_dark', label: 'Nord Dark' },
    { value: 'one_dark', label: 'One Dark' },
    { value: 'cobalt', label: 'Cobalt' },
    { value: 'terminal', label: 'Terminal' },
    { value: 'chrome', label: 'Chrome' },
  ];

  const fontSizes = [8, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24];

  $: isModified = fileContent !== originalContent && originalContent !== null;

  $: if (editor && editorInitialized && selectedTheme) {
    editor.setTheme(`ace/theme/${selectedTheme}`);
  }

  $: if (editor && editorInitialized && fontSize) {
    editor.setFontSize(fontSize);
  }

  function initializeEditor() {
    if (!editorContainer || editorInitialized) return;
    
    ace.config.set('basePath', 'https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/src-noconflict/');
    
    editor = ace.edit(editorContainer);
    editor.setTheme(`ace/theme/${selectedTheme}`);
    editor.session.setMode('ace/mode/json');
    editor.setFontSize(12);
    editor.setOptions({
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: false,
      showPrintMargin: false,
      highlightActiveLine: true,
      highlightSelectedWord: true,
      wrap: true,
      tabSize: 2,
    });

    if (fileContent) {
      editor.setValue(fileContent, -1);
    }

    editor.session.on('change', () => {
      const value = editor.getValue();
      if (value !== fileContent) {
        fileContent = value;
      }
    });

    editorInitialized = true;
  }

  afterUpdate(() => {
    if (editorContainer && !editorInitialized && fileContent !== null && !loadingContent) {
      initializeEditor();
    }
  });

  $: if (editor && editorInitialized && fileContent !== undefined && fileContent !== editor.getValue()) {
    const pos = editor.getCursorPosition();
    editor.setValue(fileContent, -1);
    editor.moveCursorToPosition(pos);
  }

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

<div class="file-content-section" class:visible={selectedFile}>
  <div class="content-header">
    <h2>{selectedFile || 'No file selected'}</h2>
    {#if fileContent && selectedFile}
      <div class="content-actions">
        <select class="theme-dropdown" bind:value={selectedTheme}>
          {#each themes as theme}
            <option value={theme.value}>{theme.label}</option>
          {/each}
        </select>
        <select class="font-size-dropdown" bind:value={fontSize}>
          {#each fontSizes as size}
            <option value={size}>{size}px</option>
          {/each}
        </select>
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
    <div class="loading-content" class:visible={loadingContent}>
      <p>Loading content...</p>
    </div>
    <div class="editor-container" class:visible={!loadingContent && fileContent !== null}>
      <div class="editor-wrapper" bind:this={editorContainer}></div>
    </div>
    <div class="content-error" class:visible={!loadingContent && fileContent === null && selectedFile}>
      <p>Failed to load content</p>
    </div>
  </div>
</div>

<style>
  .file-content-section {
    margin-top: 10px;
    background: #12192b;
    border: 1px solid #1a2847;
    display: none;
  }

  .file-content-section.visible {
    display: block;
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
    letter-spacing: 0.5px;
  }

  .content-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .theme-dropdown,
  .font-size-dropdown {
    background-color: #0f1535;
    color: #e0e0e0;
    border: 1px solid #1a2847;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    outline: none;
  }

  .font-size-dropdown {
    min-width: 70px;
  }

  .theme-dropdown:hover,
  .font-size-dropdown:hover {
    border-color: #2563eb;
  }

  .theme-dropdown:focus,
  .font-size-dropdown:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .content-body {
    padding: 0;
    max-height: 500px;
    overflow: hidden;
    display: flex;
    flex: 1;
    position: relative;
  }

  .editor-container {
    display: none;
    width: 100%;
    height: 500px;
  }

  .editor-container.visible {
    display: block;
  }

  .editor-wrapper {
    width: 100%;
    height: 500px;
  }

  .loading-content,
  .content-error {
    display: none;
    text-align: center;
    padding: 20px;
    color: #9ca3af;
    font-size: 13px;
    flex: 1;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .loading-content.visible,
  .content-error.visible {
    display: flex;
  }

  .content-error {
    color: #f87171;
  }

  :global(.content-body .ace_editor) {
    font: 'Consolas' sans-serif;
  }

  :global(.content-body .ace_gutter) {
    background-color: #12192b;
    color: #6b7280;
  }
</style>
