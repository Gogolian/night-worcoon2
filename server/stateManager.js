import { col } from './db.js';

const DEFAULT_CONFIG_SET = {
  id: 'default',
  name: 'Default',
  targetUrl: 'http://localhost:8078',
  requestHeaders: {},
  changeOrigin: true,
  followRedirects: true
};

const DEFAULT_STATE = {
  proxyPort: 8079,
  plugins: {},
  pluginOrder: ['logger', 'cors', 'bucket', 'mock', 'recorder'],
  debugLogs: false,
  configSets: [
    DEFAULT_CONFIG_SET
  ],
  activeConfigSet: 'default',
  activeRulesSet: 'active',
  websocketConfig: {
    enabled: false,
    logMessages: true,
    recordMessages: false,
    maxConnections: 100,
    maxMessageSize: 1048576,
    modificationRules: []
  }
};

export async function loadState() {
  try {
    const doc = await col('app_state').findOne({ _id: 'state' });
    if (doc) {
      const { _id, ...state } = doc;
      console.log('✓ State loaded from MongoDB');

      // Migration: Remove old root-level targetUrl and requestHeaders if they exist
      if (state.targetUrl !== undefined || state.requestHeaders !== undefined) {
        console.log('⚠️  Migrating old state format...');
        delete state.targetUrl;
        delete state.requestHeaders;
        saveState(state);
        console.log('✓ State migrated to new format');
      }

      // Migration: Remove pluginConfigs and add activeRulesSet
      if (state.pluginConfigs !== undefined) {
        console.log('⚠️  Migrating plugin configs to separate files...');
        delete state.pluginConfigs;
        if (!state.activeRulesSet) {
          state.activeRulesSet = 'active';
        }
        saveState(state);
        console.log('✓ Plugin configs migrated');
      }

      // Migration: Insert 'bucket' before 'mock' in pluginOrder if missing
      if (state.pluginOrder && Array.isArray(state.pluginOrder) && !state.pluginOrder.includes('bucket')) {
        console.log('⚠️  Migrating pluginOrder: inserting bucket before mock...');
        const mockIdx = state.pluginOrder.indexOf('mock');
        if (mockIdx !== -1) {
          state.pluginOrder.splice(mockIdx, 0, 'bucket');
        } else {
          state.pluginOrder.push('bucket');
        }
        saveState(state);
        console.log('✓ pluginOrder migrated:', state.pluginOrder.join(' → '));
      }

      // Ensure configSets exists and has at least one entry
      if (!state.configSets || state.configSets.length === 0) {
        console.log('⚠️  No config sets found, creating default...');
        state.configSets = DEFAULT_STATE.configSets;
        state.activeConfigSet = DEFAULT_STATE.activeConfigSet;
        saveState(state);
      }

      // Migration: ensure proxy behavior flags exist on every config set
      let configSetsMigrated = false;
      state.configSets = state.configSets.map((set) => {
        const normalizedSet = {
          ...DEFAULT_CONFIG_SET,
          ...set,
          requestHeaders: set.requestHeaders || {}
        };
        if (normalizedSet.changeOrigin !== set.changeOrigin || normalizedSet.followRedirects !== set.followRedirects) {
          configSetsMigrated = true;
        }
        return normalizedSet;
      });
      if (configSetsMigrated) {
        console.log('⚠️  Migrating config sets: adding proxy behavior defaults...');
        saveState(state);
        console.log('✓ Config sets migrated');
      }

      // Ensure activeConfigSet is valid
      if (!state.activeConfigSet || !state.configSets.find(s => s.id === state.activeConfigSet)) {
        console.log('⚠️  Invalid active config set, using first available...');
        state.activeConfigSet = state.configSets[0].id;
        saveState(state);
      }

      return { ...DEFAULT_STATE, ...state };
    }
  } catch (error) {
    console.error('Failed to load state from MongoDB:', error.message);
  }

  console.log('Using default state');
  const defaultState = { ...DEFAULT_STATE };
  saveState(defaultState);
  return defaultState;
}

export function saveState(state) {
  const { _id, ...stateData } = state;
  col('app_state')
    .updateOne(
      { _id: 'state' },
      { $set: stateData },
      { upsert: true }
    )
    .catch(err => console.error('Failed to save state to MongoDB:', err.message));
}

export function updateState(currentState, updates) {
  const newState = { ...currentState, ...updates };
  saveState(newState);
  return newState;
}

export function getActiveConfigSet(state) {
  if (!state.configSets || state.configSets.length === 0) {
    return { ...DEFAULT_CONFIG_SET };
  }
  const activeSet = state.configSets.find(s => s.id === state.activeConfigSet);
  return { ...DEFAULT_CONFIG_SET, ...(activeSet || state.configSets[0]), requestHeaders: (activeSet || state.configSets[0])?.requestHeaders || {} };
}

export function getWebSocketConfig(state) {
  return state.websocketConfig || DEFAULT_STATE.websocketConfig;
}

export function updateWebSocketConfig(currentState, updates) {
  const websocketConfig = { ...getWebSocketConfig(currentState), ...updates };
  return updateState(currentState, { websocketConfig });
}
