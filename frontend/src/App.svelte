<script>
  import { onMount } from 'svelte';
  import Header from './components/organisms/Header.svelte';
  import Sidebar from './components/organisms/Sidebar.svelte';
  import MainContent from './components/organisms/MainContent.svelte';
  import Toast from './components/molecules/Toast.svelte';
  import Dashboard from './views/Dashboard.svelte';
  import Recordings from './views/Recordings.svelte';
  import Plugins from './views/Plugins.svelte';
  import Settings from './views/Settings.svelte';
  import LoggerPlugin from './views/plugins/LoggerPlugin.svelte';
  import CorsPlugin from './views/plugins/CorsPlugin.svelte';
  import MockPlugin from './views/plugins/MockPlugin.svelte';
  import RecorderPlugin from './views/plugins/RecorderPlugin.svelte';
  import { currentRoute, routes, allRoutes } from './stores/router.js';
  import { fetchPlugins } from './stores/plugins.js';

  onMount(() => {
    fetchPlugins();
  });

  // Map plugin names to their components
  const pluginComponents = {
    logger: LoggerPlugin,
    cors: CorsPlugin,
    mock: MockPlugin,
    recorder: RecorderPlugin
  };

  $: sidebarItems = [
    { ...routes.dashboard, active: routes.dashboard.id === $currentRoute },
    { ...routes.recordings, active: routes.recordings.id === $currentRoute },
    { ...routes.plugins, active: routes.plugins.id === $currentRoute },
    // Add all plugins under Plugins section (enabled and disabled)
    ...Object.values($allRoutes)
      .filter(route => route.isPlugin)
      .map(route => {
        // Find the plugin order from the plugins store
        const plugin = $allRoutes[route.id];
        const order = plugin?.order || '';
        return {
          ...route,
          label: order ? `${order}. ${route.label}` : route.label,
          active: route.id === $currentRoute,
          enabled: plugin?.enabled ?? true
        };
      }),
    { ...routes.settings, active: routes.settings.id === $currentRoute }
  ];

  function handleSidebarClick(routeId) {
    currentRoute.set(routeId);
  }

  $: currentView = (() => {
    switch ($currentRoute) {
      case 'dashboard':
        return Dashboard;
      case 'recordings':
        return Recordings;
      case 'plugins':
        return Plugins;
      case 'settings':
        return Settings;
      default:
        // Check if it's a plugin route
        const route = $allRoutes[$currentRoute];
        if (route && route.isPlugin) {
          return pluginComponents[route.pluginName] || Dashboard;
        }
        return Dashboard;
    }
  })();

  function getPageTitle() {
    const route = $allRoutes[$currentRoute];
    return route ? route.label : 'Dashboard';
  }
</script>

<div class="app-layout">
  <Header currentRoute={$currentRoute} />
  <div class="main-layout">
    <Sidebar items={sidebarItems} onItemClick={handleSidebarClick} />
    <MainContent>
      <svelte:component this={currentView} />
    </MainContent>
  </div>
</div>

<Toast />

<style global>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    z-index: 1;
        -webkit-filter: drop-shadow(0 0 5px  rgba(217,46,255,0.05));
         filter: drop-shadow(0 0 5px  rgba(217,46,255,0.05));
  }

  :global(html, body) {
    width: 100%;
    height: 100%;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #0a0e27;
    color: #e0e0e0;
    font-size: 13px;
    line-height: 1.4;
  }

  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background-color: #0a0e27;
  }

  .main-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    z-index: 0;
  }

  /* Scrollbar styling */
  :global(::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }

  :global(::-webkit-scrollbar-track) {
    background: #0f1535;
  }

  :global(::-webkit-scrollbar-thumb) {
    background: #3a4558;
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: #4a5568;
  }
</style>
