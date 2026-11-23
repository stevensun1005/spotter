import type { Muscle } from "./catalog";

const front: { name: Muscle; shape: string }[] = [
  { name: "肩部", shape: "shoulder" }, { name: "胸肌", shape: "chest" }, { name: "肱二头肌", shape: "upper-arm" },
  { name: "核心", shape: "core" }, { name: "股四头肌", shape: "thigh" }, { name: "小腿", shape: "calf" },
];
const back: typeof front = [
  { name: "肩部", shape: "shoulder" }, { name: "背部", shape: "back" }, { name: "肱三头肌", shape: "upper-arm" },
  { name: "臀部", shape: "hips" }, { name: "腘绳肌", shape: "thigh" }, { name: "小腿", shape: "calf" },
];
export function Muscles({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  return <section className="card padded">
    <h3>训练部位</h3>
    <div className="muscle-figures" aria-hidden="true">
      {[front, back].map((side, index) => <div key={index}>
        <div className="body-map">
          <span className="body-head" /><span className="body-torso" /><span className="body-arm" /><span className="body-leg" />
          {side.map(({ name, shape }) => <span key={name} className={"muscle-zone muscle-" + shape}
            data-level={primary.includes(name) ? "primary" : secondary.includes(name) ? "secondary" : undefined} />)}
        </div><span className="muted">{index === 0 ? "正面" : "背面"}</span>
      </div>)}
    </div>
    <div className="muscle-key"><span><i /> 主要 · {primary.join("、")}</span>{secondary.length > 0 && <span><i /> 辅助 · {secondary.join("、")}</span>}</div>
  </section>;
}
