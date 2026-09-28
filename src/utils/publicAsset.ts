/**
 * Files in `public/` are referred to as "/name" (and saved that way in settings and .pp files).
 * Resolve them against the site's base, so the app also works when it is served from a sub-path
 * such as https://<org>.github.io/Visualizer/. Anything else (data:, blob:, http:) passes through.
 */
export function publicAsset(src: string): string {
  if (!src.startsWith("/") || src.startsWith("//")) return src;
  return import.meta.env.BASE_URL + src.slice(1);
}
