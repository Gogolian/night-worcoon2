const API_PATH_PREFIX = "/__api";
const LOCAL_PROXY_PORT = "8079";
const LOCAL_UI_PORTS = new Set(["4173", "5173", "9001"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function isApiPath(pathname = "") {
  return (
    pathname === API_PATH_PREFIX || pathname.startsWith(`${API_PATH_PREFIX}/`)
  );
}

function formatHostname(hostname) {
  if (hostname.includes(":") && !hostname.startsWith("[")) {
    return `[${hostname}]`;
  }

  return hostname;
}

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl);
  }

  if (typeof window === "undefined" || !window.location) {
    return "";
  }

  const { hostname, port } = window.location;
  if (LOOPBACK_HOSTS.has(hostname) && LOCAL_UI_PORTS.has(port)) {
    return `http://${formatHostname(hostname)}:${LOCAL_PROXY_PORT}`;
  }

  return "";
}

function resolveStringUrl(value) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return value;
  }

  if (isApiPath(value)) {
    return `${apiBaseUrl}${value}`;
  }

  if (typeof window === "undefined" || !window.location) {
    return value;
  }

  try {
    const parsedUrl = new URL(value, window.location.origin);
    if (
      parsedUrl.origin === window.location.origin &&
      isApiPath(parsedUrl.pathname)
    ) {
      return `${apiBaseUrl}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }
  } catch {
    // Leave non-URL strings untouched.
  }

  return value;
}

export function resolveApiRequest(input) {
  if (typeof input === "string") {
    return resolveStringUrl(input);
  }

  if (typeof URL !== "undefined" && input instanceof URL) {
    const resolvedUrl = resolveStringUrl(input.toString());
    return resolvedUrl === input.toString() ? input : new URL(resolvedUrl);
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    const resolvedUrl = resolveStringUrl(input.url);
    return resolvedUrl === input.url ? input : new Request(resolvedUrl, input);
  }

  return input;
}

const nativeFetch =
  typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : null;

export function apiFetch(input, init) {
  if (!nativeFetch) {
    throw new Error("Fetch API is not available in this environment");
  }

  return nativeFetch(resolveApiRequest(input), init);
}

export function installApiFetchShim() {
  if (!nativeFetch || globalThis.__nightWorcoonApiFetchInstalled) {
    return;
  }

  globalThis.__nightWorcoonApiFetchInstalled = true;
  globalThis.fetch = (input, init) =>
    nativeFetch(resolveApiRequest(input), init);
}

export async function parseJsonResponse(response, context = "Request") {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    const contentType =
      response.headers?.get?.("content-type") || "unknown content type";
    const looksLikeHtml = /^\s*</.test(responseText);
    const responseUrl = response.url || "the API";
    const extraHint = looksLikeHtml
      ? " It looks like HTML came back instead of JSON, which usually means the frontend reached a static page instead of the Night Worcoon API."
      : "";

    throw new Error(
      `${context} expected JSON from ${responseUrl} but received ${contentType}.${extraHint}`,
    );
  }
}
