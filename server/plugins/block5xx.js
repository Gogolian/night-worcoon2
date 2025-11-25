/**
 * Block 5xx errors plugin
 * Intercepts 5xx responses and returns 502 instead
 */
export default {
  name: 'block5xx',
  description: 'Block 5xx server errors and return 502',
  enabled: false,
  options: {
    statusCode: {
      type: 'number',
      default: 502,
      label: 'Replacement Status Code',
      description: 'Status code to return instead of 5xx'
    },
    includeOriginal: {
      type: 'boolean',
      default: true,
      label: 'Include Original Status',
      description: 'Include original status in response body'
    }
  },
  handler: async ({ req, requestBody, config, decision }) => {
    // This plugin only modifies responses, not requests
    return {
      modifyResponse: (proxyRes, responseBody) => {
        if (proxyRes.statusCode >= 500 && proxyRes.statusCode < 600) {
          return {
            statusCode: 502,
            headers: {
              'content-type': 'application/json',
              'x-blocked-by': 'block5xx-plugin'
            },
            body: JSON.stringify({
              error: 'Bad Gateway',
              message: 'Request blocked: Server returned 5xx error',
              originalStatus: proxyRes.statusCode
            })
          };
        }
        return null; // no modification
      }
    };
  }
};
