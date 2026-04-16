import http from 'node:http';

/**
 * Tiny HTTP client for tests. Zero dependencies.
 * Returns { statusCode, headers, body } as a promise.
 */
export function request(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
