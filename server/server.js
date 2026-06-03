import express from 'express';
import httpProxy from 'http-proxy';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
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
import { initBucket, getBucketConfig, flushData } from './plugins/bucket.js';
import { loadState, saveState, getActiveConfigSet } from './stateManager.js';
import { connectDb, closeDb, col, isDbConnected } from './db.js';
import { logManager } from './logManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app   = express();
const proxy = httpProxy.createProxyServer({ secure: false });

// Module-level so routes/websocket.js can import them
const wsConnections = new Map();
const wsMessageLog  = [];
const MAX_MESSAGE_LOG = 10000;

async function bootstrap() {
  // ── 1. Connect to MongoDB ────────────────────────────────────────────────────
  await connectDb();

  // ── 2. Load state ────────────────────────────────────────────────────────────
  const state = await loadState();

  const debugLog = (...args) => {
    if (state.debugLogs) console.log(...args);
  };

  // ── 3. Apply saved plugin order and states ───────────────────────────────────
  if (state.pluginOrder && Array.isArray(state.pluginOrder)) {
    pluginController.setPluginOrder(state.pluginOrder);
    console.log(`Plugin execution order: ${state.pluginOrder.join(' → ')}`);
  }
  if (state.plugins) {
    Object.entries(state.plugins).forEach(([name, enabled]) => {
      try {
        pluginController.setPluginEnabled(name, enabled);
      } catch (err) {
        console.error(`Failed to restore plugin ${name} state:`, err.message);
      }
    });
  }

  // ── 4. Initialise bucket from MongoDB ────────────────────────────────────────
  await initBucket();
  pluginController.setPluginConfig('bucket', getBucketConfig());

  // ── 5. Load active rules from MongoDB or file ────────────────────────────────
  try {
    const activeRulesSet = state.activeRulesSet || 'active';
    if (isDbConnected()) {
      const doc = await col('rules').findOne({ _id: activeRulesSet });
      if (doc) {
        const { _id, ...rules } = doc;
        pluginController.setPluginConfig('mock', rules);
        console.log(`✓ Loaded mock rules from MongoDB (${activeRulesSet})`);
      }
    } else {
      const rulesPath = join(__dirname, '..', 'rules', `${activeRulesSet}.json`);
      if (existsSync(rulesPath)) {
        const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
        pluginController.setPluginConfig('mock', rules);
        console.log(`✓ Loaded mock rules from ${activeRulesSet}.json`);
      }
    }
  } catch (err) {
    console.error('Failed to load active rules on startup:', err.message);
  }

  // ── Middleware ────────────────────────────────────────────────────────────────
  app.use(cors());

  app.use((req, res, next) => {
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

  // ── Routes ────────────────────────────────────────────────────────────────────
  app.use('/__api', setupApiRoutes(pluginController, state));
  app.use('/__api/rules', setupRulesRoutes(pluginController, state));
  app.use('/__api/recordings', setupRecordingsRoutes());
  app.use('/__api/websocket', setupWebSocketRoutes(wsConnections, wsMessageLog, state));
  app.use('/__api/logs', setupLogsRoutes(logManager));
  app.use('/__api/bucket', setupBucketRoutes(pluginController));

  // ── Proxy error handler ───────────────────────────────────────────────────────
  proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Night Worcoon 2: Bad Gateway', message: err.message });
    }
  });

  // ── Main request handler ──────────────────────────────────────────────────────
  app.all('*', async (req, res) => {
    if (req.path.startsWith('/__api/')) {
      return res.status(404).json({ error: 'Not Found' });
    }

    debugLog(`\n🔄 [${req.method}] Processing ${req.path}`);
    debugLog(`📊 [${req.method}] Body size: ${req.rawBody ? req.rawBody.length : 0} bytes`);

    req._logStart = Date.now();

    debugLog(`🔌 [${req.method}] Processing through plugins...`);
    const decision = await pluginController.processRequest({
      req,
      requestBody: req.rawBody || Buffer.alloc(0),
      config: {}
    });
    debugLog(`🔌 [${req.method}] Plugin decision:`, decision.action);

    if (decision.action === 'mock' && decision.mock) {
      console.log(`Returning mock for ${req.method} ${req.path}`);
      res.status(decision.mock.statusCode || 200);
      if (decision.mock.headers) {
        Object.entries(decision.mock.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      res.send(decision.mock.body || '');

      const mockBodyStr = decision.mock.body != null ? String(decision.mock.body) : null;
      logManager.addEntry({
        id: logManager.makeId(),
        timestamp: new Date().toISOString(),
        latency: Date.now() - (req._logStart || Date.now()),
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: logManager.truncateBody(logManager.decodeBodyForLogging(req.rawBody, req.headers))
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
          mockSource: decision.metadata?.mockSource || null,
          bucketSource: (decision.metadata?.bucketAction && decision.metadata.bucketAction !== 'miss') ? decision.metadata.bucketAction : null
        }
      });
      return;
    }

    debugLog(`🚀 [${req.method}] Preparing to proxy`);

    const mergedHeaders = { ...req.headers };
    if (decision.modifyRequest && decision.modifyRequest.headers) {
      debugLog(`📋 [${req.method}] Applying plugin header modifications:`, decision.modifyRequest.headers);
      Object.assign(mergedHeaders, decision.modifyRequest.headers);
    }

    const activeConfigSet = getActiveConfigSet(state);
    if (activeConfigSet.requestHeaders) {
      debugLog(`📋 [${req.method}] Applying config request headers:`, activeConfigSet.requestHeaders);
      Object.assign(mergedHeaders, activeConfigSet.requestHeaders);
    }

    req.headers = mergedHeaders;
    req.pluginDecision = decision;
    req.bufferedBody = req.rawBody;

    const proxyOptions = {
      target: activeConfigSet.targetUrl || 'http://localhost:8078',
      changeOrigin: activeConfigSet.changeOrigin !== undefined ? activeConfigSet.changeOrigin : true,
      selfHandleResponse: true,
      followRedirects: activeConfigSet.followRedirects !== undefined ? activeConfigSet.followRedirects : true,
      secure: false
    };

    if (req.rawBody && req.rawBody.length > 0) {
      debugLog(`📤 [${req.method}] Creating body stream from ${req.rawBody.length} bytes`);
      const { Readable } = await import('stream');
      const bodyStream = Readable.from(req.rawBody);
      proxyOptions.buffer = bodyStream;
    }

    proxy.web(req, res, proxyOptions, (err) => {
      if (err) {
        console.error(`❌ [${req.method}] Proxy web error:`, err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Proxy Error', message: err.message });
        }
      }
    });
  });

  // ── Proxy response handler ────────────────────────────────────────────────────
  proxy.on('proxyRes', (proxyRes, req, res) => {
    debugLog(`📥 [${req.method}] Received response: ${proxyRes.statusCode}`);
    const decision = req.pluginDecision;
    const shouldModifyResponse = decision && decision.modifyResponse;

    if (!shouldModifyResponse) {
      const logChunks = [];
      proxyRes.on('data', c => logChunks.push(c));
      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(logChunks);
        logManager.addEntry({
          id: logManager.makeId(),
          timestamp: new Date().toISOString(),
          latency: Date.now() - (req._logStart || Date.now()),
          request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: logManager.truncateBody(logManager.decodeBodyForLogging(req.rawBody, req.headers))
          },
          response: {
            status: proxyRes.statusCode,
            headers: proxyRes.headers,
            body: logManager.truncateBody(logManager.decodeBodyForLogging(responseBody, proxyRes.headers)),
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

    const chunks = [];
    proxyRes.on('data', chunk => chunks.push(chunk));
    proxyRes.on('end', () => {
      try {
        const responseBody = Buffer.concat(chunks);
        let finalStatusCode = proxyRes.statusCode;
        let finalHeaders    = { ...proxyRes.headers };
        let finalBody       = responseBody;

        req.actualRequestBody = req.bufferedBody;
        const modifications = decision.modifyResponse(proxyRes, responseBody);

        if (modifications) {
          if (modifications.statusCode) finalStatusCode = modifications.statusCode;
          if (modifications.headers) finalHeaders = { ...finalHeaders, ...modifications.headers };
          if (modifications.body !== undefined) {
            finalBody = typeof modifications.body === 'string'
              ? Buffer.from(modifications.body)
              : Buffer.from(JSON.stringify(modifications.body));
          }
        }

        if (finalBody !== responseBody) {
          finalHeaders['content-length'] = Buffer.byteLength(finalBody);
        }

        logManager.addEntry({
          id: logManager.makeId(),
          timestamp: new Date().toISOString(),
          latency: Date.now() - (req._logStart || Date.now()),
          request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: logManager.truncateBody(logManager.decodeBodyForLogging(req.rawBody, req.headers))
          },
          response: {
            status: finalStatusCode,
            headers: finalHeaders,
            body: logManager.truncateBody(logManager.decodeBodyForLogging(finalBody, finalHeaders)),
            size: finalBody.length
          },
          appInfo: {
            action: 'proxy',
            ruleMatched: decision?.metadata?.ruleMatched || null,
            mockSource: null
          }
        });

        if (!res.headersSent) {
          res.writeHead(finalStatusCode, finalHeaders);
          res.end(finalBody);
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

  // ── Start listening ───────────────────────────────────────────────────────────
  const PORT = state.proxyPort || 8079;
  const activeConfigSet = getActiveConfigSet(state);

  const server = app.listen(PORT, () => {
    console.log(`Proxy server listening on port ${PORT}`);
    console.log(`Active config set: ${activeConfigSet.name}`);
    console.log(`Forwarding requests to ${activeConfigSet.targetUrl}`);
  });

  // ── WebSocket helpers ─────────────────────────────────────────────────────────
  function generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function logWebSocketMessage(connectionId, direction, data) {
    const wsConfig = state.websocketConfig || {};
    const conn = wsConnections.get(connectionId);
    if (!conn) return;

    if (direction === 'client-to-server') {
      conn.messagesSent++;
    } else {
      conn.messagesReceived++;
    }
    conn.lastActivity = new Date().toISOString();

    if (wsConfig.logMessages) {
      const size = Buffer.isBuffer(data) ? data.length : data.toString().length;
      const arrow = direction === 'client-to-server' ? '→' : '←';
      debugLog(`📨 [WS] ${arrow} ${connectionId}: ${size} bytes`);
    }

    const messageData = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString();
    let contentType = 'text';
    let parsedMessage = messageData;
    try {
      parsedMessage = JSON.parse(messageData);
      contentType = 'json';
    } catch (e) { /* not JSON */ }

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
    if (wsMessageLog.length > MAX_MESSAGE_LOG) wsMessageLog.shift();

    if (wsConfig.recordMessages) {
      (async () => {
        try {
          const directionCode = direction === 'client-to-server' ? 'C2S' : 'S2C';
          const now = new Date();
          const fileTimestamp = now.toISOString()
            .replace(/[-:]/g, '')
            .replace('T', '_')
            .replace('.', '_')
            .replace('Z', '');
          const filename = `WS_${directionCode}_${fileTimestamp}.json`;

          const pathname = conn.url.startsWith('/') ? conn.url.slice(1) : conn.url;
          const wsPath = pathname || 'root';
          const recordingsDir = join(__dirname, '..', 'recordings', 'active', 'websocket', wsPath);

          await mkdir(recordingsDir, { recursive: true });

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

          await writeFile(join(recordingsDir, filename), JSON.stringify(recording, null, 2), 'utf8');
          debugLog(`💾 [WS] Recorded message to ${filename}`);
        } catch (err) {
          console.error(`❌ [WS] Failed to record message: ${err.message}`);
        }
      })().catch(err => console.error(`❌ [WS] Unhandled recording error: ${err.message}`));
    }
  }

  // ── WebSocket upgrade ─────────────────────────────────────────────────────────
  server.on('upgrade', async (req, socket, head) => {
    debugLog(`🔌 [WS] Upgrade request for ${req.url}`);
    try {
      const decision = await pluginController.processWebSocketUpgrade({
        req,
        config: getActiveConfigSet(state)
      });

      if (decision.action === 'block') {
        debugLog(`🚫 [WS] Connection blocked by plugin`);
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      const wsConfig = state.websocketConfig || {};
      const maxConnections = wsConfig.maxConnections || 100;
      if (wsConnections.size >= maxConnections) {
        debugLog(`🚫 [WS] Connection limit reached (${maxConnections})`);
        socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        socket.destroy();
        return;
      }

      const connectionId = generateConnectionId();
      wsConnections.set(connectionId, {
        id: connectionId,
        url: req.url,
        connectedAt: new Date().toISOString(),
        messagesReceived: 0,
        messagesSent: 0,
        lastActivity: new Date().toISOString()
      });
      debugLog(`✓ [WS] Connection established: ${connectionId}`);

      const targetUrl = new URL(getActiveConfigSet(state).targetUrl);
      const targetWsUrl = `${targetUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${targetUrl.host}${req.url}`;

      const requestedProtocols = req.headers['sec-websocket-protocol']
        ? req.headers['sec-websocket-protocol'].split(',').map(p => p.trim())
        : [];

      const wss = new WebSocketServer({
        noServer: true,
        handleProtocols: (protocols, request) => {
          const selected = protocols.size > 0 ? protocols.values().next().value : false;
          debugLog(`📋 [WS] Protocol negotiation: requested=${[...protocols].join(',')}, selected=${selected}`);
          return selected;
        }
      });

      wss.handleUpgrade(req, socket, head, (clientWs) => {
        debugLog(`✓ [WS] Client WebSocket created for ${connectionId}, protocol: ${clientWs.protocol}`);

        const headersToSkip = [
          'host', 'upgrade', 'connection',
          'sec-websocket-key', 'sec-websocket-version',
          'sec-websocket-extensions', 'sec-websocket-protocol'
        ];
        const headersToForward = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (!headersToSkip.includes(key.toLowerCase())) headersToForward[key] = value;
        }
        headersToForward['Host']   = targetUrl.host;
        headersToForward['Origin'] = `${targetUrl.protocol}//${targetUrl.host}`;

        const activeConfig = getActiveConfigSet(state);
        if (activeConfig.requestHeaders) {
          Object.assign(headersToForward, activeConfig.requestHeaders);
        }

        const serverWs = new WebSocket(
          targetWsUrl,
          requestedProtocols.length > 0 ? requestedProtocols : undefined,
          { headers: headersToForward, rejectUnauthorized: false }
        );

        const pendingMessages = [];
        let serverReady = false;

        const sendToServer = (data, isBinary, dec) => {
          const messageToSend = dec.modifiedMessage || data;
          if (dec.action === 'block') return;
          if (serverReady && serverWs.readyState === WebSocket.OPEN) {
            serverWs.send(messageToSend, { binary: isBinary });
          } else {
            pendingMessages.push({ data: messageToSend, isBinary });
          }
        };

        const flushPendingMessages = () => {
          while (pendingMessages.length > 0) {
            const { data, isBinary } = pendingMessages.shift();
            if (serverWs.readyState === WebSocket.OPEN) serverWs.send(data, { binary: isBinary });
          }
        };

        clientWs.on('message', async (data, isBinary) => {
          try {
            logWebSocketMessage(connectionId, 'client-to-server', data);
            const dec = await pluginController.processWebSocketMessage({
              direction: 'client-to-server', message: data, connectionId, config: wsConfig
            });
            sendToServer(data, isBinary, dec);
          } catch (err) {
            console.error(`Error processing client message for ${connectionId}:`, err.message);
          }
        });

        serverWs.on('message', async (data, isBinary) => {
          try {
            logWebSocketMessage(connectionId, 'server-to-client', data);
            const dec = await pluginController.processWebSocketMessage({
              direction: 'server-to-client', message: data, connectionId, config: wsConfig
            });
            const messageToSend = dec.modifiedMessage || data;
            if (clientWs.readyState === WebSocket.OPEN && dec.action !== 'block') {
              clientWs.send(messageToSend, { binary: isBinary });
            }
          } catch (err) {
            console.error(`Error processing server message for ${connectionId}:`, err.message);
          }
        });

        serverWs.on('open', () => {
          debugLog(`✓ [WS] Connected to target server for ${connectionId}`);
          serverReady = true;
          flushPendingMessages();
        });

        clientWs.on('error', (err) => {
          debugLog(`❌ [WS] Client error for ${connectionId}:`, err.message);
          wsConnections.delete(connectionId);
          if (serverWs.readyState === WebSocket.OPEN) serverWs.close(1000);
        });

        serverWs.on('error', (err) => {
          console.log(`❌ [WS] Server error for ${connectionId}:`, err.message);
          wsConnections.delete(connectionId);
          if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1000);
        });

        serverWs.on('unexpected-response', (req, res) => {
          console.log(`❌ [WS] Unexpected response for ${connectionId}: ${res.statusCode} ${res.statusMessage}`);
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => { if (body) console.log(`❌ [WS] Response body: ${body.substring(0, 500)}`); });
        });

        const getValidCloseCode = (code) => {
          const reservedCodes = [1004, 1005, 1006, 1014, 1015];
          if (reservedCodes.includes(code) || code < 1000 || code >= 5000) return 1000;
          return code;
        };

        clientWs.on('close', (code, reason) => {
          debugLog(`🔌 [WS] Client closed ${connectionId}: ${code} ${reason}`);
          if (serverWs.readyState === WebSocket.OPEN || serverWs.readyState === WebSocket.CONNECTING) {
            serverWs.close(getValidCloseCode(code), reason);
          }
          wsConnections.delete(connectionId);
        });

        serverWs.on('close', (code, reason) => {
          debugLog(`🔌 [WS] Server closed ${connectionId}: ${code} ${reason}`);
          if (clientWs.readyState === WebSocket.OPEN) clientWs.close(getValidCloseCode(code), reason);
          wsConnections.delete(connectionId);
        });
      });
    } catch (err) {
      console.error('WebSocket upgrade error:', err.message);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────────
  const shutdown = async (sig) => {
    console.log(`\n${sig} received — flushing data...`);
    await flushData();
    if (isDbConnected()) await closeDb();
    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});

export { wsConnections, wsMessageLog };
