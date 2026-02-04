import { useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
  message?: string;
}

/**
 * Hook to implement rate limiting on functions
 * Prevents spam/abuse of critical operations
 * 
 * @param options Configuration options
 * @returns Object with execute function and reset function
 * 
 * @example
 * const { execute: createInvoice, reset } = useRateLimit({
 *   maxAttempts: 5,
 *   windowMs: 60000, // 1 minute
 *   message: 'Demasiados intentos. Espera un minuto.'
 * });
 * 
 * const handleSubmit = () => {
 *   execute(() => {
 *     // Your operation here
 *   });
 * };
 */
export function useRateLimit(options: RateLimitOptions = {}) {
  const {
    maxAttempts = 10,
    windowMs = 60000, // 1 minute default
    message = 'Demasiados intentos. Por favor, espera un momento.',
  } = options;

  const attemptsRef = useRef<number[]>([]);

  const execute = useCallback(
    async <T,>(fn: () => T | Promise<T>): Promise<T | null> => {
      const now = Date.now();

      // Remove attempts outside the time window
      attemptsRef.current = attemptsRef.current.filter(
        (timestamp) => now - timestamp < windowMs
      );

      // Check if limit exceeded
      if (attemptsRef.current.length >= maxAttempts) {
        const oldestAttempt = attemptsRef.current[0];
        const timeUntilReset = Math.ceil((windowMs - (now - oldestAttempt)) / 1000);
        
        toast.error(
          `${message} Intenta nuevamente en ${timeUntilReset} segundos.`,
          { duration: 3000 }
        );
        
        if (import.meta.env.DEV) {
          console.warn('[useRateLimit] Rate limit exceeded', {
            attempts: attemptsRef.current.length,
            maxAttempts,
            windowMs,
          });
        }
        
        return null;
      }

      // Record this attempt
      attemptsRef.current.push(now);

      // Execute the function
      try {
        return await fn();
      } catch (error) {
        // Re-throw error but keep the attempt recorded
        throw error;
      }
    },
    [maxAttempts, windowMs, message]
  );

  const reset = useCallback(() => {
    attemptsRef.current = [];
  }, []);

  const getRemainingAttempts = useCallback(() => {
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter(
      (timestamp) => now - timestamp < windowMs
    );
    return Math.max(0, maxAttempts - attemptsRef.current.length);
  }, [maxAttempts, windowMs]);

  return { execute, reset, getRemainingAttempts };
}
