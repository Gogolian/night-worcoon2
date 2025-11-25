import { writable } from 'svelte/store';

export const proxyStatus = writable({
  loading: false,
  error: null,
  serverOnline: true
});

export async function checkServerHealth() {
  try {
    const response = await fetch('/__api/plugins', {
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
    await checkServerHealth();
    proxyStatus.update(s => ({
      ...s,
      loading: false,
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
