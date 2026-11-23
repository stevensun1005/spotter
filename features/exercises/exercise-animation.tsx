"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { catalogAsset } from "./open-gym";

type Motion = { viewBox: string; frames: { paths: string[]; transform: string }[]; sequence: number[]; ms: number };

export function ExerciseAnimation({ id, name, thumbnail }: { id: string; name: string; thumbnail?: boolean }) {
  const [data, setData] = useState<Motion>();
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  useEffect(() => {
    if (!/^\d{4,6}$/.test(id)) return;
    let active = true;
    setPlaying(!matchMedia("(prefers-reduced-motion: reduce)").matches);
    catalogAsset<Motion>("flow/" + id + ".json").then((value) => { if (active) setData(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!data || !playing) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") setPosition((value) => (value + 1) % data.sequence.length);
    }, data.ms);
    return () => clearInterval(interval);
  }, [data, playing]);

  const frame = data?.frames[data.sequence[position] ?? 0];
  return <figure className="catalogue-animation">
    <div className="catalogue-animation-stage">
      {data && frame ? <svg viewBox={data.viewBox} role="img" aria-label={name + "循环动作示意"}><g transform={frame.transform} fill="#f4f2ed">
        {frame.paths.map((path, i) => <path key={i} d={path} />)}
      </g></svg> : thumbnail && <img src={"/open-gym/thumb/" + id + ".svg"} alt={name + "开始姿势"} />}
    </div>
    <figcaption>
      <span>{error ? "循环示意暂时无法加载" : "Flow 循环示意 · CC0"}</span>
      {data && <button type="button" className="button outline small" onClick={() => setPlaying(!playing)} aria-label={playing ? "暂停动作示意" : "播放动作示意"}>
        {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "暂停" : "播放"}
      </button>}
    </figcaption>
  </figure>;
}
