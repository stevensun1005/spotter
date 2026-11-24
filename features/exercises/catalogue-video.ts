// Vetted movement/equipment pairs from namnq/workout-free-videos v2.0.0 (CC0).
const demos: Record<string, string> = {
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
