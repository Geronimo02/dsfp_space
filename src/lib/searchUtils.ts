import { z } from "zod";

/**
 * Schema for validating search queries
 * - Max 100 characters to prevent abuse
 * - Allows alphanumeric, spaces, hyphens, periods, @, and basic punctuation
 */
export const searchQuerySchema = z
  .string()
  .max(100, "Search term is too long")
  .regex(
    /^[a-zA-Z0-9\s\-@._()\u00C0-\u017F]*$/,
    "Search contains invalid characters"
  );

/**
 * Escapes special SQL pattern characters used in ILIKE queries
 * @param input - The user-provided search string
 * @returns Sanitized string safe for SQL pattern matching
 */
export const sanitizeSearchQuery = (input: string): string => {
  // Validate input first
  const validation = searchQuerySchema.safeParse(input);
  if (!validation.success) {
    return "";
  }

  // Escape special SQL pattern characters: %, _, \
  // These have special meaning in LIKE/ILIKE patterns
  return input.replace(/[%_\\]/g, "\\$&").trim();
};
