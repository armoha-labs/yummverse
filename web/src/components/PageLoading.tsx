/** Suspense fallback for a lazy-loaded route chunk — shown only for the brief moment a page's
 * JS is being fetched (near-instant on repeat visits, since the browser caches the chunk).
 * `fullScreen` covers the very first load of a section (its layout is loading too, so there's
 * no shell to nest inside yet); the default fits inside an already-mounted layout's content
 * area when navigating between pages within it. */
export function PageLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div className={fullScreen ? "flex min-h-screen items-center justify-center bg-bg" : "flex min-h-[40vh] items-center justify-center"}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}
