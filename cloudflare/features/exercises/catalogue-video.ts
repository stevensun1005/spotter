// Exact movement and equipment matches. Licenses are listed in public/open-gym/NOTICE.txt.
const demos: Record<string, string> = {
  "1557": "wger/dumbbell-walking-lunge",
  "5823": "wger/barbell-walking-lunge",
  "4347": "wger/standing-leg-curl",
  "5873": "wger/ez-bar-lying-triceps-extension",
  "1162": "military-press",
  "1163": "lying-floor-leg-raise",
  "1429": "wide-grip-pull-up",
  "3048": "cable-hip-abduction",
  "4222": "neck-tiger-tail",
  "5036": "exercise-ball-leg-curl",
  "7746": "nordic-hamstring-curl",
  "0047": "incline-bench-press",
  "0289": "dumbbell-bench-press",
  "0736": "sit-up",
};

export function catalogueVideo(id: string) {
  const demo = Object.hasOwn(demos, id) && demos[id];
  return demo ? "/open-gym/demo-video/" + demo + ".mp4" : undefined;
}
