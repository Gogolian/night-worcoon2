import { writable } from 'svelte/store';

export const proxyStatus = writable({
  block5xxEnabled: false,
  loading: false,
  error: null,
  serverOnline: true
});

export async function checkServerHealth() {
  try {
    const response = await fetch('/__api/status', {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    if (response.ok) {
      proxyStatus.update(s => ({ ...s, serverOnline: true, error: null }));
      return true;
    } else {
      proxyStatus.update(s => ({ 
        ...s, 
        serverOnline: false, 
        error: `Server responded with status ${response.status}` 
      }));
      return false;
    }
  } catch (err) {
    proxyStatus.update(s => ({ 
      ...s, 
      serverOnline: false, 
      error: 'Server is not responding. Please ensure the proxy server is running on port 8079.' 
    }));
    return false;
  }
}

export async function fetchProxyStatus() {
  proxyStatus.update(s => ({ ...s, loading: true }));
  try {
    const response = await fetch('/__api/status');
    const data = await response.json();
    proxyStatus.update(s => ({
      ...s,
      block5xxEnabled: data.block5xxEnabled,
      loading: false,
      serverOnline: true,
      error: null
    }));
  } catch (err) {
    proxyStatus.update(s => ({
      ...s,
      loading: false,
      serverOnline: false,
      error: `Failed to fetch status: ${err.message}`
    }));
  }
}

export async function updateProxyStatus(enabled) {
  proxyStatus.update(s => ({ ...s, loading: true, error: null }));
  try {
    const response = await fetch('/__api/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ block5xxEnabled: enabled }),
    });
    const data = await response.json();
    proxyStatus.update(s => ({
      ...s,
      block5xxEnabled: data.block5xxEnabled,
      loading: false,
      serverOnline: true
    }));
  } catch (err) {
    proxyStatus.update(s => ({
      ...s,
      loading: false,
      serverOnline: false,
      error: `Failed to update status: ${err.message}`
    }));
  }
}
