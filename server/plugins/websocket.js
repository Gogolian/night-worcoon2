/**
 * WebSocket proxying plugin
 * Enables WebSocket connection proxying with message interception and modification
 */
export default {
  name: 'websocket',
  description: 'Proxy and monitor WebSocket connections with message interception',
  enabled: false,
  options: {
    logMessages: {
      type: 'boolean',
      default: true,
      label: 'Log Messages',
      description: 'Log WebSocket messages to console'
    },
    recordMessages: {
      type: 'boolean',
      default: false,
      label: 'Record Messages',
      description: 'Save WebSocket messages to disk'
    },
    maxConnections: {
      type: 'number',
      default: 100,
      label: 'Max Connections',
      description: 'Maximum number of concurrent WebSocket connections'
    },
    maxMessageSize: {
      type: 'number',
      default: 1048576,
      label: 'Max Message Size (bytes)',
      description: 'Maximum size of a single WebSocket message (1MB default)'
    }
  },
  handler: async ({ req, requestBody, config, decision }) => {
    // For HTTP requests, just pass through
    if (req.headers.upgrade !== 'websocket') {
      return decision;
    }

    // For WebSocket upgrade requests
    return {
      ...decision,
      // Will be used by the upgrade handler
      websocketConfig: config
    };
  }
};
