import express from 'express';
import httpProxy from 'http-proxy';
import cors from 'cors';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { pluginController } from './pluginController.js';
import { setupApiRoutes } from './routes/api.js';
import { setupRulesRoutes } from './routes/rules.js';
import { setupRecordingsRoutes } from './routes/recordings.js';
import { setupWebSocketRoutes } from './routes/websocket.js';
import { setupLogsRoutes } from './routes/logs.js';
import { setupBucketRoutes } from './routes/bucket.js';
import { loadConfig as loadBucketConfig } from './plugins/bucket.js';
import { loadState, saveState, getActiveConfigSet } from './stateManager.js';
import { logManager } from './logManager.js';

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

// Load active rules for mock plugin on startup
try {
  const activeRulesSet = state.activeRulesSet || 'active';
  const activePath = join(__dirname, '..', 'rules', `${activeRulesSet}.json`);
  if (existsSync(activePath)) {
    const data = readFileSync(activePath, 'utf8');
    const activeRules = JSON.parse(data);
    pluginController.setPluginConfig('mock', activeRules);
    console.log(`✓ Loaded mock rules from "${activeRulesSet}.json"`);
  }
} catch (err) {
  console.error('Failed to load active rules on startup:', err.message);
}
// Load bucket config on startup
try {
  const bucketConfig = loadBucketConfig();
  pluginController.setPluginConfig('bucket', bucketConfig);
  console.log(`\u2713 Loaded bucket config with ${(bucketConfig.collections || []).length} collection(s)`);
} catch (err) {
  console.error('Failed to load bucket config on startup:', err.message);
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

// WebSocket connection tracking (will be initialized after server creation)
let wsConnections;
let wsMessageLog;

// Initialize WebSocket connection tracking
wsConnections = new Map(); // connectionId -> connection metadata
wsMessageLog = []; // Circular buffer for recent messages
const MAX_MESSAGE_LOG = 10000;

// Setup API routes
app.use('/__api', setupApiRoutes(pluginController, state));
app.use('/__api/rules', setupRulesRoutes(pluginController, state));
app.use('/__api/recordings', setupRecordingsRoutes());
app.use('/__api/websocket', setupWebSocketRoutes(wsConnections, wsMessageLog, state));
app.use('/__api/logs', setupLogsRoutes(logManager));
app.use('/__api/bucket', setupBucketRoutes(pluginController));

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

  // Timestamp for latency calculation
  req._logStart = Date.now();
  
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

    // Log mock entry
    const mockBodyStr = decision.mock.body != null ? String(decision.mock.body) : null;
    logManager.addEntry({
      id: logManager.makeId(),
      timestamp: new Date().toISOString(),
      latency: Date.now() - (req._logStart || Date.now()),
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: logManager.truncateBody(req.rawBody && req.rawBody.length > 0 ? req.rawBody.toString('utf8') : null)
      },
      response: {
        status: decision.mock.statusCode || 200,
        headers: decision.mock.headers || {},
        body: logManager.truncateBody(mockBodyStr),
        size: mockBodyStr ? Buffer.byteLength(mockBodyStr) : 0
      },
      appInfo: {
        action: 'mock',
        ruleMatched: decision.metadata?.ruleMatched || null,
        mockSource: decision.metadata?.mockSource || null
      }
    });
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
  
  // Apply custom request headers from active config set
  const activeConfigSet = getActiveConfigSet(state);
  if (activeConfigSet.requestHeaders) {
    debugLog(`📋 [${req.method}] Applying config request headers:`, activeConfigSet.requestHeaders);
    Object.assign(mergedHeaders, activeConfigSet.requestHeaders);
  } else {
    debugLog(`📋 [${req.method}] No config request headers to apply`);
  }
  
  req.headers = mergedHeaders;
  debugLog(`📋 [${req.method}] Final merged headers:`, mergedHeaders);

  // Store decision and body on req for use in proxyRes handler
  req.pluginDecision = decision;
  req.bufferedBody = req.rawBody;

  // Proxy options - use active config set's target URL
  const proxyOptions = {
    target: activeConfigSet.targetUrl || 'http://localhost:8078',
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
    // Buffer response so we can log it, then forward to client
    debugLog(`⚡ [${req.method}] Buffering proxy response for logging`);
    const logChunks = [];
    proxyRes.on('data', c => logChunks.push(c));
    proxyRes.on('end', () => {
      const responseBody = Buffer.concat(logChunks);
      // Log the proxied exchange
      logManager.addEntry({
        id: logManager.makeId(),
        timestamp: new Date().toISOString(),
        latency: Date.now() - (req._logStart || Date.now()),
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: logManager.truncateBody(req.rawBody && req.rawBody.length > 0 ? req.rawBody.toString('utf8') : null)
        },
        response: {
          status: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: logManager.truncateBody(responseBody.length > 0 ? responseBody.toString('utf8') : null),
          size: responseBody.length
        },
        appInfo: {
          action: 'proxy',
          ruleMatched: decision?.metadata?.ruleMatched || null,
          mockSource: null
        }
      });
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        res.end(responseBody);
      }
    });
    proxyRes.on('error', err => {
      console.error('ProxyRes stream error (no-modify path):', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy Response Error', message: err.message }));
      }
    });
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

      // Log the proxied exchange (recorder path - response body is available)
      logManager.addEntry({
        id: logManager.makeId(),
        timestamp: new Date().toISOString(),
        latency: Date.now() - (req._logStart || Date.now()),
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: logManager.truncateBody(req.rawBody && req.rawBody.length > 0 ? req.rawBody.toString('utf8') : null)
        },
        response: {
          status: finalStatusCode,
          headers: finalHeaders,
          body: logManager.truncateBody(finalBody.length > 0 ? finalBody.toString('utf8') : null),
          size: finalBody.length
        },
        appInfo: {
          action: 'proxy',
          ruleMatched: decision?.metadata?.ruleMatched || null,
          mockSource: null
        }
      });

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
const activeConfigSet = getActiveConfigSet(state);

// Generate unique connection ID
function generateConnectionId() {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// WebSocket upgrade handler
const server = app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
  console.log(`Active config set: ${activeConfigSet.name}`);
  console.log(`Forwarding requests to ${activeConfigSet.targetUrl}`);
});

// Helper to add message to log
function logWebSocketMessage(connectionId, direction, data) {
  const wsConfig = state.websocketConfig || {};
  const conn = wsConnections.get(connectionId);
  
  if (!conn) return;
  
  // Update connection stats
  if (direction === 'client-to-server') {
    conn.messagesSent++;
  } else {
    conn.messagesReceived++;
  }
  conn.lastActivity = new Date().toISOString();
  
  // Log to console if enabled
  if (wsConfig.logMessages) {
    const size = Buffer.isBuffer(data) ? data.length : data.toString().length;
    const arrow = direction === 'client-to-server' ? '→' : '←';
    debugLog(`📨 [WS] ${arrow} ${connectionId}: ${size} bytes`);
  }
  
  // Add to message log
  const messageData = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
  let contentType = 'text';
  let parsedMessage = messageData;
  
  // Try to parse as JSON
  try {
    parsedMessage = JSON.parse(messageData);
    contentType = 'json';
  } catch (e) {
    // Not JSON, keep as text
  }
  
  const timestamp = new Date().toISOString();
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    connectionId,
    direction,
    timestamp,
    size: messageData.length,
    preview: messageData.substring(0, 100),
    contentType,
    message: parsedMessage
  };
  
  wsMessageLog.push(message);
  
  // Keep circular buffer size
  if (wsMessageLog.length > MAX_MESSAGE_LOG) {
    wsMessageLog.shift();
  }
  
  // Record to disk if enabled
  if (wsConfig.recordMessages) {
    // Use async file operations to avoid blocking WebSocket I/O
    (async () => {
      try {
        // Build filename: WS_{direction}_{YYYYMMDD}_{HHMMSS}_{mmm}.json
        const directionCode = direction === 'client-to-server' ? 'C2S' : 'S2C';
        const now = new Date();
        const fileTimestamp = now.toISOString()
          .replace(/[-:]/g, '')
          .replace('T', '_')
          .replace('.', '_')
          .replace('Z', '');
        const filename = `WS_${directionCode}_${fileTimestamp}.json`;
        
        // Build directory path: recordings/active/websocket/{pathname}
        const pathname = conn.url.startsWith('/') ? conn.url.slice(1) : conn.url;
        const wsPath = pathname || 'root';
        const recordingsDir = join(__dirname, '..', 'recordings', 'active', 'websocket', wsPath);
        
        // Create directory if it doesn't exist
        await mkdir(recordingsDir, { recursive: true });
        
        // Build recording object
        const recording = {
          connectionId,
          url: conn.url,
          direction,
          timestamp,
          connectedAt: conn.connectedAt,
          messageType: contentType,
          size: messageData.length,
          message: parsedMessage,
          metadata: {
            messageNumber: direction === 'client-to-server' ? conn.messagesSent : conn.messagesReceived,
            encoding: 'utf-8'
          }
        };
        
        // Write to file
        const filepath = join(recordingsDir, filename);
        await writeFile(filepath, JSON.stringify(recording, null, 2), 'utf8');
        debugLog(`💾 [WS] Recorded message to ${filepath}`);
      } catch (err) {
        console.error(`❌ [WS] Failed to record message: ${err.message}`);
        console.error(err.stack);
      }
    })().catch(err => {
      console.error(`❌ [WS] Unhandled recording error: ${err.message}`);
      console.error(err.stack);
    });
  }
}

server.on('upgrade', async (req, socket, head) => {
  debugLog(`🔌 [WS] Upgrade request for ${req.url}`);
  
  try {
    // Execute plugin pipeline for WebSocket upgrade
    const decision = await pluginController.processWebSocketUpgrade({
      req,
      config: getActiveConfigSet(state)
    });
    
    // Check if connection should be blocked
    if (decision.action === 'block') {
      debugLog(`🚫 [WS] Connection blocked by plugin`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    
    // Check connection limit
    const wsConfig = state.websocketConfig || {};
    const maxConnections = wsConfig.maxConnections || 100;
    if (wsConnections.size >= maxConnections) {
      debugLog(`🚫 [WS] Connection limit reached (${maxConnections})`);
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    
    // Generate connection ID
    const connectionId = generateConnectionId();
    
    // Track connection
    wsConnections.set(connectionId, {
      id: connectionId,
      url: req.url,
      connectedAt: new Date().toISOString(),
      messagesReceived: 0,
      messagesSent: 0,
      lastActivity: new Date().toISOString()
    });
    
    debugLog(`✓ [WS] Connection established: ${connectionId}`);
    
    // Get target URL from active config
    const targetUrl = new URL(getActiveConfigSet(state).targetUrl);
    const targetWsUrl = `${targetUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${targetUrl.host}${req.url}`;
    debugLog(`🎯 [WS] Target URL: ${getActiveConfigSet(state).targetUrl} -> ${targetWsUrl}`);
    
    // Extract subprotocols from request headers (e.g., 'v12.stomp')
    const requestedProtocols = req.headers['sec-websocket-protocol'] 
      ? req.headers['sec-websocket-protocol'].split(',').map(p => p.trim())
      : [];
    
    // Create WebSocket server to handle the upgrade with protocol negotiation
    const wss = new WebSocketServer({ 
      noServer: true,
      handleProtocols: (protocols, request) => {
        // Accept the first requested protocol (or return false to reject)
        const selected = protocols.size > 0 ? protocols.values().next().value : false;
        debugLog(`📋 [WS] Protocol negotiation: requested=${[...protocols].join(',')}, selected=${selected}`);
        return selected;
      }
    });
    
    // Handle the upgrade manually
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      debugLog(`✓ [WS] Client WebSocket created for ${connectionId}, protocol: ${clientWs.protocol}`);
      
      // Prepare headers to forward - filter out WebSocket-specific headers that shouldn't be forwarded
      const headersToForward = {};
      const headersToSkip = [
        'host', 
        'upgrade', 
        'connection', 
        'sec-websocket-key', 
        'sec-websocket-version', 
        'sec-websocket-extensions',
        'sec-websocket-protocol' // Will be passed separately as protocol option
      ];
      
      for (const [key, value] of Object.entries(req.headers)) {
        if (!headersToSkip.includes(key.toLowerCase())) {
          headersToForward[key] = value;
        }
      }
      
      // Set the correct Host header for the target server
      headersToForward['Host'] = targetUrl.host;
      
      // Update Origin header to match the target server (required for CORS)
      headersToForward['Origin'] = `${targetUrl.protocol}//${targetUrl.host}`;
      
      // Apply custom request headers from active config set
      const activeConfig = getActiveConfigSet(state);
      if (activeConfig.requestHeaders) {
        debugLog(`📋 [WS] Applying config request headers:`, activeConfig.requestHeaders);
        Object.assign(headersToForward, activeConfig.requestHeaders);
      }
      
      debugLog(`📋 [WS] Headers to forward:`, headersToForward);
      
      if (requestedProtocols.length > 0) {
        debugLog(`📋 [WS] Subprotocols to negotiate: ${requestedProtocols.join(', ')}`);
      }
      
      // Connect to target server with same subprotocols
      const serverWs = new WebSocket(targetWsUrl, requestedProtocols.length > 0 ? requestedProtocols : undefined, {
        headers: headersToForward,
        rejectUnauthorized: false // Allow self-signed certificates
      });
      
      // Message queue for buffering messages until server connection is ready
      const pendingMessages = [];
      let serverReady = false;
      
      // Helper to send message to server (with queueing if not ready)
      const sendToServer = (data, isBinary, decision) => {
        const messageToSend = decision.modifiedMessage || data;
        if (decision.action === 'block') return;
        
        if (serverReady && serverWs.readyState === WebSocket.OPEN) {
          serverWs.send(messageToSend, { binary: isBinary });
          debugLog(`📤 [WS] Forwarded to server: ${messageToSend.length || messageToSend.byteLength} bytes`);
        } else {
          // Queue message for later
          pendingMessages.push({ data: messageToSend, isBinary });
          debugLog(`📥 [WS] Queued message (server not ready): ${pendingMessages.length} pending`);
        }
      };
      
      // Flush pending messages when server is ready
      const flushPendingMessages = () => {
        if (pendingMessages.length > 0) {
          debugLog(`📤 [WS] Flushing ${pendingMessages.length} pending messages`);
          while (pendingMessages.length > 0) {
            const { data, isBinary } = pendingMessages.shift();
            if (serverWs.readyState === WebSocket.OPEN) {
              serverWs.send(data, { binary: isBinary });
            }
          }
        }
      };
      
      // Client -> Server
      clientWs.on('message', async (data, isBinary) => {
        try {
          // Log the message
          logWebSocketMessage(connectionId, 'client-to-server', data);
          
          // Process through plugin pipeline (for future message modification)
          const decision = await pluginController.processWebSocketMessage({
            direction: 'client-to-server',
            message: data,
            connectionId,
            config: wsConfig
          });
          
          // Forward to server (queued if not ready)
          sendToServer(data, isBinary, decision);
        } catch (err) {
          console.error(`Error processing client message for ${connectionId}:`, err.message);
        }
      });
      
      // Server -> Client
      serverWs.on('message', async (data, isBinary) => {
        try {
          // Log the message
          logWebSocketMessage(connectionId, 'server-to-client', data);
          
          // Process through plugin pipeline (for future message modification)
          const decision = await pluginController.processWebSocketMessage({
            direction: 'server-to-client',
            message: data,
            connectionId,
            config: wsConfig
          });
          
          // Forward to client (use modified message if available)
          const messageToSend = decision.modifiedMessage || data;
          if (clientWs.readyState === WebSocket.OPEN && decision.action !== 'block') {
            clientWs.send(messageToSend, { binary: isBinary });
            debugLog(`📤 [WS] Forwarded to client: ${messageToSend.length || messageToSend.byteLength} bytes`);
          }
        } catch (err) {
          console.error(`Error processing server message for ${connectionId}:`, err.message);
        }
      });
      
      // Handle connection open
      serverWs.on('open', () => {
        debugLog(`✓ [WS] Connected to target server for ${connectionId}`);
        serverReady = true;
        flushPendingMessages();
      });
      
      // Handle errors
      clientWs.on('error', (err) => {
        debugLog(`❌ [WS] Client error for ${connectionId}:`, err.message);
        // Clean up connection on error
        wsConnections.delete(connectionId);
        if (serverWs.readyState === WebSocket.OPEN) {
          serverWs.close(1000);
        }
      });
      
      serverWs.on('error', (err) => {
        console.log(`❌ [WS] Server error for ${connectionId}:`, err.message);
        console.log(`❌ [WS] Target URL was: ${targetWsUrl}`);
        // Clean up connection on error
        wsConnections.delete(connectionId);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1000);
        }
      });
      
      // Handle unexpected HTTP responses (non-101)
      serverWs.on('unexpected-response', (req, res) => {
        console.log(`❌ [WS] Unexpected response for ${connectionId}: ${res.statusCode} ${res.statusMessage}`);
        console.log(`❌ [WS] Target URL was: ${targetWsUrl}`);
        console.log(`❌ [WS] Request headers sent:`, headersToForward);
        
        // Read response body for more details
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (body) {
            console.log(`❌ [WS] Response body: ${body.substring(0, 500)}`);
          }
        });
      });
      
      // Helper to get a valid close code (some codes like 1005, 1006 are reserved and cannot be sent)
      const getValidCloseCode = (code) => {
        // Reserved codes that MUST NOT be sent: 1004, 1005, 1006, 1014, 1015
        const reservedCodes = [1004, 1005, 1006, 1014, 1015];
        if (reservedCodes.includes(code) || code < 1000 || code >= 5000) {
          return 1000; // Normal closure
        }
        return code;
      };
      
      // Handle connection close
      clientWs.on('close', (code, reason) => {
        debugLog(`🔌 [WS] Client closed ${connectionId}: ${code} ${reason}`);
        if (serverWs.readyState === WebSocket.OPEN || serverWs.readyState === WebSocket.CONNECTING) {
          const closeCode = getValidCloseCode(code);
          serverWs.close(closeCode, reason);
        }
        wsConnections.delete(connectionId);
      });
      
      serverWs.on('close', (code, reason) => {
        debugLog(`🔌 [WS] Server closed ${connectionId}: ${code} ${reason}`);
        if (clientWs.readyState === WebSocket.OPEN) {
          const closeCode = getValidCloseCode(code);
          clientWs.close(closeCode, reason);
        }
        wsConnections.delete(connectionId);
      });
    });
    
  } catch (err) {
    console.error('WebSocket upgrade error:', err.message);
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
});

// Export for WebSocket routes
export { wsConnections, wsMessageLog };
