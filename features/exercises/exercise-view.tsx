"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BookOpen, ChartNoAxesCombined, ChevronRight, Clock3, ExternalLink, Film, GitBranch, Pin, Plus, Trash2 } from "lucide-react";
import { Dialog, displayNumber } from "@/shared/ui";
import { errorText } from "@/shared/client";
import type { TrainingEntry } from "@/shared/state";
import { blankProfile, exerciseName, type ExerciseProfile } from "@/features/library/model";
import { guides, exerciseNames } from "./catalog";
import { exerciseHistory, type MaxFormula } from "./history";
import { ExerciseProgress } from "./progress";
import { MuscleBreakdown } from "./anatomy";
import { ExerciseAnimation } from "./exercise-animation";
import { exerciseDemo } from "./catalogue-demo";
import { fromCatalogue, useCatalogue, useCatalogDetail, type CatalogEntry, type ExerciseChoice } from "./open-gym";
import { label as translate } from "./labels";
import { exerciseMuscles, researchedGuide } from "./guidance";
import { GuideEditor } from "./guide-editor";
import { ClassificationEditor } from "./classification-editor";
import { customCatalogueEntry, customNameKey } from "./custom-catalogue";
import { equipmentOptions } from "./catalog-search";
import { exerciseTempo, tempoNotationHint } from "./tempo";
import { catalogFamilies, variantDetails } from "./catalog-families";
import { FamilyVariantOptions } from "./family-chooser";

const sections = [
  { id: "guide", label: "要点", icon: BookOpen }, { id: "history", label: "历史", icon: Clock3 },
  { id: "chart", label: "图表", icon: ChartNoAxesCombined }, { id: "versions", label: "版本", icon: GitBranch },
] as const;

type ExerciseDetailProps = {
  choice: ExerciseChoice; close: () => void; select: (choice: ExerciseChoice) => void; profiles: ExerciseProfile[]; names: string[];
  logs: TrainingEntry[]; owner: string; save: (profile: ExerciseProfile) => Promise<void>; addToPlan?: (choice: ExerciseChoice, row?: CatalogEntry) => void;
  maxFormula?: MaxFormula;
};

export function ExerciseDetail({ close, ...props }: ExerciseDetailProps) {
  const { choice, profiles } = props;
  const [variantId, setVariantId] = useState<string>();
  const { data } = useCatalogue();
  const families = useMemo(() => data && catalogFamilies(data.rows), [data]);
  const personalBase = profiles.find((profile) => customNameKey(profile.name) === customNameKey(choice.name))?.versionOf;
  const original = fromCatalogue(data, choice);
  const family = !personalBase && original ? families?.get(original.id) : undefined;
  const item = family?.variants.find((variant) => variant.id === variantId) ?? original;
  const current = item && item.id !== original?.id
    ? { name: item.name, catalogueId: item.id }
    : choice;
  const selected = family && item ? variantDetails(item, family) : undefined;

  return <Dialog title={family?.title ?? choice.name} className="exercise-dialog" onClose={close}>
    {family && item && selected && <div className="exercise-variant-picker">
      <label><span>选择变式</span>
        <select value={item.id} onChange={(event) => setVariantId(event.currentTarget.value)}>
          <FamilyVariantOptions variants={family.variants} family={family} />
        </select>
      </label>
      <p className="exercise-variant-tip" aria-live="polite">
        {item.name !== selected.label && item.name !== family.title && <strong>{item.name}</strong>}
        {selected.tip}
      </p>
    </div>}
    <ExerciseVariantContent key={current.catalogueId ?? current.name} {...props} choice={current} item={item} data={data} />
  </Dialog>;
}

function ExerciseVariantContent({ choice, select, profiles, names, logs, owner, save, addToPlan, item, data, maxFormula }: Omit<ExerciseDetailProps, "close"> & {
  item: CatalogEntry | undefined; data: ReturnType<typeof useCatalogue>["data"];
}) {
  const { name, catalogueId } = choice;
  const profile = profiles.find((item) => customNameKey(item.name) === customNameKey(name)) ?? blankProfile(name);
  const base = profile.versionOf ?? name;
  const detail = useCatalogDetail(item?.id);
  const personal = profile.guide;
  const plannedName = choice.sourceName && researchedGuide(choice.sourceName) ? choice.sourceName : name;
  const plannedGuide = researchedGuide(plannedName);
  const customMove = Boolean(profile.versionOf || choice.sourceName || (plannedGuide && (choice.trainingCategory || !catalogueId))
    || (!item && (!choice.catalogueId || data)));
  const exact = customMove ? undefined : item;
  const guide = customMove ? guides[name] : undefined;
  const referenceName = exact?.name ?? plannedName;
  const reference = customMove ? plannedGuide : undefined;
  const demo = reference?.demoCatalogueId
    ? fromCatalogue(data, { name: referenceName, catalogueId: reference.demoCatalogueId })
    : item;
  const media = exerciseDemo(name, referenceName, demo, customMove);
  const classification = customMove ? customCatalogueEntry(name, profile, data) : undefined;
  const weights = exact && !Object.keys(personal?.muscles ?? {}).length && Object.keys(exact.muscles).length
    ? exact.muscles : exerciseMuscles(referenceName, item, personal);
  const steps = personal?.steps.length ? personal.steps : reference?.steps ?? (detail?.data?.steps.length ? detail.data.steps : guide?.steps);
  const description = personal?.description || reference?.description || detail?.data?.description;
  const cadence = exerciseTempo(choice, item, choice.trainingCategory);
  const [tab, setTab] = useState<typeof sections[number]["id"]>("guide");
  const [note, setNote] = useState(profile.note);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const history = tab === "guide" || tab === "versions" ? [] : exerciseHistory(name, logs, owner, catalogueId, maxFormula);
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
    void update({ ...blankProfile(valid.data), versionOf: base }, () => select({ name: valid.data }));
  }
  function saveVideo(event: FormEvent) {
    event.preventDefault();
    void update({ ...profile, videos: [...profile.videos, { label, url }] }, () => { setLabel(""); setUrl(""); setAddingVideo(false); });
  }
  return <>
    <div className="exercise-tabs" aria-label="动作详情页面">{sections.map(({ id, label, icon: Icon }) =>
      <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setError(""); }}><Icon size={17} /><span>{label}</span></button>)}</div>
    <div className="dialog-body feature-stack">
      {error && <p className="inline-error" role="alert">{error}</p>}
      {tab === "guide" && <>
        {media && (media.video || media.id || media.illustration || media.poseSlug) ? <ExerciseAnimation key={demo?.id ?? referenceName}
          {...media} name={referenceName} /> :
          guide?.photos ? <img className="exercise-cover" src={guide.photos.cover} alt={guide.photos.label} /> :
          item && <p className="muted catalogue-detail-label">此动作暂无已核对的动画。</p>}
        {referenceName !== base && <p className="muted catalogue-detail-label">{referenceName}</p>}
        <div className="exercise-toolbar"><span>{reference?.equipment || (item ? translate(item.equipment) : guide?.equipment ?? "自定义动作")}</span><div>
          {addToPlan && <button type="button" className="button outline small" onClick={() => addToPlan(
            item && !profile.versionOf && !catalogueId ? { ...choice, catalogueId: item.id } : choice, item
          )}><Plus size={15} /> 加入计划</button>}
          <button type="button" className="button outline small" aria-pressed={profile.pinned} disabled={busy} onClick={() => void update({ ...profile, pinned: !profile.pinned })}><Pin size={15} /> {profile.pinned ? "取消置顶" : "置顶"}</button>
        </div></div>
        {classification && <ClassificationEditor current={classification} stored={profile.classification}
          equipment={equipmentOptions([...(data?.rows ?? []), classification])} busy={busy}
          save={(next) => void update({ ...profile, classification: next })} />}
        <section className="card padded feature-stack"><h3>动作步骤</h3>
          <p className="exercise-plan-cue"><strong>{cadence.label}</strong> {cadence.text}
            {cadence.numeric && <small className="exercise-tempo-hint">{tempoNotationHint}</small>}
          </p>
          {description && <p>{description}</p>}
          {choice.cue && <p className="exercise-plan-cue"><strong>本次计划</strong> {choice.cue}</p>}
          {steps?.length ? <ol className="exercise-steps">{steps.map((step, index) => <li key={index}>{step}</li>)}</ol> :
            <p className="muted">{detail?.error ? "暂时无法读取动作步骤，请重新打开详情。" :
              item && !detail ? "正在加载动作步骤…" : "这个动作还没有步骤。你可以补充自己的做法。"}</p>}
          {(reference?.source || guide?.source) && <a className="text-button" href={reference?.source || guide?.source} target="_blank" rel="noreferrer">
            {reference?.sourceLabel || (reference ? "动作参考" : "动作参考 · NASM")} <ExternalLink size={14} />
          </a>}
        </section>
        <MuscleBreakdown weights={weights} emptyLabel={reference && !Object.keys(reference.muscles).length
          ? "此动作以放松和呼吸练习为主。" : undefined} />
        {!item && !reference && !guide && <GuideEditor value={profile.guide} busy={busy}
          save={(next) => void update({ ...profile, guide: { ...next, muscles: Object.fromEntries(
            Object.entries(next.muscles).map(([key, value]) => [key, value === 100 ? 100 : 40])) } })} />}
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
          <button className="list-line" key={item} type="button" onClick={() => select({ name: item, catalogueId: item === base ? catalogueId : undefined })} disabled={item === name}><span>{item}</span>{item === name ? <small>当前版本</small> : <ChevronRight size={16} />}</button>)}
        <form className="form-fields" onSubmit={addVersion}><label>新版本名称<input value={version} maxLength={100} required onChange={(event) => setVersion(event.target.value)} placeholder="例如 杠铃卧推（窄握）" /></label><button className="button primary" disabled={busy}><Plus size={17} /> 创建版本</button></form>
      </section>}
    </div>
  </>;
}
