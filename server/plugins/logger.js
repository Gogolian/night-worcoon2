/**
 * Request logger plugin
 * Logs all requests with details
 */
export default {
  name: 'logger',
  description: 'Log request details',
  enabled: true,
  options: {
    logBody: {
      type: 'boolean',
      default: true,
      label: 'Log Request Body',
      description: 'Include request body size in logs'
    },
    logHeaders: {
      type: 'boolean',
      default: false,
      label: 'Log Headers',
      description: 'Include request headers in logs'
    }
  },
  handler: async ({ req, requestBody, config, decision }) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - Body: ${requestBody.length} bytes`);
    
    return {
      metadata: {
        logged: true,
        timestamp
      }
    };
  }
};
