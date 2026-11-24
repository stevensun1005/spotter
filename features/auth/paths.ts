export const signInEndpoint = "/api/auth/sign-in";
export const signOutEndpoint = "/api/auth/sign-out";
const signInPage = "/sign-in";
const validationOrigin = "https://spotter.invalid";

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") ||
      value.length > 1_024 || /[\\\x00-\x1f\x7f]/.test(value)) return "/";
  const url = new URL(value, validationOrigin);
  if (url.origin !== validationOrigin || url.pathname.startsWith("//") || /%(?:2f|5c)/i.test(url.pathname) ||
      url.pathname === signInPage || url.pathname.startsWith(signInPage + "/") ||
      url.pathname === "/api" || url.pathname.startsWith("/api/")) return "/";
  return url.pathname + url.search + url.hash;
}

export function signInPath(returnTo = "/") {
  return signInPage + "?return_to=" + encodeURIComponent(safeReturnPath(returnTo));
}
