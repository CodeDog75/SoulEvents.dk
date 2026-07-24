const publicReturnPrefixes = ["/", "/event", "/events", "/categories", "/facilitators", "/arrangor"];
const blockedReturnPrefixes = ["/admin", "/api", "/auth", "/facilitator"];

export function safePublicReturnPath(value: string | null | undefined, currentPath?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "https://soulevents.local");
    const href = url.pathname + url.search + url.hash;

    if (url.origin !== "https://soulevents.local") return null;
    if (currentPath && href === currentPath) return null;
    if (blockedReturnPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix + "/"))) {
      return null;
    }
    if (!publicReturnPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix + "/"))) {
      return null;
    }

    return href;
  } catch {
    return null;
  }
}

export function withReturnTo(path: string, returnTo: string | null | undefined) {
  const safeReturnTo = safePublicReturnPath(returnTo);
  if (!safeReturnTo) return path;

  const url = new URL(path, "https://soulevents.local");
  url.searchParams.set("return_to", safeReturnTo);

  return url.pathname + url.search + url.hash;
}

export function publicReturnLabel(returnTo: string | null | undefined, fallback = "Tilbage") {
  const safeReturnTo = safePublicReturnPath(returnTo);
  if (!safeReturnTo) return fallback;

  const pathname = new URL(safeReturnTo, "https://soulevents.local").pathname;
  if (pathname === "/") return "Tilbage til forsiden";
  if (pathname.startsWith("/event/") || pathname.startsWith("/events/")) return "Tilbage til eventet";
  if (pathname.startsWith("/categories/")) return "Tilbage til kategorien";
  if (pathname === "/facilitators") return "Tilbage til arrangører";
  if (pathname.startsWith("/facilitators/") || pathname.startsWith("/arrangor/")) return "Tilbage til arrangøren";

  return fallback;
}
