/**
 * CORS headers plugin
 * Adds CORS headers to all responses
 */
export default {
  name: 'cors',
  description: 'Add CORS headers to responses',
  enabled: true,
  options: {
    allowOrigin: {
      type: 'text',
      default: '*',
      label: 'Allow Origin',
      description: 'CORS Allow-Origin header value'
    },
    allowMethods: {
      type: 'text',
      default: 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
      label: 'Allow Methods',
      description: 'CORS Allow-Methods header value'
    }
  },
  handler: async ({ req, requestBody, config, decision }) => {
    return {
      modifyResponse: (proxyRes, responseBody) => {
        const headers = { ...proxyRes.headers };
        headers['access-control-allow-origin'] = headers['access-control-allow-origin'] || '*';
        headers['access-control-allow-methods'] = headers['access-control-allow-methods'] || 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS';
        headers['access-control-allow-headers'] = headers['access-control-allow-headers'] || 'Content-Type, Origin, Accept, Authorization, Content-Length, X-Requested-With';
        headers['access-control-allow-credentials'] = headers['access-control-allow-credentials'] || 'true';
        
        return {
          headers
        };
      }
    };
  }
};
