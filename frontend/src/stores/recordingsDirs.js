import { writable } from 'svelte/store';

/**
 * The recordings folder currently in use by the active rule-set (e.g. 'active').
 * Set by MockPlugin whenever a rule-set is loaded or the folder is changed.
 */
export const activeRecordingsFolder = writable('active');

// Internal cache: "folder::subPath" → { dirs: string[], files: string[] }
const _cache = new Map();

/**
 * Fetch immediate children (dirs + files) at `subPath` inside `folder`.
 * Results are cached permanently for the session; re-call clearCache() to bust.
 *
 * @param {string} folder   - Top-level recordings folder name (e.g. 'active')
 * @param {string} subPath  - Path within the folder, without leading/trailing slashes
 * @returns {Promise<{ dirs: string[], files: string[] }>}
 */
export async function fetchDirs(folder, subPath = '') {
  const cacheKey = `${folder}::${subPath}`;

  if (_cache.has(cacheKey)) {
    return _cache.get(cacheKey);
  }

  const clean = subPath.replace(/^\/+/, '').replace(/\/+$/, '');
  const url = clean
    ? `/__api/recordings/dirs/${folder}/${clean}`
    : `/__api/recordings/dirs/${folder}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { dirs: [], files: [] };
    const data = await res.json();
    _cache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.error('fetchDirs error:', err);
    return { dirs: [], files: [] };
  }
}

/**
 * Pre-fetch the top-level directories for the given folder and cache them.
 * Call this when a rule-set loads so the first dropdown keystroke is instant.
 *
 * @param {string} folder
 */
export async function prefetchTopLevel(folder) {
  return fetchDirs(folder, '');
}

/**
 * Clear the entire directory cache (e.g. after recordings change on disk).
 */
export function clearDirsCache() {
  _cache.clear();
}
