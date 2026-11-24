"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { catalogAsset } from "./open-gym";
import { MotionCanvas } from "./motion-canvas";
import { slowFrameMs, type Illustration } from "./motion-data";

type Motion = { viewBox: string; frames: { paths: string[]; transform: string }[]; sequence: number[]; ms: number };

const poseOrder = ["01", "02", "03", "02"];

export function ExerciseAnimation({ id, name, illustration, poseSlug }: {
  id?: string; name: string; illustration?: Illustration; poseSlug?: string;
}) {
  const [data, setData] = useState<Motion>();
  const [error, setError] = useState(false);
  const [poseError, setPoseError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(!preference.matches);
    const pauseOnPreference = (event: MediaQueryListEvent) => { if (event.matches) setPlaying(false); };
    preference.addEventListener("change", pauseOnPreference);
    return () => preference.removeEventListener("change", pauseOnPreference);
  }, []);
  useEffect(() => {
    if (!id || !/^\d{4,6}$/.test(id)) return;
    let active = true;
    catalogAsset<Motion>("flow/" + id + ".json").then((value) => { if (active) setData(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [id]);
  const showPoses = Boolean(poseSlug && (!id || error) && !poseError);
  const frameCount = data?.sequence.length ?? (showPoses ? poseOrder.length : 0);
  const delay = data ? slowFrameMs(data.ms) : 950;
  useEffect(() => {
    if (!frameCount || !playing) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") setPosition((value) => (value + 1) % frameCount);
    }, delay);
    return () => clearInterval(interval);
  }, [frameCount, playing, delay]);

  const frame = data?.frames[data.sequence[position] ?? 0];
  const drawn = (!id || error) && !showPoses ? illustration : undefined;
  const failed = (error || poseError) && !showPoses && !drawn;
  const ready = Boolean(frame || showPoses || drawn);
  return <figure className="catalogue-animation">
    <div className="catalogue-animation-stage">
      {data && frame ? <svg viewBox={data.viewBox} role="img" aria-label={name + "动作示意"}><g transform={frame.transform} fill="#f4f2ed">
        {frame.paths.map((path, i) => <path key={i} d={path} />)}
      </g></svg> : showPoses ? <div className="catalogue-animation-poses" role="img" aria-label={name + "动作示意"}>
        {["01", "02", "03"].map((number) => <img key={number} src={"/open-gym/workout-guide/" + poseSlug + "/" + number + ".svg"}
          alt="" data-current={number === (poseOrder[position] ?? poseOrder[0]) || undefined} onError={() => setPoseError(true)} />)}
      </div> : drawn ? <MotionCanvas motion={drawn} name={name} playing={playing} /> :
        id && !error && <img src={"/open-gym/thumb/" + id + ".svg"} alt={name + "开始姿势"} />}
    </div>
    {(ready || failed) && <figcaption>
      {failed && <span role="status">动作示意暂时无法加载</span>}
      {showPoses && <a className="catalogue-attribution" href="/open-gym/workout-guide/CREDITS.txt" target="_blank" rel="noreferrer">图源与许可</a>}
      {drawn?.reference && <span>参考练法</span>}
      {ready && <button type="button" className="button subtle small" onClick={() => setPlaying(!playing)} aria-label={playing ? "暂停动作示意" : "播放动作示意"}>
        {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "暂停" : "播放"}
      </button>}
    </figcaption>}
  </figure>;
}
