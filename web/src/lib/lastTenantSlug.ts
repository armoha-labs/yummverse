const KEY = "yummverse.lastTenantSlug";

/** Authenticated staff routes are slug-free (§32) — this is just a convenience so an
 * unauthenticated visit to e.g. /admin/dashboard can bounce back to the right login page
 * instead of a dead end, remembering whichever tenant was last used on this browser. */
export const lastTenantSlug = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(slug: string): void {
    try {
      localStorage.setItem(KEY, slug);
    } catch {
      // ignore
    }
  },
};
