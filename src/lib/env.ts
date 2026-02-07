/**
 * Environment variables validation
 * Ensures required env vars are present at build time
 */

interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  MODE: string;
  DEV: boolean;
  PROD: boolean;
}

/**
 * Validate and export environment variables
 * Throws error if required variables are missing
 */
function validateEnv(): Env {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ] as const;

  const missing = requiredVars.filter(
    (varName) => !import.meta.env[varName]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please check your .env file and ensure all required variables are set. ' +
      'See .env.example for reference.'
    );
  }

  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  };
}

export const env = validateEnv();

/**
 * Type-safe access to environment variables
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  return env[key];
}

/**
 * Check if running in development mode
 */
export const isDev = env.DEV;

/**
 * Check if running in production mode
 */
export const isProd = env.PROD;
