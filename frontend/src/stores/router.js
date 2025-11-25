import { writable, derived } from 'svelte/store';
import { enabledPlugins } from './plugins.js';

export const currentRoute = writable('dashboard');

export const routes = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    path: '/dashboard',
    isPlugin: false
  },
  plugins: {
    id: 'plugins',
    label: 'Plugins',
    icon: '🔌',
    path: '/plugins',
    isPlugin: false
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    icon: '⚙️',
    path: '/settings',
    isPlugin: false
  }
};

// Plugin route icons
const pluginIcons = {
  logger: '📝',
  cors: '🌐',
  block5xx: '🛡️',
  mock: '🎭',
  recorder: '📼'
};

// Dynamically create plugin routes from enabled plugins
export const dynamicRoutes = derived(enabledPlugins, $enabledPlugins => {
  const pluginRoutes = {};
  $enabledPlugins.forEach(plugin => {
    pluginRoutes[`plugin-${plugin.name}`] = {
      id: `plugin-${plugin.name}`,
      label: plugin.name,
      icon: pluginIcons[plugin.name] || '🔧',
      path: `/plugin/${plugin.name}`,
      isPlugin: true,
      pluginName: plugin.name,
      order: plugin.order
    };
  });
  return pluginRoutes;
});

// Combined routes (static + dynamic)
export const allRoutes = derived(dynamicRoutes, $dynamicRoutes => {
  return { ...routes, ...$dynamicRoutes };
});
