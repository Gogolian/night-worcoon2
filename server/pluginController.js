import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Plugin controller manages plugins and their execution
// Plugins can inspect requests and decide whether to proxy, mock, or modify

class PluginController {
  constructor() {
    this.plugins = [];
    this.enabledPlugins = new Map();
    this.pluginConfigs = new Map(); // Store plugin configurations
    this.pluginOrder = []; // Will be set from state
  }

  /**
   * Set plugin execution order
   * @param {Array} orderArray - Array of plugin names in execution order
   */
  setPluginOrder(orderArray) {
    this.pluginOrder = orderArray || [];
  }

  /**
   * Register a plugin
   * @param {Object} plugin - Plugin object with name, enabled state, and handler
   */
  registerPlugin(plugin) {
    if (!plugin.name || !plugin.handler) {
      throw new Error('Plugin must have name and handler');
    }
    
    this.plugins.push(plugin);
    this.enabledPlugins.set(plugin.name, plugin.enabled !== false);
    
    console.log(`Plugin registered: ${plugin.name} (${plugin.enabled !== false ? 'enabled' : 'disabled'})`);
  }

  /**
   * Enable or disable a plugin
   * @param {string} name - Plugin name
   * @param {boolean} enabled - Enable state
   */
  setPluginEnabled(name, enabled) {
    this.enabledPlugins.set(name, enabled);
    console.log(`Plugin ${name} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update plugin configuration dynamically
   * @param {string} name - Plugin name
   * @param {Object} config - Configuration object
   */
  setPluginConfig(name, config) {
    this.pluginConfigs.set(name, config);
    console.log(`Plugin ${name} configuration updated`);
  }

  /**
   * Get plugin configuration
   * @param {string} name - Plugin name
   * @returns {Object} Configuration object
   */
  getPluginConfig(name) {
    return this.pluginConfigs.get(name) || {};
  }

  /**
   * Process request through all enabled plugins in order
   * @param {Object} context - Request context
   * @returns {Object} Decision object
   */
  async processRequest(context) {
    const { req, requestBody, config } = context;
    
    let decision = {
      action: 'proxy', // default: proxy the request
      modifyRequest: null,
      modifyResponse: null,
      mock: null,
      metadata: {}
    };

    // Sort plugins by execution order
    const sortedPlugins = [...this.plugins].sort((a, b) => {
      const orderA = this.pluginOrder.indexOf(a.name);
      const orderB = this.pluginOrder.indexOf(b.name);
      if (orderA >= 0 && orderB >= 0) return orderA - orderB;
      if (orderA >= 0) return -1;
      if (orderB >= 0) return 1;
      return 0;
    });

    // Execute enabled plugins in order
    for (const plugin of sortedPlugins) {
      if (!this.enabledPlugins.get(plugin.name)) {
        continue;
      }

      try {
        // Get plugin-specific config from storage
        const pluginConfig = this.getPluginConfig(plugin.name);
        
        const pluginResult = await plugin.handler({
          req,
          requestBody,
          config: pluginConfig, // Pass plugin-specific config
          decision // pass current decision so plugin can see what previous plugins decided
        });

        if (pluginResult) {
          // Merge plugin result into decision
          if (pluginResult.action) decision.action = pluginResult.action;
          if (pluginResult.modifyRequest) decision.modifyRequest = pluginResult.modifyRequest;
          if (pluginResult.modifyResponse) decision.modifyResponse = pluginResult.modifyResponse;
          if (pluginResult.mock) decision.mock = pluginResult.mock;
          if (pluginResult.metadata) decision.metadata = { ...decision.metadata, ...pluginResult.metadata };

          // If plugin says to stop processing, break
          if (pluginResult.stopProcessing) {
            decision.metadata.stoppedBy = plugin.name;
            break;
          }
        }
      } catch (error) {
        console.error(`Plugin ${plugin.name} error:`, error.message);
        decision.metadata.errors = decision.metadata.errors || [];
        decision.metadata.errors.push({ plugin: plugin.name, error: error.message });
      }
    }

    return decision;
  }

  /**
   * Process WebSocket upgrade request through plugins
   * @param {Object} context - Upgrade context
   * @returns {Object} Decision object
   */
  async processWebSocketUpgrade(context) {
    const { req, config } = context;
    
    let decision = {
      action: 'proxy', // default: proxy the WebSocket
      websocketConfig: {},
      metadata: {}
    };

    // Sort plugins by execution order
    const sortedPlugins = [...this.plugins].sort((a, b) => {
      const orderA = this.pluginOrder.indexOf(a.name);
      const orderB = this.pluginOrder.indexOf(b.name);
      if (orderA >= 0 && orderB >= 0) return orderA - orderB;
      if (orderA >= 0) return -1;
      if (orderB >= 0) return 1;
      return 0;
    });

    // Execute enabled plugins
    for (const plugin of sortedPlugins) {
      if (!this.enabledPlugins.get(plugin.name)) {
        continue;
      }

      try {
        const pluginConfig = this.getPluginConfig(plugin.name);
        const result = await plugin.handler({
          req,
          requestBody: null,
          config: pluginConfig,
          decision: { ...decision }
        });

        if (result) {
          decision = { ...decision, ...result };
          
          if (result.stopProcessing) {
            break;
          }
        }
      } catch (error) {
        console.error(`Error in plugin ${plugin.name}:`, error.message);
      }
    }

    return decision;
  }

  /**
   * Process WebSocket message through plugins
   * @param {Object} context - Message context
   * @returns {Object} Decision object with message modifications
   */
  async processWebSocketMessage(context) {
    const { direction, message, connectionId, config } = context;
    
    let decision = {
      action: 'forward', // default: forward the message
      modifiedMessage: message,
      metadata: {}
    };

    // Sort plugins by execution order
    const sortedPlugins = [...this.plugins].sort((a, b) => {
      const orderA = this.pluginOrder.indexOf(a.name);
      const orderB = this.pluginOrder.indexOf(b.name);
      if (orderA >= 0 && orderB >= 0) return orderA - orderB;
      if (orderA >= 0) return -1;
      if (orderB >= 0) return 1;
      return 0;
    });

    // Execute enabled plugins
    for (const plugin of sortedPlugins) {
      if (!this.enabledPlugins.get(plugin.name)) {
        continue;
      }

      try {
        const pluginConfig = this.getPluginConfig(plugin.name);
        
        // Check if plugin has WebSocket message handler
        if (plugin.handleWebSocketMessage) {
          const result = await plugin.handleWebSocketMessage({
            direction,
            message: decision.modifiedMessage,
            connectionId,
            config: pluginConfig,
            decision: { ...decision }
          });

          if (result) {
            decision = { ...decision, ...result };
            
            if (result.stopProcessing || result.action === 'block') {
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error in plugin ${plugin.name} WebSocket handler:`, error.message);
      }
    }

    return decision;
  }

  /**
   * Get list of all plugins with their states
   * @returns {Array} Array of plugin info
   */
  getPluginsInfo() {
    // Sort by pluginOrder array, fallback to registration order
    const sortedPlugins = [...this.plugins].sort((a, b) => {
      const orderA = this.pluginOrder.indexOf(a.name);
      const orderB = this.pluginOrder.indexOf(b.name);
      
      // If both in order array, sort by position
      if (orderA >= 0 && orderB >= 0) return orderA - orderB;
      // If only A in order, A comes first
      if (orderA >= 0) return -1;
      // If only B in order, B comes first
      if (orderB >= 0) return 1;
      // Neither in order, maintain registration order
      return 0;
    });

    return sortedPlugins.map((p, index) => ({
      name: p.name,
      enabled: this.enabledPlugins.get(p.name),
      description: p.description || '',
      order: index + 1, // Sequential order based on sorted position
      options: p.options || {}
    }));
  }

  /**
   * Load plugins from the plugins folder
   * @returns {Promise<void>}
   */
  async loadPlugins() {
    const pluginsDir = join(__dirname, 'plugins');
    
    try {
      const files = readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
      
      for (const file of files) {
        try {
          const pluginPath = join(pluginsDir, file);
          const plugin = await import(`file://${pluginPath}`);
          
          if (plugin.default) {
            this.registerPlugin(plugin.default);
            console.log(`✓ Loaded plugin: ${plugin.default.name}`);
          }
        } catch (error) {
          console.error(`Failed to load plugin ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Failed to read plugins directory:', error.message);
    }
  }
}

// Create and configure the plugin controller
export const pluginController = new PluginController();

// Load plugins from the plugins folder
await pluginController.loadPlugins();

export default pluginController;
