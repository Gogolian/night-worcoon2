import http from 'node:http';

/**
 * Minimal mock HTTP server for testing the proxy.
 * Responds with predictable payloads based on the route.
 *
 * Routes:
 *   GET  /health          → 200 { status: "ok" }
 *   GET  /json            → 200 { hello: "world" }
 *   POST /echo            → 200 echoes request body back
 *   GET  /status/:code    → responds with that status code
 *   GET  /redirect        → 301 → /json
 *   GET  /redirect-chain  → 301 → /redirect → /json
 *   GET  /slow            → 200 after 2s delay
 *   GET  /headers         → 200 returns received request headers as JSON
 *   *    (anything else)  → 404
 */

const ROUTES = {
  'GET /health': (req, res) => {
    respond(res, 200, { status: 'ok' });
  },

  'GET /json': (req, res) => {
    respond(res, 200, { hello: 'world' });
  },

  'POST /echo': (req, res, body) => {
    res.writeHead(200, {
      'content-type': req.headers['content-type'] || 'application/octet-stream',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
  },

  'GET /redirect': (req, res) => {
    res.writeHead(301, { location: '/json' });
    res.end();
  },

  'GET /redirect-chain': (req, res) => {
    res.writeHead(301, { location: '/redirect' });
    res.end();
  },

  'GET /slow': (req, res) => {
    setTimeout(() => respond(res, 200, { slow: true }), 2000);
  },

  'GET /headers': (req, res) => {
    respond(res, 200, req.headers);
  },
};

function respond(res, status, json) {
  const body = JSON.stringify(json);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export function createMockServer(port = 8078) {
  const server = http.createServer(async (req, res) => {
    const body = await collectBody(req);

    // Check /status/:code route
    const statusMatch = req.url.match(/^\/status\/(\d{3})$/);
    if (statusMatch && req.method === 'GET') {
      const code = parseInt(statusMatch[1], 10);
      respond(res, code, { status: code });
      return;
    }

    const key = `${req.method} ${req.url.split('?')[0]}`;
    const handler = ROUTES[key];

    if (handler) {
      handler(req, res, body);
    } else {
      respond(res, 404, { error: 'not found', path: req.url });
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

// Run standalone if executed directly
if (process.argv[1] && process.argv[1].endsWith('mock-server.js')) {
  const port = parseInt(process.argv[2], 10) || 8078;
  createMockServer(port).then(() => {
    process.stdout.write(`Mock server listening on http://localhost:${port}\n`);
  });
}
