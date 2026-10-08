/**
 * Server error reporting. Failed requests are logged as one structured line so
 * they can be searched in Vercel logs (`[server-error]`). Request bodies,
 * headers, and cookies are never logged.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string; routerKind: string }
) {
  const err = error as { message?: string; digest?: string; stack?: string } | null;
  console.error(
    "[server-error]",
    JSON.stringify({
      message: String(err?.message || error).slice(0, 500),
      digest: err?.digest,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      routeType: context.routeType,
      stack: err?.stack?.split("\n").slice(0, 6).join("\n")
    })
  );
}
