/**
 * Convert a constituency name to a URL-safe slug.
 *
 * Handles commas, apostrophes, and whitespace so that names like
 * "Midlothian South, Tweeddale and Lauderdale" become
 * "midlothian-south-tweeddale-and-lauderdale".
 */
export function slugifyConstituency(name: string): string {
  return name
    .toLowerCase()
    .replace(/, /g, "-")
    .replace(/,/g, "")
    .replace(/\s+/g, "-")
    .replace(/'/g, "")
    .replace(/-{2,}/g, "-");
}
