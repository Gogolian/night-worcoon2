import express from 'express';
import { col } from '../db.js';

const router = express.Router();

const DEFAULT_RULE_SET = {
  rules: [],
  fallback: 'PASS',
  fallback_fallback: 'PASS',
  recordingsFolder: 'active'
};

export function setupRulesRoutes(pluginController, state) {
  // Get active rule set
  router.get('/active', async (req, res) => {
    try {
      const activeRulesSet = state.activeRulesSet || 'active';
      const doc = await col('rules').findOne({ _id: activeRulesSet });
      if (doc) {
        const { _id, ...ruleSet } = doc;
        res.json(ruleSet);
      } else {
        res.json({ ...DEFAULT_RULE_SET });
      }
    } catch (err) {
      console.error('Error loading active rules:', err);
      res.status(500).json({ error: 'Failed to load active rules' });
    }
  });

  // Save active rule set
  router.post('/active', async (req, res) => {
    try {
      const activeRulesSet = state.activeRulesSet || 'active';
      await col('rules').updateOne(
        { _id: activeRulesSet },
        { $set: { ...req.body } },
        { upsert: true }
      );
      if (pluginController) {
        pluginController.setPluginConfig('mock', req.body);
      }
      console.log(`✓ Rules saved to MongoDB (${activeRulesSet}) and applied`);
      res.json({ success: true, message: 'Active rules saved and applied' });
    } catch (err) {
      console.error('Error saving active rules:', err);
      res.status(500).json({ error: 'Failed to save active rules' });
    }
  });

  // Get list of all saved rule sets
  router.get('/sets', async (req, res) => {
    try {
      const docs = await col('rules').find({}, { projection: { _id: 1 } }).toArray();
      let names = docs.map(d => d._id);

      if (names.length === 0) {
        await col('rules').insertOne({ _id: 'active', ...DEFAULT_RULE_SET });
        console.log(`✓ Created default 'active' rule set in MongoDB`);
        names = ['active'];
      }

      res.json({ sets: names });
    } catch (err) {
      console.error('Error listing rule sets:', err);
      res.status(500).json({ error: 'Failed to list rule sets' });
    }
  });

  // Get specific rule set
  router.get('/sets/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const doc = await col('rules').findOne({ _id: name });
      if (doc) {
        const { _id, ...ruleSet } = doc;
        res.json(ruleSet);
      } else {
        res.status(404).json({ error: 'Rule set not found' });
      }
    } catch (err) {
      console.error('Error loading rule set:', err);
      res.status(500).json({ error: 'Failed to load rule set' });
    }
  });

  // Save rule set with custom name
  router.post('/sets/:name', async (req, res) => {
    try {
      const { name } = req.params;
      await col('rules').updateOne(
        { _id: name },
        { $set: { ...req.body } },
        { upsert: true }
      );

      const activeRulesSet = state.activeRulesSet || 'active';
      if (name === activeRulesSet && pluginController) {
        pluginController.setPluginConfig('mock', req.body);
        console.log(`✓ Rules saved to MongoDB (${name}) and applied`);
      } else {
        console.log(`✓ Rules saved to MongoDB (${name})`);
      }

      res.json({ success: true, message: `Rule set "${name}" saved` });
    } catch (err) {
      console.error('Error saving rule set:', err);
      res.status(500).json({ error: 'Failed to save rule set' });
    }
  });

  return router;
}

export default setupRulesRoutes;
