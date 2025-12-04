import { writable, derived } from 'svelte/store';

// Core stores
export const connections = writable([]);
export const messageLog = writable([]);
export const wsConfig = writable({
  enabled: false,
  logMessages: true,
  recordMessages: false,
  maxConnections: 100,
  maxMessageSize: 1048576,
  modificationRules: []
});

// Derived stores
export const activeConnectionCount = derived(
  connections,
  $connections => $connections.length
);

// Polling interval ID
let pollingInterval = null;

/**
 * Fetch active WebSocket connections
 */
export async function fetchConnections() {
  try {
    const res = await fetch('/__api/websocket/connections');
    if (!res.ok) throw new Error('Failed to fetch connections');
    const data = await res.json();
    connections.set(data.connections || []);
  } catch (err) {
    console.error('Error fetching WebSocket connections:', err);
  }
}

/**
 * Fetch WebSocket messages
 * @param {number} limit - Maximum number of messages to fetch
 * @param {string} connectionId - Optional connection ID filter
 */
export async function fetchMessages(limit = 100, connectionId = null) {
  try {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (connectionId) params.append('connectionId', connectionId);
    
    const res = await fetch(`/__api/websocket/messages?${params}`);
    if (!res.ok) throw new Error('Failed to fetch messages');
    const data = await res.json();
    messageLog.set(data.messages || []);
  } catch (err) {
    console.error('Error fetching WebSocket messages:', err);
  }
}

/**
 * Fetch WebSocket configuration
 */
export async function fetchConfig() {
  try {
    const res = await fetch('/__api/websocket/config');
    if (!res.ok) throw new Error('Failed to fetch config');
    const data = await res.json();
    wsConfig.set(data);
  } catch (err) {
    console.error('Error fetching WebSocket config:', err);
  }
}

/**
 * Update WebSocket configuration
 * @param {Object} updates - Configuration updates
 */
export async function updateConfig(updates) {
  try {
    const res = await fetch('/__api/websocket/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update config');
    const data = await res.json();
    wsConfig.set(data);
  } catch (err) {
    console.error('Error updating WebSocket config:', err);
    throw err;
  }
}

/**
 * Close a WebSocket connection
 * @param {string} connectionId - Connection ID to close
 */
export async function closeConnection(connectionId) {
  try {
    const res = await fetch(`/__api/websocket/connections/${connectionId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to close connection');
    await fetchConnections();
  } catch (err) {
    console.error('Error closing WebSocket connection:', err);
    throw err;
  }
}

/**
 * Clear message log
 */
export async function clearMessageLog() {
  try {
    const res = await fetch('/__api/websocket/messages/clear', {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to clear message log');
    messageLog.set([]);
  } catch (err) {
    console.error('Error clearing message log:', err);
    throw err;
  }
}

/**
 * Start polling for WebSocket data
 * @param {number} interval - Polling interval in milliseconds (default: 2000)
 */
export function startPolling(interval = 2000) {
  if (pollingInterval) {
    stopPolling();
  }
  
  // Initial fetch
  fetchConnections();
  fetchMessages();
  
  // Start polling
  pollingInterval = setInterval(() => {
    fetchConnections();
    fetchMessages();
  }, interval);
}

/**
 * Stop polling for WebSocket data
 */
export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Format connection duration
 * @param {string} connectedAt - ISO timestamp
 * @returns {string} Formatted duration
 */
export function formatDuration(connectedAt) {
  const start = new Date(connectedAt);
  const now = new Date();
  const diff = Math.floor((now - start) / 1000); // seconds
  
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/**
 * Format timestamp
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}
