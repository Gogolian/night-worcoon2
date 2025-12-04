<script>
  import { onMount, onDestroy } from 'svelte';
  import { plugins, togglePlugin } from '../../stores/plugins.js';
  import { 
    connections, 
    messageLog, 
    wsConfig,
    activeConnectionCount,
    fetchConnections,
    fetchMessages,
    fetchConfig,
    updateConfig,
    closeConnection,
    clearMessageLog,
    startPolling,
    stopPolling,
    formatDuration,
    formatTimestamp
  } from '../../stores/websocket.js';
  import PluginHeader from '../../components/organisms/PluginHeader.svelte';
  import PluginSection from '../../components/molecules/PluginSection.svelte';
  import Card from '../../components/molecules/Card.svelte';
  import Button from '../../components/atoms/Button.svelte';
  import Checkbox from '../../components/atoms/Checkbox.svelte';
  import Input from '../../components/atoms/Input.svelte';
  import Badge from '../../components/atoms/Badge.svelte';
  import StatusBadge from '../../components/atoms/StatusBadge.svelte';

  $: plugin = $plugins.find(p => p.name === 'websocket');

  let selectedConnectionId = null;
  let messageFilter = 'all'; // 'all', 'client-to-server', 'server-to-client'

  onMount(async () => {
    await fetchConfig();
    if (plugin?.enabled) {
      startPolling(3000); // Poll every 3 seconds
    }
  });

  onDestroy(() => {
    stopPolling();
  });

  async function handleToggle() {
    if (plugin) {
      await togglePlugin(plugin.name, !plugin.enabled);
      if (plugin.enabled) {
        startPolling(3000);
      } else {
        stopPolling();
      }
    }
  }

  async function handleConfigUpdate(key, value) {
    try {
      await updateConfig({ [key]: value });
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  }

  async function handleCloseConnection(connectionId) {
    try {
      await closeConnection(connectionId);
    } catch (err) {
      console.error('Failed to close connection:', err);
    }
  }

  async function handleClearLog() {
    try {
      await clearMessageLog();
    } catch (err) {
      console.error('Failed to clear log:', err);
    }
  }

  function getDirectionBadge(direction) {
    if (direction === 'client-to-server') return { text: 'C→S', variant: 'info' };
    if (direction === 'server-to-client') return { text: 'S→C', variant: 'success' };
    return { text: direction, variant: 'default' };
  }

  $: filteredMessages = $messageLog.filter(msg => {
    if (selectedConnectionId && msg.connectionId !== selectedConnectionId) return false;
    if (messageFilter !== 'all' && msg.direction !== messageFilter) return false;
    return true;
  });
</script>

<div class="plugin-page">
  {#if plugin}
    <PluginHeader {plugin} onToggle={handleToggle} />

    <PluginSection title="Configuration">
      <div class="config-grid">
        <div class="config-item">
          <Checkbox 
            checked={$wsConfig.logMessages} 
            on:change={(e) => handleConfigUpdate('logMessages', e.detail)}
          >
            Log messages to console
          </Checkbox>
        </div>
        <div class="config-item">
          <Checkbox 
            checked={$wsConfig.recordMessages} 
            on:change={(e) => handleConfigUpdate('recordMessages', e.detail)}
            disabled={true}
          >
            Record messages to disk (temporarily disabled - needs more work)
          </Checkbox>
        </div>
        <div class="config-item">
          <label class="config-label">
            Max Connections
            <Input 
              type="number" 
              value={$wsConfig.maxConnections}
              on:change={(e) => handleConfigUpdate('maxConnections', parseInt(e.target.value))}
            />
          </label>
        </div>
        <div class="config-item">
          <label class="config-label">
            Max Message Size (bytes)
            <Input 
              type="number" 
              value={$wsConfig.maxMessageSize}
              on:change={(e) => handleConfigUpdate('maxMessageSize', parseInt(e.target.value))}
            />
          </label>
        </div>
      </div>
    </PluginSection>

    <PluginSection title="Active Connections ({$activeConnectionCount})">
      {#if $connections.length === 0}
        <div class="empty-state">
          <p>No active WebSocket connections</p>
        </div>
      {:else}
        <div class="connections-list">
          {#each $connections as conn}
            <Card>
              <div class="connection-card">
                <div class="connection-header">
                  <div class="connection-url">
                    <StatusBadge status="active" />
                    <span class="url-text">{conn.url}</span>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="small" 
                    on:click={() => handleCloseConnection(conn.id)}
                  >
                    Close
                  </Button>
                </div>
                <div class="connection-stats">
                  <div class="stat">
                    <span class="stat-label">ID:</span>
                    <span class="stat-value">{conn.id}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Duration:</span>
                    <span class="stat-value">{formatDuration(conn.connectedAt)}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Messages:</span>
                    <span class="stat-value">↑{conn.messagesSent || 0} ↓{conn.messagesReceived || 0}</span>
                  </div>
                  <div class="stat">
                    <span class="stat-label">Last Activity:</span>
                    <span class="stat-value">{formatTimestamp(conn.lastActivity)}</span>
                  </div>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </PluginSection>

    <PluginSection title="Message Log ({filteredMessages.length})">
      <div class="message-controls">
        <div class="filters">
          <select class="filter-select" bind:value={selectedConnectionId}>
            <option value={null}>All Connections</option>
            {#each $connections as conn}
              <option value={conn.id}>{conn.url} ({conn.id})</option>
            {/each}
          </select>
          
          <select class="filter-select" bind:value={messageFilter}>
            <option value="all">All Directions</option>
            <option value="client-to-server">Client → Server</option>
            <option value="server-to-client">Server → Client</option>
          </select>
        </div>
        
        <Button 
          variant="secondary" 
          size="small" 
          on:click={handleClearLog}
        >
          Clear Log
        </Button>
      </div>

      {#if filteredMessages.length === 0}
        <div class="empty-state">
          <p>No messages to display</p>
        </div>
      {:else}
        <div class="messages-list">
          {#each filteredMessages as msg}
            <div class="message-item">
              <div class="message-header">
                <span class="message-time">{formatTimestamp(msg.timestamp)}</span>
                <Badge variant={getDirectionBadge(msg.direction).variant}>
                  {getDirectionBadge(msg.direction).text}
                </Badge>
                <span class="message-size">{msg.size} bytes</span>
              </div>
              <div class="message-preview">
                <code>{msg.preview || JSON.stringify(msg.message).substring(0, 100)}</code>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </PluginSection>

    <PluginSection title="About">
      <div class="about-content">
        <p><strong>Execution Order:</strong> #{plugin.order || 'N/A'}</p>
        <p><strong>Purpose:</strong> Proxy and monitor WebSocket connections with message interception capabilities.</p>
        <p><strong>Features:</strong> Real-time connection monitoring, message logging, and optional recording.</p>
        <p><strong>Status:</strong> {plugin.enabled ? 'Active - Proxying WebSocket connections' : 'Disabled'}</p>
      </div>
    </PluginSection>
  {/if}
</div>

<style>
  .plugin-page {
    padding: 16px;
    max-width: 1200px;
  }

  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .config-item {
    display: flex;
    flex-direction: column;
  }

  .config-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: #d4d4d8;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #9ca3af;
    font-size: 14px;
  }

  .connections-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .connection-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .connection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .connection-url {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .url-text {
    font-size: 13px;
    color: #93c5fd;
    font-family: 'Courier New', monospace;
  }

  .connection-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid #1a2847;
  }

  .stat {
    display: flex;
    gap: 6px;
    font-size: 12px;
  }

  .stat-label {
    color: #9ca3af;
  }

  .stat-value {
    color: #d4d4d8;
    font-family: 'Courier New', monospace;
  }

  .message-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    gap: 12px;
  }

  .filters {
    display: flex;
    gap: 8px;
    flex: 1;
  }

  .filter-select {
    background-color: #0f1535;
    color: #e0e0e0;
    border: 1px solid #1a2847;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    outline: none;
    flex: 1;
    max-width: 300px;
  }

  .filter-select:hover {
    border-color: #2563eb;
  }

  .filter-select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 500px;
    overflow-y: auto;
  }

  .message-item {
    background-color: #0f1535;
    border: 1px solid #1a2847;
    border-radius: 4px;
    padding: 10px;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .message-time {
    font-size: 11px;
    color: #9ca3af;
    font-family: 'Courier New', monospace;
  }

  .message-size {
    font-size: 11px;
    color: #6b7280;
    margin-left: auto;
  }

  .message-preview {
    font-size: 12px;
    color: #d4d4d8;
  }

  .message-preview code {
    display: block;
    background-color: #12192b;
    padding: 8px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .about-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .about-content p {
    font-size: 13px;
    color: #d4d4d8;
    margin: 0;
    line-height: 1.6;
  }

  .about-content strong {
    color: #60a5fa;
  }
</style>
