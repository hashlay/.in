/**
 * Lightweight in-memory cache for serverless functions.
 * Uses the global scope so cached data persists across warm invocations
 * on the same Vercel instance. Zero dependencies, zero cost.
 *
 * Usage:
 *   const { getOrSet, invalidate } = require('../config/cache');
 *   const data = await getOrSet('products:featured', 60, () => Product.find(...));
 *   invalidate('products:featured');        // bust one key
 *   invalidate('products:');                // bust all keys starting with "products:"
 */

// Store cache in global so it survives across warm invocations
if (!global.__memCache) {
  global.__memCache = new Map();
}
const cache = global.__memCache;

// Max entries to prevent memory leaks in long-running warm instances
const MAX_ENTRIES = 200;

/**
 * Get cached value or compute + store it.
 * @param {string}   key       Unique cache key
 * @param {number}   ttlSec   Time-to-live in seconds
 * @param {Function} fetcher   Async function that returns the data to cache
 * @returns {*} cached or freshly fetched value
 */
async function getOrSet(key, ttlSec, fetcher) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }

  const data = await fetcher();

  // Evict oldest entries if we're at capacity
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }

  cache.set(key, { data, expiresAt: Date.now() + ttlSec * 1000 });
  return data;
}

/**
 * Invalidate cache entries.
 * - Exact key:  invalidate('products:featured')
 * - Prefix:     invalidate('products:')  → removes all keys starting with "products:"
 */
function invalidate(keyOrPrefix) {
  if (cache.has(keyOrPrefix)) {
    cache.delete(keyOrPrefix);
    return;
  }
  // Prefix-based invalidation
  for (const k of cache.keys()) {
    if (k.startsWith(keyOrPrefix)) {
      cache.delete(k);
    }
  }
}

/**
 * Clear all cached data.
 */
function clearAll() {
  cache.clear();
}

/**
 * Get cache stats (for /api/health debugging).
 */
function stats() {
  return { size: cache.size, maxEntries: MAX_ENTRIES };
}

module.exports = { getOrSet, invalidate, clearAll, stats };
