import { formatTime } from './logger.js';

/**
 * Pre-proxy handler. Enriches the request with config headers,
 * logs the incoming request, and returns a context object carried
 * through the pipeline.
 *
 * Future: plugin hooks (auth, mock, rewrite) will live here.
 */
export function incomingHandler(req, env, logger) {
  const ctx = {
    method: req.method,
    url: req.url,
    startTime: Date.now(),
  };

  // Merge environment-level headers onto the request
  const envHeaders = env.requestHeaders;
  if (envHeaders) {
    for (const key in envHeaders) {
      req.headers[key.toLowerCase()] = envHeaders[key];
    }
  }

  logger.log(1, `[${formatTime()}] → ${ctx.method} ${ctx.url}`);

  return ctx;
}

/**
 * Post-proxy handler. Logs the result and pipes the proxy response
 * back to the client.
 *
 * Future: response-modification plugins (CORS injection, recording,
 * body transforms) will hook in here.
 */
export function backHandler(ctx, proxyRes, res, logger) {
  const duration = Date.now() - ctx.startTime;
  logger.log(1, `[${formatTime()}] ← ${ctx.method} ${ctx.url} ${proxyRes.statusCode} (${duration}ms)`);

  res.writeHead(proxyRes.statusCode, proxyRes.headers);
  proxyRes.pipe(res);
}
