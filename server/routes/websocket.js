import express from 'express';
import { getWebSocketConfig, updateWebSocketConfig } from '../stateManager.js';

/**
 * Setup WebSocket API routes
 * @param {Map} wsConnections - Active WebSocket connections map
 * @param {Array} wsMessageLog - WebSocket message log
 * @param {Object} state - Application state
 * @returns {express.Router} Router instance
 */
export function setupWebSocketRoutes(wsConnections, wsMessageLog, state) {
  const router = express.Router();

  /**
   * GET /connections
   * Get list of active WebSocket connections
   */
  router.get('/connections', (req, res) => {
    try {
      console.log(`🔍 [WS API] GET /connections - wsConnections size: ${wsConnections.size}`);
      const connections = Array.from(wsConnections.values());
      console.log(`🔍 [WS API] Returning ${connections.length} connections`);
      res.json({ connections });
    } catch (error) {
      console.error('Error fetching WebSocket connections:', error);
      res.status(500).json({ error: 'Failed to fetch connections', message: error.message });
    }
  });

  /**
   * GET /messages
   * Get recent WebSocket messages
   * Query params: limit, connectionId
   */
  router.get('/messages', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const connectionId = req.query.connectionId;

      console.log(`🔍 [WS API] GET /messages - wsMessageLog length: ${wsMessageLog.length}, limit: ${limit}`);

      let messages = wsMessageLog;

      // Filter by connection ID if specified
      if (connectionId) {
        messages = messages.filter(m => m.connectionId === connectionId);
      }

      // Return most recent messages up to limit
      const recentMessages = messages.slice(-limit);

      console.log(`🔍 [WS API] Returning ${recentMessages.length} messages`);
      res.json({ messages: recentMessages });
    } catch (error) {
      console.error('Error fetching WebSocket messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages', message: error.message });
    }
  });

  /**
   * GET /config
   * Get WebSocket configuration
   */
  router.get('/config', (req, res) => {
    try {
      const config = getWebSocketConfig(state);
      res.json(config);
    } catch (error) {
      console.error('Error fetching WebSocket config:', error);
      res.status(500).json({ error: 'Failed to fetch config', message: error.message });
    }
  });

  /**
   * POST /config
   * Update WebSocket configuration
   */
  router.post('/config', (req, res) => {
    try {
      const updates = req.body;
      console.log('🔧 [WS API] POST /config - Received updates:', updates);
      
      const newState = updateWebSocketConfig(state, updates);
      console.log('🔧 [WS API] Updated state websocketConfig:', newState.websocketConfig);
      
      // Update the state object reference
      Object.assign(state, newState);
      
      const config = getWebSocketConfig(state);
      console.log('🔧 [WS API] Returning config:', config);
      res.json(config);
    } catch (error) {
      console.error('Error updating WebSocket config:', error);
      res.status(500).json({ error: 'Failed to update config', message: error.message });
    }
  });

  /**
   * DELETE /connections/:id
   * Close a WebSocket connection
   */
  router.delete('/connections/:id', (req, res) => {
    try {
      const connectionId = req.params.id;
      const connection = wsConnections.get(connectionId);

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Connection will be cleaned up by close event handler
      // For now, just remove from map
      wsConnections.delete(connectionId);

      res.json({ success: true, message: 'Connection closed' });
    } catch (error) {
      console.error('Error closing WebSocket connection:', error);
      res.status(500).json({ error: 'Failed to close connection', message: error.message });
    }
  });

  /**
   * POST /messages/clear
   * Clear message log
   */
  router.post('/messages/clear', (req, res) => {
    try {
      wsMessageLog.length = 0;
      res.json({ success: true, message: 'Message log cleared' });
    } catch (error) {
      console.error('Error clearing message log:', error);
      res.status(500).json({ error: 'Failed to clear log', message: error.message });
    }
  });

  return router;
}
