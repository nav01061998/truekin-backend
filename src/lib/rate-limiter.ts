/**
 * In-memory rate limiter with sliding window algorithm
 * For production, use Redis instead
 */

interface RateLimitStore {
  [key: string]: {
    timestamps: number[];
    lastCleanup: number;
  };
}

const store: RateLimitStore = {};

/**
 * Check if request is within rate limit
 * @param key - Unique identifier (userId + endpoint)
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if within limit, false if exceeded
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Initialize if not exists
  if (!store[key]) {
    store[key] = {
      timestamps: [now],
      lastCleanup: now,
    };
    return true;
  }

  const bucket = store[key];

  // Cleanup old timestamps every minute
  if (now - bucket.lastCleanup > 60000) {
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);
    bucket.lastCleanup = now;
  }

  // Remove timestamps outside the window
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  // Check if limit exceeded
  if (bucket.timestamps.length >= limit) {
    return false;
  }

  // Add current timestamp
  bucket.timestamps.push(now);
  return true;
}

/**
 * Get remaining requests for this key
 */
export function getRemainingRequests(key: string, limit: number, windowMs: number): number {
  const now = Date.now();

  if (!store[key]) {
    return limit;
  }

  const bucket = store[key];
  const validTimestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  return Math.max(0, limit - validTimestamps.length);
}

/**
 * Get reset time in seconds
 */
export function getResetTime(key: string, windowMs: number): number {
  const now = Date.now();

  if (!store[key] || store[key].timestamps.length === 0) {
    return 0;
  }

  const oldestTimestamp = Math.min(...store[key].timestamps);
  const resetTime = oldestTimestamp + windowMs;
  const secondsUntilReset = Math.ceil((resetTime - now) / 1000);

  return Math.max(0, secondsUntilReset);
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(key: string): void {
  delete store[key];
}

/**
 * Get all keys in rate limit store
 */
export function getAllKeys(): string[] {
  return Object.keys(store);
}

/**
 * Clear all rate limit data
 */
export function clearAllLimits(): void {
  for (const key in store) {
    delete store[key];
  }
}
