/**
 * Content Loader Service
 * Fetches content from the API. All content requests go through the server.
 */
const cache = new Map();

export async function loadContent(portalId, contentPath) {
  const cacheKey = `${portalId}:${contentPath}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `/api/portals/${encodeURIComponent(portalId)}/content/${contentPath}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${contentPath}: ${resp.status}`);
  const text = await resp.text();
  cache.set(cacheKey, text);
  return text;
}

export async function loadPortalJSON(portalId, contentPath) {
  const text = await loadContent(portalId, contentPath);
  return JSON.parse(text);
}

export async function loadJSON(url) {
  if (cache.has(url)) return cache.get(url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  const data = await resp.json();
  cache.set(url, data);
  return data;
}

export function clearCache() {
  cache.clear();
}
