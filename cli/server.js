import http from 'node:http';
import { proxyRequest, ProxyError } from './proxy.js';
import { incomingHandler, backHandler } from './handlers.js';
import { createLogger } from './logger.js';

export function startServer(config, env) {
  const logger = createLogger(config.logLevel);
  const maxSize = config.maxRequestSize;

  const server = http.createServer(async (req, res) => {
    if (maxSize !== -1) {
      const contentLength = parseInt(req.headers['content-length'], 10);
      if (contentLength > maxSize) {
        res.writeHead(413, { 'content-type': 'text/plain' });
        res.end('Payload too large');
        return;
      }
    }

    const ctx = incomingHandler(req, env, logger);
    const targetUrl = new URL(req.url, env.targetUrl).href;

    try {
      const proxyRes = await proxyRequest({
        req,
        targetUrl,
        headers: req.headers,
        changeOrigin: env.changeOrigin,
        followRedirects: env.followRedirects,
      });

      backHandler(ctx, proxyRes, res, logger);
    } catch (err) {
      const status = err instanceof ProxyError ? err.statusCode : 502;
      const message = err instanceof ProxyError ? err.message : 'Bad gateway';
      logger.log(1, `[ERR] ${ctx.method} ${ctx.url} ${status} — ${message}`);
      if (!res.headersSent) {
        res.writeHead(status, { 'content-type': 'text/plain' });
        res.end(message);
      }
    }
  });

  return new Promise((resolve) => {
    server.listen(env.port, () => {
      process.stdout.write(`\n  night-worcoon cli\n`);
      process.stdout.write(`  ─────────────────\n`);
      process.stdout.write(`  env:    ${env.name} (${env.id})\n`);
      process.stdout.write(`  proxy:  http://localhost:${env.port} → ${env.targetUrl}\n`);
      process.stdout.write(`  log:    ${config.logLevel === 0 ? 'silent' : 'basic'}\n\n`);
      resolve(server);
    });
  });
}
