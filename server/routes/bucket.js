import express from 'express';
import {
  storage,
  loadConfig,
  saveConfig,
  getCollection,
  scheduleSave,
  normalizePath
} from '../plugins/bucket.js';

const router = express.Router();

/**
 * Setup Bucket API routes.
 * Collections are addressed by array index in all routes that target a specific
 * collection, to avoid multi-segment URL encoding issues with paths like /api/users.
 *
 * @param {object} pluginController - Plugin controller instance
 * @returns {Router} Express router
 */
export function setupBucketRoutes(pluginController) {

  // ── Helper: read + write current config ──────────────────────────────────────
  function getConfig() {
    return loadConfig();
  }

  function updateConfig(collections) {
    saveConfig(collections);
    pluginController.setPluginConfig('bucket', { collections });
  }

  // ── Helper: resolve a collection by index param ───────────────────────────────
  function resolveCollection(indexParam) {
    const index = parseInt(indexParam, 10);
    if (isNaN(index)) return { error: 'Invalid collection index', status: 400 };
    const { collections } = getConfig();
    if (index < 0 || index >= collections.length) {
      return { error: `Collection index ${index} out of range`, status: 404 };
    }
    return { collection: collections[index], index, collections };
  }

  // ── Collections CRUD ──────────────────────────────────────────────────────────

  /**
   * GET /__api/bucket/collections
   * Returns the list of configured collections with their current resource counts.
   */
  router.get('/collections', (req, res) => {
    try {
      const { collections } = getConfig();
      const withCounts = collections.map((col) => {
        const key = normalizePath(col.path);
        const count = storage.has(key) ? storage.get(key).size : 0;
        return { ...col, resourceCount: count };
      });
      res.json({ collections: withCounts });
    } catch (err) {
      console.error('Bucket: Error listing collections:', err.message);
      res.status(500).json({ error: 'Failed to list collections' });
    }
  });

  /**
   * POST /__api/bucket/collections
   * Body: { path: string, idPattern: string }
   * Adds a new collection.
   */
  router.post('/collections', (req, res) => {
    try {
      const { path, idPattern = 'uuid', idLength, responseTemplate } = req.body || {};
      if (!path || typeof path !== 'string' || !path.trim()) {
        return res.status(400).json({ error: '"path" is required and must be a non-empty string' });
      }
      const normalizedPath = normalizePath(path.trim());
      const { collections } = getConfig();

      // Reject duplicate paths
      const duplicate = collections.some(c => normalizePath(c.path) === normalizedPath);
      if (duplicate) {
        return res.status(409).json({ error: `Collection with path "${normalizedPath}" already exists` });
      }

      const newCollection = { path: normalizedPath, idPattern };
      if (idLength != null && Number(idLength) > 0) newCollection.idLength = Number(idLength);
      if (responseTemplate != null) {
        if (typeof responseTemplate !== 'object' || Array.isArray(responseTemplate)) {
          return res.status(400).json({ error: 'responseTemplate must be a JSON object' });
        }
        newCollection.responseTemplate = responseTemplate;
      }
      const updated = [...collections, newCollection];
      updateConfig(updated);
      console.log(`🪣 Bucket: Added collection "${normalizedPath}" (idPattern: ${idPattern}${newCollection.idLength ? `, idLength: ${newCollection.idLength}` : ''})`);
      res.status(201).json({ success: true, collection: newCollection, index: updated.length - 1 });
    } catch (err) {
      console.error('Bucket: Error adding collection:', err.message);
      res.status(500).json({ error: 'Failed to add collection' });
    }
  });

  /**
   * PATCH /__api/bucket/collections/:index
   * Body: { path?: string, idPattern?: string }
   * Updates an existing collection's path and/or idPattern.
   */
  router.patch('/collections/:index', (req, res) => {
    try {
      const resolved = resolveCollection(req.params.index);
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

      const { collection, index, collections } = resolved;
      const { path: newPath, idPattern: newIdPattern, idLength: newIdLength, responseTemplate: newResponseTemplate } = req.body || {};

      let updatedPath = collection.path;
      if (newPath !== undefined) {
        if (typeof newPath !== 'string') {
          return res.status(400).json({ error: 'Path must be a string' });
        }
        const normalizedNew = normalizePath(newPath.trim());
        // Reject duplicate (excluding self)
        const duplicate = collections.some((c, i) => i !== index && normalizePath(c.path) === normalizedNew);
        if (duplicate) {
          return res.status(409).json({ error: `Collection with path "${normalizedNew}" already exists` });
        }
        updatedPath = normalizedNew;
      }

      // Migrate storage if path changed
      const oldKey = normalizePath(collection.path);
      const newKey = normalizePath(updatedPath);
      if (oldKey !== newKey && storage.has(oldKey)) {
        storage.set(newKey, storage.get(oldKey));
        storage.delete(oldKey);
        scheduleSave();
      }

      const updated = [...collections];
      updated[index] = {
        path: updatedPath,
        idPattern: newIdPattern !== undefined ? newIdPattern : collection.idPattern
      };
      // Carry over or update idLength — send null/0 to clear it
      if (newIdLength !== undefined) {
        if (newIdLength !== null && Number(newIdLength) > 0) {
          updated[index].idLength = Number(newIdLength);
        }
        // else: don't set — effectively clears any existing idLength
      } else if (collection.idLength !== undefined) {
        updated[index].idLength = collection.idLength;
      }
      // Carry over or update responseTemplate — send null to clear it
      if ('responseTemplate' in (req.body || {})) {
        if (newResponseTemplate !== null && newResponseTemplate !== undefined) {
          if (typeof newResponseTemplate === 'object' && !Array.isArray(newResponseTemplate)) {
            updated[index].responseTemplate = newResponseTemplate;
          }
          // else ignore invalid value
        }
        // null/undefined in body = clear the template (don't set it)
      } else if (collection.responseTemplate !== undefined) {
        updated[index].responseTemplate = collection.responseTemplate;
      }
      updateConfig(updated);
      console.log(`🪣 Bucket: Updated collection[${index}]${oldKey !== newKey ? ` (renamed "${oldKey}" → "${newKey}")` : ''}`);
      res.json({ success: true, collection: updated[index] });
    } catch (err) {
      console.error('Bucket: Error updating collection:', err.message);
      res.status(500).json({ error: 'Failed to update collection' });
    }
  });

  /**
   * DELETE /__api/bucket/collections/:index
   * Removes a collection and its stored data.
   */
  router.delete('/collections/:index', (req, res) => {
    try {
      const resolved = resolveCollection(req.params.index);
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

      const { collection, index, collections } = resolved;
      const key = normalizePath(collection.path);

      // Remove from storage too
      storage.delete(key);
      scheduleSave();

      const updated = collections.filter((_, i) => i !== index);
      updateConfig(updated);
      console.log(`🪣 Bucket: Removed collection "${key}"`);
      res.json({ success: true });
    } catch (err) {
      console.error('Bucket: Error removing collection:', err.message);
      res.status(500).json({ error: 'Failed to remove collection' });
    }
  });

  // ── Data viewer / manual management ──────────────────────────────────────────

  /**
   * GET /__api/bucket/data
   * Returns all stored data across all collections, keyed by collection path.
   */
  router.get('/data', (req, res) => {
    try {
      const { collections } = getConfig();
      const result = {};
      for (const col of collections) {
        const key = normalizePath(col.path);
        result[key] = storage.has(key) ? Array.from(storage.get(key).values()) : [];
      }
      res.json(result);
    } catch (err) {
      console.error('Bucket: Error reading data:', err.message);
      res.status(500).json({ error: 'Failed to read bucket data' });
    }
  });

  /**
   * GET /__api/bucket/data/:collectionIndex
   * Returns all resources for a specific collection (addressed by index).
   */
  router.get('/data/:collectionIndex', (req, res) => {
    try {
      const resolved = resolveCollection(req.params.collectionIndex);
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

      const key = normalizePath(resolved.collection.path);
      const items = storage.has(key) ? Array.from(storage.get(key).values()) : [];
      res.json({ collection: resolved.collection, items });
    } catch (err) {
      console.error('Bucket: Error reading collection data:', err.message);
      res.status(500).json({ error: 'Failed to read collection data' });
    }
  });

  /**
   * DELETE /__api/bucket/data
   * Clears all data from all collections (config/collections list remains intact).
   */
  router.delete('/data', (req, res) => {
    try {
      storage.clear();
      scheduleSave();
      console.log('🪣 Bucket: Cleared all data');
      res.json({ success: true });
    } catch (err) {
      console.error('Bucket: Error clearing data:', err.message);
      res.status(500).json({ error: 'Failed to clear bucket data' });
    }
  });

  /**
   * DELETE /__api/bucket/data/:collectionIndex
   * Clears all resources in a specific collection.
   */
  router.delete('/data/:collectionIndex', (req, res) => {
    try {
      // Guard: ensure no second segment (which would be a resource ID delete)
      // Express will not reach this handler if the path has a second segment because
      // the more specific route below takes precedence — but we validate anyway.
      const resolved = resolveCollection(req.params.collectionIndex);
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

      const key = normalizePath(resolved.collection.path);
      if (storage.has(key)) {
        storage.get(key).clear();
        scheduleSave();
      }
      console.log(`🪣 Bucket: Cleared collection "${key}"`);
      res.json({ success: true });
    } catch (err) {
      console.error('Bucket: Error clearing collection:', err.message);
      res.status(500).json({ error: 'Failed to clear collection' });
    }
  });

  /**
   * PUT /__api/bucket/data/:collectionIndex/:id
   * Manually overwrite a resource from the UI.
   * Body: the full resource object (id field will be forced to the URL :id).
   */
  router.put('/data/:collectionIndex/:id', (req, res) => {
    try {
      const resolved = resolveCollection(req.params.collectionIndex);
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

      const { id } = req.params;
      const key = normalizePath(resolved.collection.path);
      const items = getCollection(key);

      // URL id is always authoritative
      const resource = { ...req.body, id };
      items.set(id, resource);
      scheduleSave();

      console.log(`🪣 Bucket: Manually set resource "${id}" in "${key}"`);
      res.json({ success: true, resource });
    } catch (err) {
      console.error('Bucket: Error updating resource:', err.message);
      res.status(500).json({ error: 'Failed to update resource' });
    }
  });

  /**
   * DELETE /__api/bucket/data/:collectionIndex/:id
   * Manually remove a specific resource from the UI.
   */
  router.delete('/data/:collectionIndex/:id', (req, res) => {
    try {
      const resolved = resolveCollection(req.params.collectionIndex);
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

      const { id } = req.params;
      const key = normalizePath(resolved.collection.path);

      if (!storage.has(key) || !storage.get(key).has(id)) {
        return res.status(404).json({ error: `Resource "${id}" not found in collection "${key}"` });
      }

      storage.get(key).delete(id);
      scheduleSave();

      console.log(`🪣 Bucket: Manually deleted resource "${id}" from "${key}"`);
      res.json({ success: true });
    } catch (err) {
      console.error('Bucket: Error deleting resource:', err.message);
      res.status(500).json({ error: 'Failed to delete resource' });
    }
  });

  return router;
}

export default setupBucketRoutes;
