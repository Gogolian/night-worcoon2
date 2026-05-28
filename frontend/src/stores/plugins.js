import { writable, derived } from "svelte/store";
import { apiFetch, parseJsonResponse } from "../lib/api.js";

export const plugins = writable([]);

// Derived store for enabled plugins only
export const enabledPlugins = derived(plugins, ($plugins) =>
  $plugins.filter((p) => p.enabled),
);

export async function fetchPlugins() {
  try {
    const response = await apiFetch("/__api/plugins");
    const data = (await parseJsonResponse(response, "Loading plugins")) || {};

    if (!response.ok) {
      throw new Error(
        data.error || `Failed to load plugins (${response.status})`,
      );
    }

    plugins.set(data.plugins || []);
  } catch (err) {
    console.error("Failed to fetch plugins:", err);
    plugins.set([]);
  }
}

export async function togglePlugin(pluginName, enabled) {
  try {
    const response = await apiFetch(`/__api/plugins/${pluginName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });

    if (response.ok) {
      // Refresh plugins list
      await fetchPlugins();
    } else {
      console.error("Failed to toggle plugin:", await response.text());
    }
  } catch (err) {
    console.error("Failed to toggle plugin:", err);
  }
}

export function getPluginByName(name) {
  let result = null;
  plugins.subscribe((value) => {
    result = value.find((p) => p.name === name);
  })();
  return result;
}
