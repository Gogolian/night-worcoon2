import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATE_FILE = join(__dirname, '..', 'state.json');

const DEFAULT_STATE = {
  proxyPort: 8079,
  targetUrl: 'http://localhost:8078',
  block5xxResponses: false,
  requestHeaders: {},
  plugins: {},
  pluginOrder: ['logger', 'cors', 'block5xx', 'mock', 'recorder'],
  debugLogs: false,
  configSets: [
    {
      id: 'default',
      name: 'Default',
      targetUrl: 'http://localhost:8078',
      requestHeaders: {}
    }
  ],
  activeConfigSet: 'default'
};

/**
 * Load state from disk
 * @returns {object} State object
 */
export function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const data = readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      console.log('✓ State loaded from disk');
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
