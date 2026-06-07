/**
 * Escapes LIKE-special characters (%, _, \) so user input
 * is treated as literal text inside ilike/like patterns.
 */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}
