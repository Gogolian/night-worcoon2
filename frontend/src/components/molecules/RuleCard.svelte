<script>
  import { afterUpdate, onDestroy } from 'svelte';
  import * as ace from 'ace-builds';
  import Button from '../atoms/Button.svelte';
  import HttpMethodSelector from './HttpMethodSelector.svelte';
  import MatchRecordingUrlInput from '../atoms/MatchRecordingUrlInput.svelte';

  export let rule;
  export let index;
  export let onRemove;
  export let onMethodChange;
  export let onUrlChange;
  export let onActionChange;
  export let onInlineResponseChange;

  // Ace editor state
  let editorContainer;
  let editor = null;
  let editorInitialized = false;
  let debounceTimer = null;

  $: isInline = rule.action === 'RET_INLINE';

  // When switching away from RET_INLINE, destroy editor
  $: if (!isInline && editorInitialized) {
    destroyEditor();
  }

  afterUpdate(() => {
    if (isInline && editorContainer && !editorInitialized) {
      initEditor();
    }
  });

  function initEditor() {
    if (editorInitialized || !editorContainer) return;
    ace.config.set('basePath', 'https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/src-noconflict/');
    editor = ace.edit(editorContainer);
    editor.setTheme('ace/theme/monokai');
    editor.session.setMode('ace/mode/json');
    editor.setFontSize(12);
    editor.setOptions({
      showPrintMargin: false,
      highlightActiveLine: true,
      wrap: true,
      tabSize: 2,
    });
    const body = rule.inlineResponse?.body ?? '{}';
    editor.setValue(body, -1);
    editor.session.on('change', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const updated = {
          ...(rule.inlineResponse || {}),
          body: editor.getValue()
        };
        onInlineResponseChange && onInlineResponseChange(index, updated);
      }, 400);
    });
    editorInitialized = true;
  }

  function destroyEditor() {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    editorInitialized = false;
  }

  function handleStatusCodeChange(e) {
    const updated = {
      ...(rule.inlineResponse || {}),
      statusCode: parseInt(e.target.value, 10) || 200
    };
    onInlineResponseChange && onInlineResponseChange(index, updated);
  }

  onDestroy(() => {
    destroyEditor();
    clearTimeout(debounceTimer);
  });
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
          <button
            class="action-button-compact action-button-mock"
            class:active={rule.action === 'RET_INLINE'}
            on:click={() => onActionChange(index, 'RET_INLINE')}
          >
            MOCK
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="rule-field">
    <span class="field-label">URL Pattern</span>
    <MatchRecordingUrlInput
      value={rule.url}
      onInput={(e) => onUrlChange(index, e)}
      showFiles={false}
    />
    <span class="field-hint">
      Matches any URL containing this pattern. CAN BE PART OF THE URL. Use <code>:param</code> for wildcards (e.g., <code>/api/:id/user</code> but must be exact URL.)
    </span>
  </div>

  {#if isInline}
    <div class="rule-field inline-response-section">
      <div class="inline-response-header">
        <span class="field-label">Inline Response</span>
        <div class="status-code-wrap">
          <span class="field-label">Status</span>
          <input
            type="number"
            class="status-code-input"
            value={rule.inlineResponse?.statusCode ?? 200}
            min="100"
            max="599"
            on:change={handleStatusCodeChange}
          />
        </div>
      </div>
      <div class="ace-wrap" bind:this={editorContainer}></div>
    </div>
  {/if}
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

  .field-hint {
    font-size: 11px;
    color: #6b7280;
    line-height: 1.4;
    margin-top: 2px;
  }

  .field-hint code {
    background-color: #1a2847;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #60a5fa;
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

  .action-button-mock {
    border-color: #4c1d95;
    color: #a78bfa;
  }
  .action-button-mock:hover {
    border-color: #7c3aed;
    color: #c4b5fd;
  }
  .action-button-mock.active {
    background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);
    color: #ffffff;
    border-color: #7c3aed;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
  }

  .inline-response-section {
    border-top: 1px solid #1a2847;
    padding-top: 10px;
    gap: 8px;
  }

  .inline-response-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .status-code-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-code-input {
    width: 72px;
    padding: 4px 8px;
    background-color: #1a2847;
    border: 2px solid #374151;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 13px;
    font-family: monospace;
    text-align: center;
  }
  .status-code-input:focus {
    outline: none;
    border-color: #60a5fa;
  }

  .ace-wrap {
    width: 100%;
    height: 280px;
    border: 1px solid #1a2847;
    border-radius: 4px;
    overflow: hidden;
  }
</style>
