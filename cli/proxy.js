import http from 'node:http';
import https from 'node:https';

const MAX_REDIRECTS = 5;

/**
 * Stream-proxy a request to the target. Returns a promise that resolves
 * with the target's IncomingMessage (proxyRes) — the caller pipes it back.
 *
 * On redirect (3xx + Location header) and followRedirects=true, the redirect
 * is followed internally up to MAX_REDIRECTS. The *original* request body is
 * consumed on the first hop, so redirected requests are sent without a body
 * (matches browser behaviour for 301/302).
 */
export function proxyRequest({ req, targetUrl, headers, changeOrigin, followRedirects }) {
  return new Promise((resolve, reject) => {
    sendRequest(req, targetUrl, headers, changeOrigin, followRedirects, 0, resolve, reject);
  });
}

function sendRequest(bodySource, targetUrl, headers, changeOrigin, followRedirects, depth, resolve, reject) {
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    return reject(new ProxyError(502, `Invalid target URL: ${targetUrl}`));
  }

  const transport = target.protocol === 'https:' ? https : http;

  const outHeaders = { ...headers };

  if (changeOrigin) {
    outHeaders['host'] = target.host;
  }

  // Strip hop-by-hop headers that shouldn't be forwarded
  delete outHeaders['connection'];
  delete outHeaders['keep-alive'];
  delete outHeaders['transfer-encoding'];

  const opts = {
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    method: bodySource.method || 'GET',
    headers: outHeaders,
    rejectUnauthorized: false, // allow self-signed certs in dev
  };

  const proxyReq = transport.request(opts, (proxyRes) => {
    const status = proxyRes.statusCode;

    if (followRedirects && status >= 300 && status < 400 && proxyRes.headers.location) {
      // Consume and discard the redirect body
      proxyRes.resume();

      if (depth >= MAX_REDIRECTS) {
        return reject(new ProxyError(502, 'Too many redirects'));
      }

      let redirectUrl = proxyRes.headers.location;
      // Handle relative redirects
      if (!/^https?:\/\//i.test(redirectUrl)) {
        redirectUrl = new URL(redirectUrl, targetUrl).href;
      }

      // Redirects after POST become GET (standard browser behaviour)
      const redirectReq = {
        method: (status === 301 || status === 302) ? 'GET' : bodySource.method,
      };

      return sendRequest(redirectReq, redirectUrl, headers, changeOrigin, followRedirects, depth + 1, resolve, reject);
    }

    resolve(proxyRes);
  });

  proxyReq.on('error', (err) => {
    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      reject(new ProxyError(504, `Gateway timeout: ${err.message}`));
    } else {
      reject(new ProxyError(502, `Bad gateway: ${err.message}`));
    }
  });

  // If bodySource is a readable stream (the original req), pipe it. Otherwise end immediately.
  if (typeof bodySource.pipe === 'function') {
    bodySource.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

export class ProxyError {
  constructor(statusCode, message) {
    this.statusCode = statusCode;
    this.message = message;
  }
}
