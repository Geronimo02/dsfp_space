/**
 * Centralized logger utility
 * Prevents console.logs in production
 */

const isDev = import.meta.env.DEV;
const isTest = import.meta.env.MODE === 'test';

export const logger = {
  /**
   * Debug level logging - only in development
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info level logging - only in development
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * Warning level logging - always logged
   */
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Error level logging - always logged
   */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Performance logging - only in development
   */
  performance: (label: string, fn: () => void) => {
    if (isDev) {
      const start = performance.now();
      fn();
      const end = performance.now();
      console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
    } else {
      fn();
    }
  },

  /**
   * Group logging - only in development
   */
  group: (label: string, fn: () => void) => {
    if (isDev) {
      console.group(label);
      fn();
      console.groupEnd();
    }
  },

  /**
   * Table logging - only in development
   */
  table: (data: unknown) => {
    if (isDev) {
      console.table(data);
    }
  },
};

/**
 * Assert function for development
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    if (isDev || isTest) {
      throw new Error(`Assertion failed: ${message}`);
    } else {
      logger.error(`Assertion failed: ${message}`);
    }
  }
}
