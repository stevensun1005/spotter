import spotterDemoAssets from "./spotter-demo-assets.json" with { type: "json" };

const spotterDemos: Record<string, string> = spotterDemoAssets;

export function spotterCatalogueVideo(id: string) {
  return Object.hasOwn(spotterDemos, id) ? spotterDemos[id] : undefined;
}

export { spotterCatalogueVideo as catalogueVideo };
