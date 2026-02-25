import express from 'express';

/**
 * Mount log-query endpoints at /__api/logs
 * @param {import('../logManager.js').logManager} logManager
 */
export function setupLogsRoutes(logManager) {
  const router = express.Router();

  /**
   * GET /entries
   * Query params: url, method, status, action, limit, offset, since
   */
  router.get('/entries', (req, res) => {
    const { url, method, status, action, limit = '100', offset = '0', since } = req.query;
    const result = logManager.getEntries({
      url,
      method,
      status,
      action,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      since
    });
    res.json(result);
  });

  /**
   * GET /stats
   * Returns aggregate counts and averages.
   */
  router.get('/stats', (req, res) => {
    res.json(logManager.getStats());
  });

  /**
   * DELETE /clear
   * Truncates the in-memory buffer.
   */
  router.delete('/clear', (req, res) => {
    logManager.clearEntries();
    res.json({ success: true, message: 'Log cleared' });
  });

  return router;
}
