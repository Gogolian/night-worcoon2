import express from 'express';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const RULES_DIR = join(__dirname, '..', '..', 'rules');

// Ensure rules directory exists
if (!existsSync(RULES_DIR)) {
  mkdirSync(RULES_DIR, { recursive: true });
}

/**
 * Setup rules API routes
 * @param {Object} pluginController - Plugin controller instance
 * @param {Object} state - Server state object
 * @returns {Router} Express router
 */
export function setupRulesRoutes(pluginController, state) {
  // Get active rule set
  router.get('/active', (req, res) => {
    try {
      const activePath = join(RULES_DIR, 'active.json');
      if (existsSync(activePath)) {
        const data = readFileSync(activePath, 'utf8');
        res.json(JSON.parse(data));
      } else {
        // Return default empty rule set
        res.json({ rules: [], fallback: 'PASS', fallback_fallback: 'PASS', recordingsFolder: 'active' });
      }
    } catch (err) {
      console.error('Error loading active rules:', err);
      res.status(500).json({ error: 'Failed to load active rules' });
    }
  });

  // Save active rule set
  router.post('/active', async (req, res) => {
    try {
      const activePath = join(RULES_DIR, 'active.json');
      writeFileSync(activePath, JSON.stringify(req.body, null, 2), 'utf8');
      
      // Update plugin controller configuration dynamically
      if (pluginController) {
        pluginController.setPluginConfig('mock', req.body);
      }
      
      // Update state and save to disk
      if (state) {
        if (!state.pluginConfigs) state.pluginConfigs = {};
        state.pluginConfigs.mock = req.body;
        
        // Import saveState dynamically to avoid circular dependencies
        const { saveState } = await import('../stateManager.js');
        saveState(state);
      }
      
      console.log('✓ Mock plugin configuration updated (no restart needed)');
      res.json({ success: true, message: 'Active rules saved and applied' });
    } catch (err) {
      console.error('Error saving active rules:', err);
      res.status(500).json({ error: 'Failed to save active rules' });
    }
  });

  // Get list of all saved rule sets
  router.get('/sets', (req, res) => {
    try {
      const files = readdirSync(RULES_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      res.json({ sets: files });
    } catch (err) {
      console.error('Error listing rule sets:', err);
      res.status(500).json({ error: 'Failed to list rule sets' });
    }
  });

  // Get specific rule set
  router.get('/sets/:name', (req, res) => {
    try {
      const { name } = req.params;
      const filePath = join(RULES_DIR, `${name}.json`);
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
      } else {
        res.status(404).json({ error: 'Rule set not found' });
      }
    } catch (err) {
      console.error('Error loading rule set:', err);
      res.status(500).json({ error: 'Failed to load rule set' });
    }
  });

  // Save rule set with custom name
  router.post('/sets/:name', (req, res) => {
    try {
      const { name } = req.params;
      if (name === 'active') {
        return res.status(400).json({ error: 'Cannot use "active" as a custom name' });
      }
      const filePath = join(RULES_DIR, `${name}.json`);
      writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
      res.json({ success: true, message: `Rule set "${name}" saved` });
    } catch (err) {
      console.error('Error saving rule set:', err);
      res.status(500).json({ error: 'Failed to save rule set' });
    }
  });

  return router;
}

export default setupRulesRoutes;
