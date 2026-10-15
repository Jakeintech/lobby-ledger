import { trendsPath } from '@/lib/routes';
/** The trends page with a phrase to search in the query string, or the bare page when the phrase is blank. */
export function trendsSearchPath(q: string): string {
  const trimmed = q.trim();
  return trimmed ? `${trendsPath()}?q=${encodeURIComponent(trimmed)}` : trendsPath();
}
