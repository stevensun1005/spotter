const routePattern = /^\/training\/([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})\/?$/i;

export function workoutAt(path: string) {
  return routePattern.exec(path)?.[1] ?? null;
}
