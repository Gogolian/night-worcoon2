<script>
  import { onMount } from 'svelte';
  import RecordingsControls from '../components/molecules/RecordingsControls.svelte';
  import RecordingsList from '../components/organisms/RecordingsList.svelte';
  import FileContentEditor from '../components/organisms/FileContentEditor.svelte';
  import { toast } from '../stores/toast.js';

  let folders = [];
  let selectedFolder = 'active';
  let allFiles = [];
  let filteredFiles = [];
  let filterText = '';
  let loading = false;
  let selectedFile = null;
  let fileContent = null;
  let originalContent = null;
  let loadingContent = false;
  let saving = false;

  onMount(async () => {
    await loadFolders();
    await loadFiles();
  });

  async function loadFolders() {
    try {
      const response = await fetch('/__api/recordings/folders');
      const data = await response.json();
      folders = data.folders || [];
      
      // Set default to 'active' if it exists
      if (folders.includes('active')) {
        selectedFolder = 'active';
      } else if (folders.length > 0) {
        selectedFolder = folders[0];
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
      toast.show('Failed to load recording folders', 'error');
    }
  }

  async function loadFiles() {
    if (!selectedFolder) return;
    
    loading = true;
    try {
      const response = await fetch(`/__api/recordings/files/${selectedFolder}`);
      const data = await response.json();
      allFiles = data.files || [];
      applyFilter();
    } catch (err) {
      console.error('Failed to load files:', err);
      toast.show('Failed to load recording files', 'error');
      allFiles = [];
      filteredFiles = [];
    } finally {
      loading = false;
    }
  }

  async function handleFileSelect(event) {
    const file = event.detail;
    
    if (selectedFile === file) {
      // Toggle off if clicking the same file
      selectedFile = null;
      fileContent = null;
      originalContent = null;
      return;
    }

    selectedFile = file;
    loadingContent = true;
    
    try {
      // Remove leading slash from file path
      const cleanPath = file.startsWith('/') ? file.substring(1) : file;
      const response = await fetch(`/__api/recordings/content/${selectedFolder}/${cleanPath}`);
      
      if (!response.ok) {
        throw new Error('Failed to load file');
      }
      
      const content = await response.json();
      fileContent = JSON.stringify(content, null, 2);
      originalContent = fileContent;
    } catch (err) {
      console.error('Failed to load file content:', err);
      toast.show('Failed to load file content', 'error');
      fileContent = null;
      originalContent = null;
    } finally {
      loadingContent = false;
    }
  }

  async function handleFileDelete(event) {
    const file = event.detail;
    
    try {
      const cleanPath = file.startsWith('/') ? file.substring(1) : file;
      const response = await fetch(`/__api/recordings/content/${selectedFolder}/${cleanPath}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      toast.show('File deleted successfully', 'success');
      
      // Clear selection if deleted file was selected
      if (selectedFile === file) {
        selectedFile = null;
        fileContent = null;
        originalContent = null;
      }
      
      // Reload file list
      await loadFiles();
    } catch (err) {
      console.error('Failed to delete file:', err);
      toast.show('Failed to delete file', 'error');
    }
  }

  function applyFilter() {
    if (!filterText.trim()) {
      filteredFiles = allFiles;
    } else {
      const filter = filterText.toLowerCase();
      filteredFiles = allFiles.filter(file => 
        file.toLowerCase().includes(filter)
      );
    }
    // Clear selection when filter changes
    selectedFile = null;
    fileContent = null;
    originalContent = null;
  }

  $: if (selectedFolder) {
    loadFiles();
  }

  $: if (filterText !== undefined) {
    applyFilter();
  }
</script>

<div class="recordings-view">
  <h1>Recordings</h1>
  
  <RecordingsControls 
    bind:folders={folders}
    bind:selectedFolder={selectedFolder}
    bind:filterText={filterText}
    bind:loading={loading}
  />

  <RecordingsList 
    files={filteredFiles}
    bind:selectedFile={selectedFile}
    loading={loading}
    hasSelection={selectedFile !== null}
    on:fileSelect={handleFileSelect}
    on:fileDelete={handleFileDelete}
  />

  <FileContentEditor 
    bind:selectedFile={selectedFile}
    bind:selectedFolder={selectedFolder}
    bind:fileContent={fileContent}
    bind:originalContent={originalContent}
    bind:loadingContent={loadingContent}
    bind:saving={saving}
  />
</div>

<style>
  .recordings-view {
    max-width: 1250px;
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h1 {
    color: #e0e0e0;
    font-size: 16px;
    margin: 0 0 10px 0;
    font-weight: 600;
  }
</style>
