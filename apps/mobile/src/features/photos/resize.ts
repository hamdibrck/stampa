export const MAX_EDGE = 2048;
export const JPEG_QUALITY = 0.8;

/** Target size so that the long edge is at most `maxEdge`; never upscales. */
export function targetSize(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge || long === 0) return { width, height };
  const scale = maxEdge / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Storage path: <user id>/<city id>/<uuid>.jpg — the server validates this shape. */
export function photoPath(userId: string, cityId: number, uuid: string): string {
  return `${userId}/${cityId}/${uuid}.jpg`;
}

/** Whether the client should offer an upload or the paywall. The server decides for real. */
export function canAddPhoto(used: number, quota: number | null): boolean {
  return quota === null || used < quota;
}
