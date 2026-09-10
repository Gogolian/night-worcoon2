import express from 'express';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { col, isDbConnected } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const RULES_DIR = join(__dirname, '..', '..', 'rules');

const DEFAULT_RULE_SET = {
  rules: [],
  fallback: 'PASS',
  fallback_fallback: 'PASS',
  recordingsFolder: 'active'
};

function ensureRulesDir() {
  if (!existsSync(RULES_DIR)) mkdirSync(RULES_DIR, { recursive: true });
}

const router = express.Router();

export function setupRulesRoutes(pluginController, state) {

  // ── GET /active ─────────────────────────────────────────────────────────────
  router.get('/active', async (req, res) => {
    try {
      const activeRulesSet = state.activeRulesSet || 'active';

      if (isDbConnected()) {
        const doc = await col('rules').findOne({ _id: activeRulesSet });
        if (doc) {
          const { _id, ...ruleSet } = doc;
          return res.json(ruleSet);
        }
        return res.json({ ...DEFAULT_RULE_SET });
      } else {
        const filePath = join(RULES_DIR, `${activeRulesSet}.json`);
        if (existsSync(filePath)) {
          return res.json(JSON.parse(readFileSync(filePath, 'utf8')));
        }
        return res.json({ ...DEFAULT_RULE_SET });
      }
    } catch (err) {
      console.error('Error loading active rules:', err);
      res.status(500).json({ error: 'Failed to load active rules' });
    }
  });

  // ── POST /active ─────────────────────────────────────────────────────────────
  router.post('/active', async (req, res) => {
    try {
      const activeRulesSet = state.activeRulesSet || 'active';

      if (isDbConnected()) {
        await col('rules').updateOne(
          { _id: activeRulesSet },
          { $set: { ...req.body } },
          { upsert: true }
        );
        console.log(`✓ Rules saved to MongoDB (${activeRulesSet}) and applied`);
      } else {
        ensureRulesDir();
        writeFileSync(join(RULES_DIR, `${activeRulesSet}.json`), JSON.stringify(req.body, null, 2), 'utf8');
        console.log(`✓ Rules saved to ${activeRulesSet}.json and applied`);
      }

      if (pluginController) pluginController.setPluginConfig('mock', req.body);
      res.json({ success: true, message: 'Active rules saved and applied' });
    } catch (err) {
      console.error('Error saving active rules:', err);
      res.status(500).json({ error: 'Failed to save active rules' });
    }
  });

  // ── GET /sets ────────────────────────────────────────────────────────────────
  router.get('/sets', async (req, res) => {
    try {
      if (isDbConnected()) {
        const docs  = await col('rules').find({}, { projection: { _id: 1 } }).toArray();
        let names   = docs.map(d => d._id);

        if (names.length === 0) {
          await col('rules').insertOne({ _id: 'active', ...DEFAULT_RULE_SET });
          console.log(`✓ Created default 'active' rule set in MongoDB`);
          names = ['active'];
        }
        return res.json({ sets: names });
      } else {
        ensureRulesDir();
        let files = readdirSync(RULES_DIR)
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''));

        if (files.length === 0) {
          writeFileSync(join(RULES_DIR, 'active.json'), JSON.stringify(DEFAULT_RULE_SET, null, 2), 'utf8');
          console.log(`✓ Created default 'active' rule set`);
          files = ['active'];
        }
        return res.json({ sets: files });
      }
    } catch (err) {
      console.error('Error listing rule sets:', err);
      res.status(500).json({ error: 'Failed to list rule sets' });
    }
  });

  // ── GET /sets/:name ──────────────────────────────────────────────────────────
  router.get('/sets/:name', async (req, res) => {
    try {
      const { name } = req.params;

      if (isDbConnected()) {
        const doc = await col('rules').findOne({ _id: name });
        if (doc) {
          const { _id, ...ruleSet } = doc;
          return res.json(ruleSet);
        }
      } else {
        const filePath = join(RULES_DIR, `${name}.json`);
        if (existsSync(filePath)) {
          return res.json(JSON.parse(readFileSync(filePath, 'utf8')));
        }
      }
      res.status(404).json({ error: 'Rule set not found' });
    } catch (err) {
      console.error('Error loading rule set:', err);
      res.status(500).json({ error: 'Failed to load rule set' });
    }
  });

  // ── POST /sets/:name ─────────────────────────────────────────────────────────
  router.post('/sets/:name', async (req, res) => {
    try {
      const { name }        = req.params;
      const activeRulesSet  = state.activeRulesSet || 'active';

      if (isDbConnected()) {
        await col('rules').updateOne(
          { _id: name },
          { $set: { ...req.body } },
          { upsert: true }
        );
        console.log(`✓ Rules saved to MongoDB (${name})${name === activeRulesSet ? ' and applied' : ''}`);
      } else {
        ensureRulesDir();
        writeFileSync(join(RULES_DIR, `${name}.json`), JSON.stringify(req.body, null, 2), 'utf8');
        console.log(`✓ Rules saved to ${name}.json${name === activeRulesSet ? ' and applied' : ''}`);
      }

      if (name === activeRulesSet && pluginController) {
        pluginController.setPluginConfig('mock', req.body);
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
