/** Absolute URL for an app route, honouring the deploy base path (e.g. /vuebox/ on GitHub Pages). */
export function appUrl(path: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
