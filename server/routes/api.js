import express from 'express';
import http from 'http';
import https from 'https';
import { saveState, getActiveConfigSet } from '../stateManager.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/**
 * Setup API routes
 * @param {object} pluginController - The plugin controller instance
 * @param {object} state - Shared state object
 * @returns {Router} Express router
 */
export function setupApiRoutes(pluginController, state) {
  // Get configuration
  router.get('/config', (req, res) => {
    const activeSet = getActiveConfigSet(state);
    res.json({
      proxyPort: state.proxyPort || 8079,
      targetUrl: activeSet.targetUrl,
      requestHeaders: activeSet.requestHeaders || {},
      changeOrigin: activeSet.changeOrigin,
      followRedirects: activeSet.followRedirects,
      debugLogs: state.debugLogs || false,
      activeRulesSet: state.activeRulesSet || 'active'
    });
  });

  // Update configuration
  router.post('/config', (req, res) => {
    const { proxyPort, targetUrl, requestHeaders, changeOrigin, followRedirects, debugLogs, autoRestart, activeRulesSet } = req.body;
    
    if (proxyPort !== undefined) {
      state.proxyPort = parseInt(proxyPort, 10);
    }
    
    // Update active config set values
    const activeSet = getActiveConfigSet(state);
    const setIndex = state.configSets.findIndex(s => s.id === activeSet.id);
    
    if (setIndex !== -1) {
      if (targetUrl !== undefined) {
        state.configSets[setIndex].targetUrl = targetUrl;
        console.log(`✓ Target URL updated to: ${targetUrl} (no restart needed)`);
      }
      
      if (requestHeaders !== undefined) {
        state.configSets[setIndex].requestHeaders = requestHeaders;
        console.log(`✓ Request headers updated (no restart needed)`);
      }

      if (changeOrigin !== undefined) {
        state.configSets[setIndex].changeOrigin = Boolean(changeOrigin);
        console.log(`✓ changeOrigin updated to: ${state.configSets[setIndex].changeOrigin} (no restart needed)`);
      }

      if (followRedirects !== undefined) {
        state.configSets[setIndex].followRedirects = Boolean(followRedirects);
        console.log(`✓ followRedirects updated to: ${state.configSets[setIndex].followRedirects} (no restart needed)`);
      }
    }
    
    if (debugLogs !== undefined) {
      state.debugLogs = debugLogs;
    }
    
    if (activeRulesSet !== undefined) {
      state.activeRulesSet = activeRulesSet;
      console.log(`✓ Active rules set changed to: ${activeRulesSet}`);
      
      // Reload mock plugin configuration from the new active rule set
      try {
        const rulesPath = join(__dirname, '..', '..', 'rules', `${activeRulesSet}.json`);
        if (existsSync(rulesPath)) {
          const data = readFileSync(rulesPath, 'utf8');
          const rules = JSON.parse(data);
          pluginController.setPluginConfig('mock', rules);
          console.log(`✓ Mock plugin reloaded with rules from ${activeRulesSet}.json`);
        }
      } catch (err) {
        console.error(`Failed to reload mock plugin config from ${activeRulesSet}.json:`, err.message);
      }
    }
    
    saveState(state);
    
    const updatedSet = getActiveConfigSet(state);
    res.json({
      success: true,
      proxyPort: state.proxyPort,
      targetUrl: updatedSet.targetUrl,
      requestHeaders: updatedSet.requestHeaders,
      changeOrigin: updatedSet.changeOrigin,
      followRedirects: updatedSet.followRedirects,
      debugLogs: state.debugLogs,
      message: 'Configuration saved and applied (no restart needed)'
    });
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
    const { name, targetUrl, requestHeaders, changeOrigin = true, followRedirects = true } = req.body;
    
    if (!name || !targetUrl) {
      return res.status(400).json({ error: 'Name and targetUrl are required' });
    }
    
    if (!state.configSets) state.configSets = [];
    
    const id = `set-${Date.now()}`;
    const newSet = {
      id,
      name,
      targetUrl,
      requestHeaders: requestHeaders || {},
      changeOrigin: Boolean(changeOrigin),
      followRedirects: Boolean(followRedirects)
    };
    
    state.configSets.push(newSet);
    saveState(state);
    
    res.json({ success: true, configSet: newSet });
  });

  // Update a config set
  router.put('/config-sets/:id', (req, res) => {
    const { id } = req.params;
    const { name, targetUrl, requestHeaders, changeOrigin, followRedirects } = req.body;
    
    if (!state.configSets) state.configSets = [];
    
    const setIndex = state.configSets.findIndex(s => s.id === id);
    if (setIndex === -1) {
      return res.status(404).json({ error: 'Config set not found' });
    }
    
    if (name !== undefined) state.configSets[setIndex].name = name;
    if (targetUrl !== undefined) state.configSets[setIndex].targetUrl = targetUrl;
    if (requestHeaders !== undefined) state.configSets[setIndex].requestHeaders = requestHeaders;
    if (changeOrigin !== undefined) state.configSets[setIndex].changeOrigin = Boolean(changeOrigin);
    if (followRedirects !== undefined) state.configSets[setIndex].followRedirects = Boolean(followRedirects);
    
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
    
    // Update active set (no longer copying values to root)
    state.activeConfigSet = id;
    
    saveState(state);
    
    console.log(`✓ Config set "${configSet.name}" activated - Target: ${configSet.targetUrl} (no restart needed)`);
    
    res.json({
      success: true,
      activeConfigSet: id,
      message: 'Config set activated and applied (no restart needed)'
    });
  });

  // ── Request client – forward a request to the active target URL ──────────
  router.post('/request', async (req, res) => {
    const { method = 'GET', path: reqPath = '/', headers: userHeaders = {}, body } = req.body || {};
    const activeSet  = getActiveConfigSet(state);
    const targetUrl  = (activeSet.targetUrl || 'http://localhost:8078').replace(/\/$/, '');
    const baseHdrs   = activeSet.requestHeaders || {};
    const merged     = { ...baseHdrs, ...userHeaders };
    const startTime  = Date.now();

    try {
      const normalPath = reqPath.startsWith('/') ? reqPath : '/' + reqPath;
      const fullUrl    = targetUrl + normalPath;
      const parsed     = new URL(fullUrl);
      const isHttps    = parsed.protocol === 'https:';
      const transport  = isHttps ? https : http;

      const reqHeaders = {
        'Content-Type': 'application/json',
        ...merged
      };
      const bodyBuf = (body && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()))
        ? Buffer.from(body, 'utf8')
        : null;
      if (bodyBuf) reqHeaders['Content-Length'] = String(bodyBuf.length);

      const options = {
        hostname: parsed.hostname,
        port    : parsed.port || (isHttps ? 443 : 80),
        path    : parsed.pathname + parsed.search,
        method  : method.toUpperCase(),
        headers : reqHeaders,
        rejectUnauthorized: false
      };

      const result = await new Promise((resolve, reject) => {
        const request = transport.request(options, (proxyRes) => {
          const chunks = [];
          proxyRes.on('data', chunk => chunks.push(chunk));
          proxyRes.on('end', () => resolve({
            status    : proxyRes.statusCode,
            statusText: proxyRes.statusMessage,
            headers   : proxyRes.headers,
            body      : Buffer.concat(chunks).toString('utf8'),
            latency   : Date.now() - startTime,
            url       : fullUrl
          }));
          proxyRes.on('error', reject);
        });
        request.on('error', reject);
        if (bodyBuf) request.write(bodyBuf);
        request.end();
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message, latency: Date.now() - startTime });
    }
  });

  // ── Local request — routes through plugin pipeline (bucket, mock, recorder…) ──
  router.post('/request-local', async (req, res) => {
    const { method = 'GET', path: reqPath = '/', headers: userHeaders = {}, body } = req.body || {};
    const activeSet  = getActiveConfigSet(state);
    const baseHdrs   = activeSet.requestHeaders || {};
    const merged     = { ...baseHdrs, ...userHeaders };
    const startTime  = Date.now();
    const localPort  = state.proxyPort || 8079;

    try {
      const normalPath = reqPath.startsWith('/') ? reqPath : '/' + reqPath;
      const fullUrl    = `http://localhost:${localPort}${normalPath}`;

      const reqHeaders = { 'Content-Type': 'application/json', ...merged };
      const bodyBuf = (body && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()))
        ? Buffer.from(body, 'utf8')
        : null;
      if (bodyBuf) reqHeaders['Content-Length'] = String(bodyBuf.length);

      const options = {
        hostname: 'localhost',
        port    : localPort,
        path    : normalPath,
        method  : method.toUpperCase(),
        headers : reqHeaders
      };

      const result = await new Promise((resolve, reject) => {
        const request = http.request(options, (proxyRes) => {
          const chunks = [];
          proxyRes.on('data', chunk => chunks.push(chunk));
          proxyRes.on('end', () => resolve({
            status    : proxyRes.statusCode,
            statusText: proxyRes.statusMessage,
            headers   : proxyRes.headers,
            body      : Buffer.concat(chunks).toString('utf8'),
            latency   : Date.now() - startTime,
            url       : fullUrl
          }));
          proxyRes.on('error', reject);
        });
        request.on('error', reject);
        if (bodyBuf) request.write(bodyBuf);
        request.end();
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message, latency: Date.now() - startTime });
    }
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
