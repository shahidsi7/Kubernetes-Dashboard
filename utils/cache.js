// utils/cache.js
// This file implements a simple in-memory cache with a Time-To-Live (TTL) mechanism.
// It helps reduce redundant calls to external commands (like kubectl) by storing
// their results for a specified duration.

// The cache object will store data with a timestamp and a TTL.
const cache = {};

/**
 * Retrieves data from the cache if it's fresh and not forced to refresh.
 * @param {string} key - The unique key for the cached item.
 * @param {number} ttl - The Time-To-Live for the cache entry in milliseconds.
 * @param {boolean} [forceRefresh=false] - If true, bypass the cache and force a refresh.
 * @returns {any|null} The cached data if valid, otherwise null.
 */
function getCachedData(key, ttl, forceRefresh = false) {
    const entry = cache[key];
    const now = Date.now();

    // If no entry exists, or forceRefresh is true, or the entry has expired, return null.
    if (!entry || forceRefresh || (now - entry.timestamp > ttl)) {
        return null;
    }

    // If the entry is still fresh, return the data.
    return entry.data;
}

/**
 * Stores data in the cache with the current timestamp.
 * @param {string} key - The unique key for the cached item.
 * @param {any} data - The data to store.
 */
function setCacheData(key, data) {
    cache[key] = {
        data: data,
        timestamp: Date.now()
    };
}

/**
 * Clears a specific item from the cache.
 * @param {string} key - The key of the item to clear.
 */
function clearCacheItem(key) {
    delete cache[key];
}

/**
 * Clears all items from the cache.
 */
function clearAllCache() {
    for (const key in cache) {
        if (cache.hasOwnProperty(key)) {
            delete cache[key];
        }
    }
    console.log("All cache cleared.");
}

module.exports = {
    getCachedData,
    setCacheData,
    clearCacheItem,
    clearAllCache
};
