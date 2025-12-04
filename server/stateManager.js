import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATE_FILE = join(__dirname, '..', 'state.json');

const DEFAULT_STATE = {
  proxyPort: 8079,
  plugins: {},
  pluginOrder: ['logger', 'cors', 'mock', 'recorder'],
  debugLogs: false,
  configSets: [
    {
      id: 'default',
      name: 'Default',
      targetUrl: 'http://localhost:8078',
      requestHeaders: {}
    }
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

/**
 * Load state from disk
 * @returns {object} State object
 */
export function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const data = readFileSync(STATE_FILE, 'utf8');
      let state = JSON.parse(data);
      console.log('✓ State loaded from disk');
      
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
      
      // Ensure configSets exists and has at least one entry
      if (!state.configSets || state.configSets.length === 0) {
        console.log('⚠️  No config sets found, creating default...');
        state.configSets = DEFAULT_STATE.configSets;
        state.activeConfigSet = DEFAULT_STATE.activeConfigSet;
        saveState(state);
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
    console.error('Failed to load state:', error.message);
  }
  
  console.log('Using default state');
  return { ...DEFAULT_STATE };
}

/**
 * Save state to disk
 * @param {object} state - State object to save
 */
export function saveState(state) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    console.log('✓ State saved to disk');
  } catch (error) {
    console.error('Failed to save state:', error.message);
  }
}

/**
 * Update specific state properties and save
 * @param {object} currentState - Current state object
 * @param {object} updates - Properties to update
 * @returns {object} Updated state
 */
export function updateState(currentState, updates) {
  const newState = { ...currentState, ...updates };
  saveState(newState);
  return newState;
}

/**
 * Get the currently active config set
 * @param {object} state - State object
 * @returns {object} Active config set or default
 */
export function getActiveConfigSet(state) {
  if (!state.configSets || state.configSets.length === 0) {
    return DEFAULT_STATE.configSets[0];
  }
  
  const activeSet = state.configSets.find(s => s.id === state.activeConfigSet);
  return activeSet || state.configSets[0];
}

/**
 * Get WebSocket configuration
 * @param {object} state - State object
 * @returns {object} WebSocket config
 */
export function getWebSocketConfig(state) {
  return state.websocketConfig || DEFAULT_STATE.websocketConfig;
}

/**
 * Update WebSocket configuration
 * @param {object} currentState - Current state object
 * @param {object} updates - WebSocket config updates
 * @returns {object} Updated state
 */
export function updateWebSocketConfig(currentState, updates) {
  const websocketConfig = { ...getWebSocketConfig(currentState), ...updates };
  return updateState(currentState, { websocketConfig });
}
