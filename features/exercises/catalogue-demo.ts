import { catalogueVideo } from "./catalogue-video";
import type { CatalogEntry } from "./open-gym";
import { catalogueMotion, exerciseMotion, type Illustration } from "./motion-data";
import { paintMotionFrame } from "./motion-drawing";

type ExerciseDemo = { id?: string; illustration?: Illustration; poseSlug?: string; video?: string };

export function catalogueDemo(row: Pick<CatalogEntry, "id" | "name" | "animation">): ExerciseDemo {
  return { ...catalogueMotion(row), video: catalogueVideo(row.id) };
}

export function exerciseDemo(name: string, referenceName: string, row: CatalogEntry | undefined, custom: boolean): ExerciseDemo | undefined {
  const exact = row && catalogueDemo(row);
  const named = custom && exerciseMotion(name, name, referenceName, row?.id);
  if (named && (named.id || named.illustration)) {
    return { id: named.id, illustration: named.illustration ?? exact?.illustration, poseSlug: undefined, video: undefined };
  }
  return exact;
}

export const videoPoster = (video: string) => video.replace(/\.mp4$/, ".jpg");
export const flowCover = (id: string) => "/open-gym/thumb/" + id + ".svg";
export const poseFrame = (slug: string, frame: string) => "/open-gym/workout-guide/" + slug + "/" + frame + ".svg";

const illustrationCovers = new WeakMap<Illustration, string>();
function illustrationCover(motion: Illustration) {
  const known = illustrationCovers.get(motion);
  if (known) return known;
  const lines: string[] = [];
  paintMotionFrame(motion, 0, (color, width, path) => {
    lines.push('<polyline points="' + path.map((point) => point.join(",")).join(" ") + '" stroke="' + color + '" stroke-width="' + width + '"/>');
  }, (color, radius, [x, y]) => {
    lines.push('<circle cx="' + x + '" cy="' + y + '" r="' + radius + '" fill="' + color + '"/>');
  });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><g fill="none" stroke-linecap="round" stroke-linejoin="round">' + lines.join("") + '</g></svg>';
  const cover = "data:image/svg+xml," + encodeURIComponent(svg);
  illustrationCovers.set(motion, cover);
  return cover;
}

export function catalogueCover(demo: ExerciseDemo | undefined) {
  if (!demo) return;
  if (demo.video) return videoPoster(demo.video);
  if (demo.id) return flowCover(demo.id);
  if (demo.poseSlug) return poseFrame(demo.poseSlug, "01");
  if (demo.illustration) return illustrationCover(demo.illustration);
}
