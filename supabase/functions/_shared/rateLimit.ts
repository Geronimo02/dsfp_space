import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, getSupabaseUrl } from "./auth.ts";

const IN_MEMORY_RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

const ENDPOINT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/reports/": { maxRequests: 30, windowMs: 60000 },
  "/exports/": { maxRequests: 10, windowMs: 60000 },
};

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  for (const [key, value] of IN_MEMORY_RATE_LIMIT.entries()) {
    if (now > value.resetAt) {
      IN_MEMORY_RATE_LIMIT.delete(key);
    }
  }
  lastCleanup = now;
}

function getRateLimitConfig(path: string): RateLimitConfig {
  for (const [prefix, config] of Object.entries(ENDPOINT_RATE_LIMITS)) {
    if (path.startsWith(prefix)) return config;
  }
  return DEFAULT_RATE_LIMIT;
}

export async function checkRateLimit(userId: string, path: string): Promise<boolean> {
  cleanupExpired();

  const config = getRateLimitConfig(path);
  const key = `${userId}:${path}`;
  const now = Date.now();

  let entry = IN_MEMORY_RATE_LIMIT.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + config.windowMs };
    IN_MEMORY_RATE_LIMIT.set(key, entry);
    return true;
  }

  if (entry.count >= config.maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export function getRateLimitHeaders(userId: string, path: string): Record<string, string> {
  const config = getRateLimitConfig(path);
  const key = `${userId}:${path}`;
  const entry = IN_MEMORY_RATE_LIMIT.get(key);

  if (!entry) {
    return {
      "X-RateLimit-Limit": String(config.maxRequests),
      "X-RateLimit-Remaining": String(config.maxRequests),
      "X-RateLimit-Reset": String(Math.floor((Date.now() + config.windowMs) / 1000)),
    };
  }

  return {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(Math.max(0, config.maxRequests - entry.count)),
    "X-RateLimit-Reset": String(Math.floor(entry.resetAt / 1000)),
  };
}
