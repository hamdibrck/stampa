/** Share of the world visited: visited cities / all cities (see docs/DECISIONS.md D4). */
export function ratio(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, part / total));
}
