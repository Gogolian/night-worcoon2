import { writable, derived } from 'svelte/store';
import { plugins } from './plugins.js';

export const currentRoute = writable('dashboard');

export const routes = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    path: '/dashboard',
    isPlugin: false
  },
  logs: {
    id: 'logs',
    label: 'Logs',
    icon: '📋',
    path: '/logs',
    isPlugin: false
  },
  post: {
    id: 'post',
    label: 'POST',
    icon: '📬',
    path: '/post',
    isPlugin: false
  },
  recordings: {
    id: 'recordings',
    label: 'Recordings',
    icon: '📼',
    path: '/recordings',
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
  mock: '🎭',
  recorder: '📼',
  bucket: '🪣'
};

// Dynamically create plugin routes from all plugins (enabled and disabled)
export const dynamicRoutes = derived(plugins, $plugins => {
  const pluginRoutes = {};
  $plugins.forEach(plugin => {
    pluginRoutes[`plugin-${plugin.name}`] = {
      id: `plugin-${plugin.name}`,
      label: plugin.name,
      icon: pluginIcons[plugin.name] || '🔧',
      path: `/plugin/${plugin.name}`,
      isPlugin: true,
      pluginName: plugin.name,
      order: plugin.order,
      enabled: plugin.enabled
    };
  });
  return pluginRoutes;
});

// Combined routes (static + dynamic)
export const allRoutes = derived(dynamicRoutes, $dynamicRoutes => {
  return { ...routes, ...$dynamicRoutes };
});
