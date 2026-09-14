/**
 * Normalizes a string for matching:
 * lowercase, trim, collapse multiple spaces.
 * NO AI — pure string manipulation.
 */
export function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}


/**
 * Normalizes an array of strings.
 * Filters out empty strings after normalization.
 */
export function normalizeArr(arr: string[]): string[] {
  return arr.map(normalize).filter(Boolean);
}


/**
 * Returns true if the candidate string contains
 * the keyword as a whole word — not as a substring.
 * e.g. keyword "java" should NOT match "javascript"
 */
export function containsWholeWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}