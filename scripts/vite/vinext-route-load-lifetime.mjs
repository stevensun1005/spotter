const original = "\troute.__loading = loading;\n\treturn loading;";
const replacement = `	const taggedLoad = Promise.withResolvers();
	void loading.then(taggedLoad.resolve, taggedLoad.reject);
	getRequestExecutionContext()?.waitUntil(taggedLoad.promise.then(() => undefined, () => undefined));
	route.__loading = taggedLoad.promise;
	return taggedLoad.promise;`;

export function patchVinextRouteLoadLifetime(source) {
  const start = source.indexOf(original);
  if (start < 0 || start !== source.lastIndexOf(original) || !source.includes("function ensureAppRouteModulesLoaded(route)")) {
    throw new Error("Vinext route loader changed. Review whether the route-load lifetime backport is still needed.");
  }

  // Backport the request tagging and keepalive from cloudflare/vinext#4567 to the pinned beta loader.
  // Keep only module initialization alive. The request still owns its database calls and response.
  return 'import { getRequestExecutionContext } from "../shims/request-context.js";\n' + source.replace(original, replacement);
}

export function vinextRouteLoadLifetime() {
  return {
    name: "spotter-vinext-route-load-lifetime",
    enforce: "pre",
    apply: "build",
    transform(source, id) {
      const file = id.split("?", 1)[0].replaceAll("\\", "/");
      if (!file.endsWith("/vinext/dist/server/app-route-module-loader.js")) return;
      return { code: patchVinextRouteLoadLifetime(source), map: null };
    },
  };
}
