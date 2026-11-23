"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { catalogAsset } from "./open-gym";
import { MotionCanvas } from "./motion-canvas";
import { slowFrameMs, type Illustration } from "./motion-data";

type Motion = { viewBox: string; frames: { paths: string[]; transform: string }[]; sequence: number[]; ms: number };

export function ExerciseAnimation({ id, name, illustration, thumbnail }: {
  id?: string; name: string; illustration?: Illustration; thumbnail?: boolean;
}) {
  const [data, setData] = useState<Motion>();
  const [error, setError] = useState(false);
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
  useEffect(() => {
    if (!data || !playing) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") setPosition((value) => (value + 1) % data.sequence.length);
    }, slowFrameMs(data.ms));
    return () => clearInterval(interval);
  }, [data, playing]);

  const frame = data?.frames[data.sequence[position] ?? 0];
  const drawn = illustration && (!id || error);
  return <figure className="catalogue-animation">
    <div className="catalogue-animation-stage">
      {data && frame ? <svg viewBox={data.viewBox} role="img" aria-label={name + "动作示意"}><g transform={frame.transform} fill="#f4f2ed">
        {frame.paths.map((path, i) => <path key={i} d={path} />)}
      </g></svg> : drawn ? <MotionCanvas motion={illustration} name={name} playing={playing} /> :
        thumbnail && id && <img src={"/open-gym/thumb/" + id + ".svg"} alt={name + "开始姿势"} />}
    </div>
    {(data || drawn || error) && <figcaption>
      {error && !drawn ? <span role="status">动作示意暂时无法加载</span> :
        drawn && illustration.reference && <span>参考练法</span>}
      {(data || drawn) && <button type="button" className="button subtle small" onClick={() => setPlaying(!playing)} aria-label={playing ? "暂停动作示意" : "播放动作示意"}>
        {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "暂停" : "播放"}
      </button>}
    </figcaption>}
  </figure>;
}
