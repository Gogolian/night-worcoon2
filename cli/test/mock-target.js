import http from 'node:http';

/**
 * Minimal mock HTTP server for testing the proxy.
 * Exposes helpers to start/stop and to define per-test route handlers.
 */
export function createMockTarget(port = 9999) {
  let handler = defaultHandler;

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => handler(req, res, body));
  });

  function defaultHandler(req, res) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      method: req.method,
      url: req.url,
      headers: req.headers,
    }));
  }

  return {
    start() {
      return new Promise((resolve) => server.listen(port, resolve));
    },
    stop() {
      return new Promise((resolve) => server.close(resolve));
    },
    /** Override the handler for the next requests. Resets on stop. */
    setHandler(fn) { handler = fn; },
    resetHandler() { handler = defaultHandler; },
    get port() { return port; },
  };
}
