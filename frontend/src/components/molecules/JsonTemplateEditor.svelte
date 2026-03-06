<script>
  import { afterUpdate, onDestroy, createEventDispatcher } from 'svelte';
  import * as ace from 'ace-builds';
  import 'ace-builds/src-noconflict/mode-json';
  import 'ace-builds/src-noconflict/theme-monokai';

  /** JSON string value */
  export let value = '{}';
  /** Placeholder text (shown when empty) */
  export let placeholder = '';
  /** Editor height in px */
  export let height = 280;
  /** Show the token reference toggle */
  export let showTokenRef = false;
  /** Debounce delay in ms */
  export let debounce = 400;

  const dispatch = createEventDispatcher();

  let editorContainer;
  let editor = null;
  let editorInitialized = false;
  let debounceTimer = null;
  let jsonError = '';
  let tokenRefOpen = false;

  // Track the last prop value we saw — only sync editor when parent changes the prop,
  // NOT when we ourselves dispatch (which would cause a reactive loop).
  let _prevPropValue = value;

  $: if (editor && value !== _prevPropValue) {
    _prevPropValue = value;
    if (value !== editor.getValue()) {
      editor.setValue(value || '', -1);
    }
  }

  afterUpdate(() => {
    if (editorContainer && !editorInitialized) {
      initEditor();
    }
  });

  function initEditor() {
    if (editorInitialized || !editorContainer) return;

    editor = ace.edit(editorContainer);
    editor.setTheme('ace/theme/monokai');
    editor.session.setMode('ace/mode/json');
    editor.setFontSize(12);
    editor.setOptions({
      showPrintMargin: false,
      highlightActiveLine: true,
      wrap: true,
      tabSize: 2,
      enableBasicAutocompletion: false,
    });
    // Explicitly enable auto-closing of brackets/quotes
    editor.setBehavioursEnabled(true);

    if (placeholder) {
      editor.setOption('placeholder', placeholder);
    }

    editor.setValue(value || '', -1);

    // On change — debounce and dispatch (no validation during typing)
    editor.session.on('change', () => {
      clearTimeout(debounceTimer);
      jsonError = ''; // clear error while user is typing
      debounceTimer = setTimeout(() => {
        dispatch('change', editor.getValue());
      }, debounce);
    });

    // Validate on blur (format only on explicit Cmd/Ctrl+Shift+F)
    editor.on('blur', () => {
      validateJson(editor.getValue());
    });

    // Split matching brackets on Enter: {|} → {\n  |\n} and [|] → [\n  |\n]
    editor.commands.addCommand({
      name: 'splitBracketsOnEnter',
      bindKey: { win: 'Return', mac: 'Return' },
      exec: (ed) => {
        const cursor = ed.getCursorPosition();
        const line = ed.session.getLine(cursor.row);
        const before = line[cursor.column - 1];
        const after = line[cursor.column];
        if ((before === '{' && after === '}') || (before === '[' && after === ']')) {
          const indent = ed.session.getTabString();
          const currentIndent = line.match(/^\s*/)[0];
          ed.insert('\n' + currentIndent + indent + '\n' + currentIndent);
          // Move cursor up one line, to the indented middle line
          ed.moveCursorTo(cursor.row + 1, currentIndent.length + indent.length);
          ed.clearSelection();
        } else {
          ed.insert('\n');
        }
      },
      multiSelectAction: 'forEach'
    });

    // Command: Cmd/Ctrl+Shift+F to format
    editor.commands.addCommand({
      name: 'formatJson',
      bindKey: { win: 'Ctrl-Shift-F', mac: 'Cmd-Shift-F' },
      exec: () => formatJson()
    });

    editorInitialized = true;
  }

  function validateJson(text) {
    if (!text || !text.trim()) {
      jsonError = '';
      return true;
    }
    try {
      JSON.parse(text);
      jsonError = '';
      return true;
    } catch (err) {
      jsonError = err.message;
      return false;
    }
  }

  function formatJson() {
    if (!editor) return;
    const text = editor.getValue().trim();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);
      if (formatted !== text) {
        const cursorPos = editor.getCursorPosition();
        editor.setValue(formatted, -1);
        // Try to restore cursor near original position
        try { editor.moveCursorToPosition(cursorPos); } catch (_) {}
        // Cancel the debounced dispatch (setValue triggers session change) and dispatch immediately
        clearTimeout(debounceTimer);
        dispatch('change', formatted);
      }
      jsonError = '';
    } catch (_) {
      // Not valid JSON, don't format
    }
  }

  function destroyEditor() {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    editorInitialized = false;
  }

  onDestroy(() => {
    destroyEditor();
    clearTimeout(debounceTimer);
  });
</script>

<div class="json-template-editor">
  <div class="editor-wrap" style="height: {height}px" bind:this={editorContainer}></div>

  {#if jsonError}
    <span class="json-error">{jsonError}</span>
  {/if}

  {#if showTokenRef}
    <div class="token-ref-area">
      <span class="editor-hint">
        Use <code>{'{{ token }}'}</code> placeholders.
        <button class="token-ref-toggle" on:click={() => (tokenRefOpen = !tokenRefOpen)}>
          {tokenRefOpen ? 'Hide' : 'Show'} token reference
        </button>
      </span>
      {#if tokenRefOpen}
        <div class="token-ref-inline">
          <div class="token-ref-grid">
            <span class="tref-token"><code>:id</code></span><span class="tref-desc">Generated resource ID</span>
            <span class="tref-token"><code>email</code></span><span class="tref-desc">Random email (Polish names)</span>
            <span class="tref-token"><code>phoneNumber</code></span><span class="tref-desc">Polish mobile 48xxxxxxxxx</span>
            <span class="tref-token"><code>firstName</code></span><span class="tref-desc">Random Polish first name</span>
            <span class="tref-token"><code>lastName</code></span><span class="tref-desc">Random Polish surname</span>
            <span class="tref-token"><code>date</code></span><span class="tref-desc">ISO 8601 timestamp (now)</span>
            <span class="tref-token"><code>uuid</code></span><span class="tref-desc">Random UUID</span>
            <span class="tref-token"><code>boolean</code></span><span class="tref-desc">Random true / false</span>
            <span class="tref-token"><code>integer</code></span><span class="tref-desc">Random 1–1000</span>
            <span class="tref-token"><code>integer:min:max</code></span><span class="tref-desc">Random int in range</span>
            <span class="tref-token"><code>location.streetName</code></span><span class="tref-desc">Polish street name</span>
            <span class="tref-token"><code>location.streetNr</code></span><span class="tref-desc">Street number (1–150)</span>
            <span class="tref-token"><code>location.zipCode</code></span><span class="tref-desc">xx-xxx Polish zip</span>
            <span class="tref-token"><code>location.flatNr</code></span><span class="tref-desc">Flat number (1–200)</span>
            <span class="tref-token"><code>headers.X</code></span><span class="tref-desc">Value of request header X</span>
            <span class="tref-token"><code>body.X</code></span><span class="tref-desc">Value of request body field X</span>
            <span class="tref-token"><code><em>regexp</em></code></span><span class="tref-desc">Generated from pattern (fallback)</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .json-template-editor {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .editor-wrap {
    width: 100%;
    border: 1px solid #1a2847;
    border-radius: 4px;
    overflow: hidden;
  }

  .json-error {
    font-size: 11px;
    color: #f87171;
    padding: 2px 0;
  }

  .editor-hint {
    font-size: 11px;
    color: #6b7280;
    line-height: 1.4;
  }

  .editor-hint code {
    background-color: #1a2847;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #60a5fa;
  }

  .token-ref-toggle {
    background: none;
    border: none;
    color: #60a5fa;
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
    padding: 0 4px;
    font-family: inherit;
  }

  .token-ref-toggle:hover {
    color: #93c5fd;
  }

  .token-ref-inline {
    margin-top: 6px;
    padding: 8px 10px;
    background: #0d1224;
    border: 1px solid #1a2847;
    border-radius: 4px;
  }

  .token-ref-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 14px;
    font-size: 11px;
    line-height: 1.5;
  }

  .tref-token code {
    background-color: #1a2847;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #a78bfa;
    white-space: nowrap;
  }

  .tref-desc {
    color: #9ca3af;
  }

  .token-ref-area {
    margin-top: 2px;
  }
</style>
