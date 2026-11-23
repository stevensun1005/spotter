"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, ChartNoAxesCombined, ChevronRight, Clock3, Dumbbell, ExternalLink, Film, GitBranch, Pin, Plus, Search, Trash2 } from "lucide-react";
import { Dialog, displayNumber } from "@/shared/ui";
import { errorText } from "@/shared/client";
import type { TrainingEntry } from "@/shared/state";
import { blankProfile, exerciseName, type ExerciseProfile } from "@/features/library/model";
import { guides, exerciseNames, type Muscle } from "./catalog";
import { exerciseHistory } from "./history";
import { ExerciseProgress } from "./progress";
import { Muscles } from "./muscles";

const sections = [
  { id: "guide", label: "要点", icon: BookOpen }, { id: "history", label: "历史", icon: Clock3 },
  { id: "chart", label: "图表", icon: ChartNoAxesCombined }, { id: "versions", label: "版本", icon: GitBranch },
] as const;

export function ExerciseLibrary({ names, profiles, choose }: {
  names: string[]; profiles: ExerciseProfile[]; choose: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "全部">("全部");
  const saved = new Map(profiles.map((item) => [item.name, item]));
  const all = [...new Set([...exerciseNames, ...profiles.map((item) => item.name), ...names])];
  const results = all.filter((name) => {
    const guide = guides[saved.get(name)?.versionOf ?? name];
    return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      (muscle === "全部" || guide?.primary.includes(muscle));
  }).sort((a, b) => Number(Boolean(saved.get(b)?.pinned)) - Number(Boolean(saved.get(a)?.pinned)));
  const muscleFilters = [...new Set(Object.values(guides).flatMap((guide) => guide.primary))];
  return <section className="card padded feature-stack">
    <div className="feature-form-line"><label className="exercise-search"><Search size={18} /><input aria-label="搜索动作" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索动作名称" /></label>
      <select aria-label="按训练部位筛选" value={muscle} onChange={(event) => setMuscle(event.target.value as Muscle | "全部")}><option>全部</option>{muscleFilters.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="exercise-results">
      {results.map((name) => <button className="list-line" type="button" key={name} onClick={() => choose(name)}>
        <span className="tile mint">{saved.get(name)?.pinned ? <Pin size={17} /> : <Dumbbell size={17} />}</span>
        <span><strong>{name}</strong><small>{guides[saved.get(name)?.versionOf ?? name]?.equipment ?? "自定义动作"}</small></span><ChevronRight size={17} />
      </button>)}
    </div>
    {results.length === 0 && <p className="empty-copy">没有符合条件的动作。</p>}
    {exerciseName.safeParse(query).success && !all.includes(query.trim()) && <button className="button outline" type="button" onClick={() => choose(query.trim())}><Plus size={17} /> 创建「{query.trim()}」</button>}
  </section>;
}

export function ExerciseDetail({ name, close, select, profiles, names, logs, owner, save, addToPlan }: {
  name: string; close: () => void; select: (name: string) => void; profiles: ExerciseProfile[]; names: string[];
  logs: TrainingEntry[]; owner: string; save: (profile: ExerciseProfile) => Promise<void>; addToPlan?: (name: string) => void;
}) {
  const profile = profiles.find((item) => item.name === name) ?? blankProfile(name);
  const base = profile.versionOf ?? name;
  const guide = guides[base];
  const [tab, setTab] = useState<typeof sections[number]["id"]>("guide");
  const [note, setNote] = useState(profile.note);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const history = tab === "guide" || tab === "versions" ? [] : exerciseHistory(name, logs, owner);
  async function update(item: ExerciseProfile, complete?: () => void) {
    setBusy(true); setError("");
    try { await save(item); complete?.(); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  function addVersion(event: FormEvent) {
    event.preventDefault();
    const valid = exerciseName.safeParse(version);
    if (!valid.success || [base, ...exerciseNames, ...names, ...profiles.map((item) => item.name)].includes(valid.data)) {
      setError("请输入一个尚未使用的动作名称。"); return;
    }
    void update({ ...blankProfile(valid.data), versionOf: base }, () => select(valid.data));
  }
  function saveVideo(event: FormEvent) {
    event.preventDefault();
    void update({ ...profile, videos: [...profile.videos, { label, url }] }, () => { setLabel(""); setUrl(""); setAddingVideo(false); });
  }
  return <Dialog title={name} className="exercise-dialog" onClose={close}>
    <div className="exercise-tabs" aria-label="动作详情页面">{sections.map(({ id, label, icon: Icon }) =>
      <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setError(""); }}><Icon size={17} /><span>{label}</span></button>)}</div>
    <div className="dialog-body feature-stack">
      {error && <p className="inline-error" role="alert">{error}</p>}
      {tab === "guide" && <>
        {guide?.photos && <img className="exercise-cover" src={guide.photos.cover} alt={guide.photos.label} />}
        <div className="exercise-toolbar"><span>{guide?.equipment ?? "自定义动作"}</span><div>
          {addToPlan && <button type="button" className="button outline small" onClick={() => addToPlan(name)}><Plus size={15} /> 加到新计划</button>}
          <button type="button" className="button outline small" aria-pressed={profile.pinned} disabled={busy} onClick={() => void update({ ...profile, pinned: !profile.pinned })}><Pin size={15} /> {profile.pinned ? "取消置顶" : "置顶"}</button>
        </div></div>
        <section className="card padded feature-stack">
          <div className="section-head"><h3>置顶备注</h3><button type="button" className="button outline small" disabled={busy || note === profile.note} onClick={() => void update({ ...profile, note })}>保存备注</button></div>
          <textarea aria-label="置顶备注" value={note} maxLength={2000} rows={2} onChange={(event) => setNote(event.target.value)} placeholder="记下座椅档位、握距或动作提示" />
        </section>
        <section className="card padded feature-stack">
          <div className="section-head"><h3>自定义视频</h3><button type="button" className="button outline small" disabled={busy || profile.videos.length >= 8} onClick={() => setAddingVideo(!addingVideo)}><Plus size={16} /> {addingVideo ? "取消" : "添加视频"}</button></div>
          {profile.videos.map((video, index) => <div className="exercise-video-row" key={video.url + index}>
            <a href={video.url} target="_blank" rel="noreferrer"><Film size={17} /> {video.label} <ExternalLink size={14} /></a><button type="button" className="icon-button" aria-label={"移除视频 " + video.label} disabled={busy} onClick={() => void update({ ...profile, videos: profile.videos.filter((_, i) => i !== index) })}><Trash2 size={15} /></button>
          </div>)}
          {!profile.videos.length && !addingVideo && <p className="muted">为这个动作保存 YouTube 或 B站视频。</p>}
          {addingVideo && <form className="form-fields" onSubmit={saveVideo}>
            <label>名称／角度<input required maxLength={45} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如 侧面示范" /></label>
            <label>视频链接<input required type="url" maxLength={1200} value={url} onChange={(event) => setUrl(event.target.value.trim())} /></label>
            <button className="button primary small" disabled={busy}>保存视频</button>
          </form>}
        </section>
        <section className="card padded feature-stack"><h3>动作步骤</h3>
          {guide ? <ol className="exercise-steps">{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol> : <p className="muted">这个动作还没有内置步骤，可以在置顶备注里记下自己的要点。</p>}
          {guide?.source && <a className="text-button" href={guide.source} target="_blank" rel="noreferrer">查看完整动作说明 · NASM <ExternalLink size={14} /></a>}
        </section>
        {guide && <Muscles primary={guide.primary} secondary={guide.secondary} />}
        {!!guide?.demonstrations?.length && <section className="card padded feature-stack"><h3>视频讲解与真人示范</h3>
          {guide.demonstrations.map((video) => <a key={video.url} className="list-line demonstration" href={video.url} target="_blank" rel="noreferrer">
            <span className="tile lilac"><Film size={17} /></span><span><strong>{video.label}</strong><small>{video.source}</small></span><ExternalLink size={16} />
          </a>)}
        </section>}
      </>}
      {tab === "history" && (history.length ? history.map((item) => <section className="card padded feature-stack" key={item.id}>
        <div className="section-head"><h3>{item.title}</h3><span className="muted">{item.date}</span></div>
        <p className="muted">容量 {displayNumber(item.volume)} kg · {item.sets.length} 组</p>
        <table className="exercise-sets"><thead><tr><th>组</th><th>实际记录</th><th>估算 1RM</th></tr></thead><tbody>{item.sets.map(({ line, max }, index) => <tr key={index}>
          <td>{line.kind === "warmup" ? "热身" : line.kind === "drop" ? "递减" : index + 1}</td><td>{line.seconds ? line.seconds + " 秒" : displayNumber(line.weight) + " " + item.unit + " × " + line.reps}{line.right && <small>右 {displayNumber(line.right.weight)} {item.unit} × {line.right.reps}</small>}</td><td>{max === null ? "—" : displayNumber(max) + " kg"}</td>
        </tr>)}</tbody></table>
      </section>) : <p className="empty-copy">暂无该动作的完成记录。</p>)}
      {tab === "chart" && <ExerciseProgress history={history} />}
      {tab === "versions" && <section className="card padded feature-stack"><h3>动作版本</h3>
        <p className="muted">给不同器械、握法或幅度建立版本。每个版本分别记训练历史。</p>
        {[base, ...profiles.filter((item) => item.versionOf === base).map((item) => item.name)].map((item) =>
          <button className="list-line" key={item} type="button" onClick={() => select(item)} disabled={item === name}><span>{item}</span>{item === name ? <small>当前版本</small> : <ChevronRight size={16} />}</button>)}
        <form className="form-fields" onSubmit={addVersion}><label>新版本名称<input value={version} maxLength={100} required onChange={(event) => setVersion(event.target.value)} placeholder="例如 杠铃卧推（窄握）" /></label><button className="button primary" disabled={busy}><Plus size={17} /> 创建版本</button></form>
      </section>}
    </div>
  </Dialog>;
}
