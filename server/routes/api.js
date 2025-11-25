import express from 'express';
import { saveState } from '../stateManager.js';

const router = express.Router();

/**
 * Setup API routes
 * @param {object} pluginController - The plugin controller instance
 * @param {object} state - Shared state object
 * @returns {Router} Express router
 */
export function setupApiRoutes(pluginController, state) {
  // Get/set the 5xx blocking status
  router.get('/status', (req, res) => {
    res.json({ block5xxEnabled: state.block5xxResponses });
  });

  router.post('/status', (req, res) => {
    state.block5xxResponses = req.body.block5xxEnabled;
    
    // Enable/disable the block5xx plugin
    pluginController.setPluginEnabled('block5xx', state.block5xxResponses);
    
    // Save state to disk
    saveState(state);
    
    console.log(`5xx blocking ${state.block5xxResponses ? 'enabled' : 'disabled'}`);
    res.json({ block5xxEnabled: state.block5xxResponses });
  });

  // Get configuration
  router.get('/config', (req, res) => {
    res.json({
      proxyPort: state.proxyPort || 8079,
      targetUrl: state.targetUrl || 'http://localhost:8078',
      requestHeaders: state.requestHeaders || {},
      debugLogs: state.debugLogs || false
    });
  });

  // Update configuration
  router.post('/config', (req, res) => {
    const { proxyPort, targetUrl, requestHeaders, debugLogs, autoRestart } = req.body;
    
    if (proxyPort !== undefined) {
      state.proxyPort = parseInt(proxyPort, 10);
    }
    
    if (targetUrl !== undefined) {
      state.targetUrl = targetUrl;
    }
    
    if (requestHeaders !== undefined) {
      state.requestHeaders = requestHeaders;
    }
    
    if (debugLogs !== undefined) {
      state.debugLogs = debugLogs;
    }
    
    saveState(state);
    
    const message = autoRestart 
      ? 'Configuration saved. Server will restart in 2 seconds...'
      : 'Configuration saved. Restart server to apply changes.';
    
    res.json({
      success: true,
      proxyPort: state.proxyPort,
      targetUrl: state.targetUrl,
      requestHeaders: state.requestHeaders,
      debugLogs: state.debugLogs,
      message
    });
    
    // Auto-restart if requested
    if (autoRestart) {
      setTimeout(() => {
        console.log('🔄 Restarting server due to configuration change...');
        process.exit(0);
      }, 2000);
    }
  });

  // Manual server restart endpoint
  router.post('/restart', (req, res) => {
    res.json({
      success: true,
      message: 'Server will restart in 2 seconds...'
    });
    
    setTimeout(() => {
      console.log('🔄 Manual server restart requested...');
      process.exit(0);
    }, 2000);
  });

  // Get all config sets
  router.get('/config-sets', (req, res) => {
    res.json({
      configSets: state.configSets || [],
      activeConfigSet: state.activeConfigSet || 'default'
    });
  });

  // Create a new config set
  router.post('/config-sets', (req, res) => {
    const { name, targetUrl, requestHeaders } = req.body;
    
    if (!name || !targetUrl) {
      return res.status(400).json({ error: 'Name and targetUrl are required' });
    }
    
    if (!state.configSets) state.configSets = [];
    
    const id = `set-${Date.now()}`;
    const newSet = {
      id,
      name,
      targetUrl,
      requestHeaders: requestHeaders || {}
    };
    
    state.configSets.push(newSet);
    saveState(state);
    
    res.json({ success: true, configSet: newSet });
  });

  // Update a config set
  router.put('/config-sets/:id', (req, res) => {
    const { id } = req.params;
    const { name, targetUrl, requestHeaders } = req.body;
    
    if (!state.configSets) state.configSets = [];
    
    const setIndex = state.configSets.findIndex(s => s.id === id);
    if (setIndex === -1) {
      return res.status(404).json({ error: 'Config set not found' });
    }
    
    if (name !== undefined) state.configSets[setIndex].name = name;
    if (targetUrl !== undefined) state.configSets[setIndex].targetUrl = targetUrl;
    if (requestHeaders !== undefined) state.configSets[setIndex].requestHeaders = requestHeaders;
    
    saveState(state);
    
    res.json({ success: true, configSet: state.configSets[setIndex] });
  });

  // Delete a config set
  router.delete('/config-sets/:id', (req, res) => {
    const { id } = req.params;
    
    if (!state.configSets) state.configSets = [];
    
    // Don't allow deleting the active set or the last set
    if (id === state.activeConfigSet) {
      return res.status(400).json({ error: 'Cannot delete the active config set' });
    }
    
    if (state.configSets.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last config set' });
    }
    
    const setIndex = state.configSets.findIndex(s => s.id === id);
    if (setIndex === -1) {
      return res.status(404).json({ error: 'Config set not found' });
    }
    
    state.configSets.splice(setIndex, 1);
    saveState(state);
    
    res.json({ success: true });
  });

  // Switch active config set
  router.post('/config-sets/:id/activate', (req, res) => {
    const { id } = req.params;
    
    if (!state.configSets) state.configSets = [];
    
    const configSet = state.configSets.find(s => s.id === id);
    if (!configSet) {
      return res.status(404).json({ error: 'Config set not found' });
    }
    
    // Update active set
    state.activeConfigSet = id;
    
    // Apply the config set's settings to current state
    state.targetUrl = configSet.targetUrl;
    state.requestHeaders = configSet.requestHeaders;
    
    saveState(state);
    
    res.json({
      success: true,
      activeConfigSet: id,
      message: 'Config set activated. Restart server to apply changes.'
    });
  });

  // Get all plugins
  router.get('/plugins', (req, res) => {
    res.json({ plugins: pluginController.getPluginsInfo() });
  });

  // Enable/disable a plugin
  router.post('/plugins/:name', (req, res) => {
    const { name } = req.params;
    const { enabled } = req.body;
    
    console.log(`API: Toggle plugin ${name} to ${enabled}`);
    
    if (enabled === undefined) {
      return res.status(400).json({ error: 'Missing enabled field in request body' });
    }
    
    try {
      pluginController.setPluginEnabled(name, enabled);
      
      // Update state and save to disk
      if (!state.plugins) state.plugins = {};
      state.plugins[name] = enabled;
      saveState(state);
      
      // Verify the change
      const pluginInfo = pluginController.getPluginsInfo().find(p => p.name === name);
      console.log(`API: Plugin ${name} is now ${pluginInfo?.enabled ? 'enabled' : 'disabled'}`);
      
      res.json({ success: true, plugin: name, enabled: pluginInfo?.enabled });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update plugin execution order
  router.post('/plugins/order', (req, res) => {
    const { pluginOrder } = req.body;
    
    if (!Array.isArray(pluginOrder)) {
      return res.status(400).json({ error: 'pluginOrder must be an array' });
    }
    
    // Update plugin order
    pluginController.setPluginOrder(pluginOrder);
    state.pluginOrder = pluginOrder;
    saveState(state);
    
    console.log(`Plugin order updated: ${pluginOrder.join(' → ')}`);
    
    res.json({ success: true, pluginOrder, plugins: pluginController.getPluginsInfo() });
  });

  return router;
}

export default setupApiRoutes;
