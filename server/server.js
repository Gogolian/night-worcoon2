import express from 'express';
import httpProxy from 'http-proxy';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pluginController } from './pluginController.js';
import { setupApiRoutes } from './routes/api.js';
import { setupRulesRoutes } from './routes/rules.js';
import { loadState, saveState } from './stateManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const proxy = httpProxy.createProxyServer({
  secure: false // Allow self-signed certificates (for development)
});

// Load state from disk
const state = loadState();

// Debug logging helper
const debugLog = (...args) => {
  if (state.debugLogs) {
    console.log(...args);
  }
};

// Apply plugin order from saved state
if (state.pluginOrder && Array.isArray(state.pluginOrder)) {
  pluginController.setPluginOrder(state.pluginOrder);
  console.log(`Plugin execution order: ${state.pluginOrder.join(' → ')}`);
}

// Apply plugin states from saved state
if (state.plugins) {
  Object.entries(state.plugins).forEach(([name, enabled]) => {
    try {
      pluginController.setPluginEnabled(name, enabled);
    } catch (err) {
      console.error(`Failed to restore plugin ${name} state:`, err.message);
    }
  });
}

// Apply plugin configurations from saved state
if (state.pluginConfigs) {
  Object.entries(state.pluginConfigs).forEach(([name, config]) => {
    try {
      pluginController.setPluginConfig(name, config);
    } catch (err) {
      console.error(`Failed to restore plugin ${name} config:`, err.message);
    }
  });
}

// Load active rules for mock plugin on startup
try {
  const activePath = join(__dirname, '..', 'rules', 'active.json');
  if (existsSync(activePath)) {
    const data = readFileSync(activePath, 'utf8');
    const activeRules = JSON.parse(data);
    pluginController.setPluginConfig('mock', activeRules);
    console.log('✓ Loaded active mock rules');
  }
} catch (err) {
  console.error('Failed to load active rules on startup:', err.message);
}

// Middleware
app.use(cors());

// Middleware to buffer request body before proxying (BEFORE express.json)
app.use((req, res, next) => {
  // Only apply express.json to API endpoints
  if (req.path.startsWith('/__api/')) {
    return express.json()(req, res, next);
  }
  
  debugLog(`📦 [Buffer] Starting body buffer for ${req.method} ${req.path}`);
  const chunks = [];
  req.on('data', chunk => {
    debugLog(`📦 [Buffer] Received chunk: ${chunk.length} bytes`);
    chunks.push(chunk);
  });
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    debugLog(`📦 [Buffer] Body buffering complete: ${req.rawBody.length} bytes`);
    next();
  });
  req.on('error', (err) => {
    console.error('❌ [Buffer] Error reading request body:', err);
    next(err);
  });
});

// Setup API routes
app.use('/__api', setupApiRoutes(pluginController, state));
app.use('/__api/rules', setupRulesRoutes(pluginController, state));

// Proxy error handling
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (!res.headersSent) {
    res.status(502).json({ error: 'Night Worcoon 2: Bad Gateway', message: err.message });
  }
});

// Proxy all other requests to port 8078
app.all('*', async (req, res) => {
  // Skip API endpoints
  if (req.path.startsWith('/__api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }

  debugLog(`\n🔄 [${req.method}] Processing ${req.path}`);
  debugLog(`📊 [${req.method}] Body size: ${req.rawBody ? req.rawBody.length : 0} bytes`);
  
  // Process request through plugin controller
  debugLog(`🔌 [${req.method}] Processing through plugins...`);
  const decision = await pluginController.processRequest({
    req,
    requestBody: req.rawBody || Buffer.alloc(0),
    config: {}
  });
  debugLog(`🔌 [${req.method}] Plugin decision:`, decision.action);

  // Handle decision
  if (decision.action === 'mock' && decision.mock) {
    // Return mock response
    console.log(`Returning mock for ${req.method} ${req.path}`);
    res.status(decision.mock.statusCode || 200);
    
    if (decision.mock.headers) {
      Object.entries(decision.mock.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    
    res.send(decision.mock.body || '');
    return;
  }

  // Default: proxy the request
  debugLog(`🚀 [${req.method}] Preparing to proxy to ${state.targetUrl}`);
  
  // Merge headers: plugin headers first, then config headers (without overwriting)
  const mergedHeaders = { ...req.headers };
  debugLog(`📋 [${req.method}] Original headers:`, mergedHeaders);
  
  // Apply plugin modifications
  if (decision.modifyRequest && decision.modifyRequest.headers) {
    debugLog(`📋 [${req.method}] Applying plugin header modifications:`, decision.modifyRequest.headers);
    Object.assign(mergedHeaders, decision.modifyRequest.headers);
  }
  
  // Apply custom request headers from config (only if not already set)
  if (state.requestHeaders) {
    debugLog(`📋 [${req.method}] Applying config request headers:`, state.requestHeaders);
    Object.assign(mergedHeaders, state.requestHeaders);
  } else {
    debugLog(`📋 [${req.method}] No config request headers to apply`);
  }
  
  req.headers = mergedHeaders;
  debugLog(`📋 [${req.method}] Final merged headers:`, mergedHeaders);

  // Store decision and body on req for use in proxyRes handler
  req.pluginDecision = decision;
  req.bufferedBody = req.rawBody;

  // Proxy options
  const proxyOptions = {
    target: state.targetUrl || 'http://localhost:8078',
    changeOrigin: true,
    selfHandleResponse: true,
    followRedirects: true,
    secure: false // Allow self-signed certificates (for development)
  };

  // Create a stream from the buffered body if present
  if (req.rawBody && req.rawBody.length > 0) {
    debugLog(`📤 [${req.method}] Creating body stream from ${req.rawBody.length} bytes`);
    const { Readable } = await import('stream');
    const bodyStream = Readable.from(req.rawBody);
    proxyOptions.buffer = bodyStream;
  } else {
    debugLog(`📤 [${req.method}] No body to send`);
  }

  debugLog(`⏳ [${req.method}] Calling proxy.web()...`);
  proxy.web(req, res, proxyOptions, (err) => {
    if (err) {
      console.error(`❌ [${req.method}] Proxy web error:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Proxy Error', message: err.message });
      }
    } else {
      debugLog(`✅ [${req.method}] proxy.web() completed without error`);
    }
  });
});

// Handle proxy response with plugin modifications
proxy.on('proxyRes', (proxyRes, req, res) => {
  debugLog(`📥 [${req.method}] Received response: ${proxyRes.statusCode}`);
  const decision = req.pluginDecision;
  
  // Check if we need to handle the response
  const shouldModifyResponse = decision && decision.modifyResponse;
  debugLog(`🔍 [${req.method}] Should modify response: ${!!shouldModifyResponse}`);
  
  if (!shouldModifyResponse) {
    // No modifications needed, stream directly to client
    debugLog(`⚡ [${req.method}] Streaming response directly to client`);
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
    return;
  }
  
  // Collect response body chunks for modification
  debugLog(`📦 [${req.method}] Buffering response for modification...`);
  const chunks = [];
  
  proxyRes.on('data', (chunk) => {
    debugLog(`📦 [${req.method}] Response chunk: ${chunk.length} bytes`);
    chunks.push(chunk);
  });
  
  proxyRes.on('end', () => {
    debugLog(`✅ [${req.method}] Response buffering complete`);
    try {
      const responseBody = Buffer.concat(chunks);
      
      let finalStatusCode = proxyRes.statusCode;
      let finalHeaders = { ...proxyRes.headers };
      let finalBody = responseBody;

      // Update decision with actual request body for recorder
      req.actualRequestBody = req.bufferedBody;
      const modifications = decision.modifyResponse(proxyRes, responseBody);

      debugLog(`[${req.method}] modifications`, modifications);

      if (modifications) {
        if (modifications.statusCode) finalStatusCode = modifications.statusCode;
        if (modifications.headers) finalHeaders = { ...finalHeaders, ...modifications.headers };
        if (modifications.body !== undefined) {
          finalBody = typeof modifications.body === 'string' 
            ? Buffer.from(modifications.body) 
            : Buffer.from(JSON.stringify(modifications.body));
        }
      }

      // Update content-length header if body was modified
      if (finalBody !== responseBody) {
        finalHeaders['content-length'] = Buffer.byteLength(finalBody);
      }

      // Write final response
      if (!res.headersSent) {
        debugLog(`📤 [${req.method}] Sending final response: ${finalStatusCode}, ${finalBody.length} bytes`);
        res.writeHead(finalStatusCode, finalHeaders);
        res.end(finalBody);
      } else {
        debugLog(`⚠️ [${req.method}] Headers already sent, skipping response`);
      }
    } catch (err) {
      console.error('Error processing proxy response:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy Response Error', message: err.message }));
      }
    }
  });
  
  proxyRes.on('error', (err) => {
    console.error('ProxyRes stream error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy Response Error', message: err.message }));
    }
  });
});

const PORT = state.proxyPort || 8079;
const TARGET_URL = state.targetUrl || 'http://localhost:8078';

app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
  console.log(`Forwarding requests to ${TARGET_URL}`);
});
