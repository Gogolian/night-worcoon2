/**
 * Mock response plugin (example)
 * Returns mock responses for specific endpoints
 */
export default {
  name: 'mock',
  description: 'Return mock responses for specific endpoints',
  enabled: false,
  options: {
    mockEndpoint: {
      type: 'text',
      default: '/__api/test',
      label: 'Mock Endpoint Pattern',
      description: 'URL pattern to mock (supports wildcards)'
    },
    mockStatus: {
      type: 'number',
      default: 200,
      label: 'Mock Status Code',
      description: 'Status code for mock responses'
    },
    mockDelay: {
      type: 'number',
      default: 0,
      label: 'Mock Delay (ms)',
      description: 'Delay before returning mock response'
    }
  },
  handler: async ({ req, requestBody, config, decision }) => {
    // Example: mock /__api/test endpoint
    if (req.url.includes('/__api/test')) {
      return {
        action: 'mock',
        mock: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
            'x-mocked': 'true'
          },
          body: JSON.stringify({ mocked: true, message: 'This is a mock response' })
        },
        stopProcessing: true // don't process other plugins
      };
    }
    
    return null; // no action
  }
};
