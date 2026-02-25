<script>
  import { onDestroy, tick } from 'svelte';
  import { activeRecordingsFolder, fetchDirs } from '../../stores/recordingsDirs.js';

  /** Current URL value (one-way prop; use onInput to propagate changes upward) */
  export let value = '';
  /** Called with a synthetic { target: { value } } event whenever the value changes */
  export let onInput = null;
  /** Whether to include files (not just directories) in the dropdown suggestions */
  export let showFiles = true;

  let inputEl;
  let hasFocus = false;
  let suggestions = []; // [{ name: string, isDir: boolean }]
  let highlightedIndex = -1;

  let dropdownTop = 0;
  let dropdownLeft = 0;
  let dropdownWidth = 0;

  async function computeDropdownPosition() {
    await tick();
    if (!inputEl) return;
    const rect = inputEl.getBoundingClientRect();
    dropdownTop = rect.bottom + window.scrollY + 3;
    dropdownLeft = rect.left + window.scrollX;
    dropdownWidth = rect.width;
  }

  // ---------- portal action ----------
  // Moves the node to document.body so no ancestor can clip or occlude it.
  function portal(node) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

  // Keep a local copy so dropdown selections update the displayed text immediately
  // while the parent catches up async. Sync back from prop when it truly changes.
  let localValue = value;
  let prevProp = value;
  $: {
    if (value !== prevProp) {
      localValue = value;
      prevProp = value;
    }
  }

  // ---------- path parsing helpers ----------

  function parsePath(val) {
    const lastSlash = val.lastIndexOf('/');
    if (lastSlash === -1) {
      return { base: '', filter: val };
    }
    return {
      base: val.substring(0, lastSlash + 1),
      filter: val.substring(lastSlash + 1)
    };
  }

  function baseToApiPath(base) {
    return base.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  // ---------- suggestion logic ----------

  async function updateSuggestions(val) {
    if (!val.includes('/')) {
      suggestions = [];
      return;
    }

    const { base, filter } = parsePath(val);
    const apiPath = baseToApiPath(base);
    const folder = $activeRecordingsFolder;

    const data = await fetchDirs(folder, apiPath);

    const f = filter.toLowerCase();
    const dirItems = data.dirs
      .filter(d => d.toLowerCase().includes(f))
      .map(d => ({ name: d + '/', isDir: true }));
    const fileItems = showFiles
      ? data.files
          .filter(fi => fi.toLowerCase().includes(f))
          .map(fi => ({ name: fi, isDir: false }))
      : [];

    suggestions = [...dirItems, ...fileItems];
    highlightedIndex = -1;
    if (suggestions.length > 0) computeDropdownPosition();
  }

  // ---------- event handlers ----------

  function handleInput(e) {
    localValue = e.target.value;
    if (onInput) onInput(e);
    if (hasFocus) updateSuggestions(localValue);
  }

  function handleFocus() {
    clearTimeout(blurTimer);
    hasFocus = true;
    updateSuggestions(localValue);
  }

  let blurTimer;
  function handleBlur() {
    blurTimer = setTimeout(() => {
      hasFocus = false;
      suggestions = [];
      highlightedIndex = -1;
    }, 150);
  }

  function handleKeydown(e) {
    if (!suggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, -1);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && highlightedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      suggestions = [];
      highlightedIndex = -1;
    }
  }

  async function selectSuggestion(item) {
    const { base } = parsePath(localValue);
    const newValue = base + item.name;
    localValue = newValue;

    if (onInput) onInput({ target: { value: newValue } });

    // Selecting a file → close immediately
    if (!item.isDir) {
      suggestions = [];
      highlightedIndex = -1;
      inputEl?.focus();
      return;
    }

    // Selecting a dir → pre-fetch next level and update suggestions
    fetchDirs($activeRecordingsFolder, baseToApiPath(base + item.name));
    await updateSuggestions(newValue);

    // If the selected dir has no children, close the dropdown
    if (suggestions.length === 0) {
      hasFocus = false;
    }

    inputEl?.focus();
  }

  onDestroy(() => clearTimeout(blurTimer));
</script>

<div class="url-input-wrapper">
  <input
    bind:this={inputEl}
    type="text"
    class="url-input"
    placeholder="e.g., /bff/cms or cms/config or bff/:id/details"
    value={localValue}
    on:input={handleInput}
    on:focus={handleFocus}
    on:blur={handleBlur}
    on:keydown={handleKeydown}
  />
</div>

{#if hasFocus && suggestions.length > 0}
  <div
    use:portal
    class="url-dropdown-portal"
    role="listbox"
    style="top:{dropdownTop}px; left:{dropdownLeft}px; width:{dropdownWidth}px;"
  >
    {#each suggestions as item, i}
      <button
        class="url-dropdown-item"
        class:highlighted={i === highlightedIndex}
        class:is-dir={item.isDir}
        role="option"
        aria-selected={i === highlightedIndex}
        on:mousedown|preventDefault={() => selectSuggestion(item)}
      >
        <span class="item-base">{parsePath(localValue).base}</span><span class="item-name">{item.name}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .url-input-wrapper {
    width: 100%;
  }

  .url-input {
    width: 100%;
    box-sizing: border-box;
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

  /* 
   * These styles are on the portal node which lives on document.body.
   * Svelte scopes styles to the component, so we use :global() here.
   */
  :global(.url-dropdown-portal) {
    position: absolute;
    background-color: #0f1535;
    border: 2px solid #374151;
    border-radius: 4px;
    max-height: 220px;
    overflow-y: auto;
    z-index: 99999;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
  }

  :global(.url-dropdown-portal .url-dropdown-item) {
    display: block;
    width: 100%;
    padding: 7px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid #1a2847;
    color: #9ca3af;
    font-size: 12px;
    font-family: 'Courier New', monospace;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.1s ease, color 0.1s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.url-dropdown-portal .url-dropdown-item:last-child) {
    border-bottom: none;
  }

  :global(.url-dropdown-portal .url-dropdown-item:hover),
  :global(.url-dropdown-portal .url-dropdown-item.highlighted) {
    background-color: #1a2847;
    color: #e0e0e0;
  }

  :global(.url-dropdown-portal .url-dropdown-item.is-dir .item-name) {
    color: #60a5fa;
  }

  :global(.url-dropdown-portal .url-dropdown-item:not(.is-dir) .item-name) {
    color: #a3e635;
  }

  :global(.url-dropdown-portal .item-base) {
    color: #6b7280;
  }

  :global(.url-dropdown-portal::-webkit-scrollbar) {
    width: 6px;
  }
  :global(.url-dropdown-portal::-webkit-scrollbar-track) {
    background: #0f1535;
  }
  :global(.url-dropdown-portal::-webkit-scrollbar-thumb) {
    background: #374151;
    border-radius: 3px;
  }
  :global(.url-dropdown-portal::-webkit-scrollbar-thumb:hover) {
    background: #60a5fa;
  }
</style>
