"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Dumbbell, Grid2X2, List, Plus, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { exerciseName, type ExerciseProfile } from "@/features/library/model";
import { Anatomy } from "./anatomy";
import { equipmentOptions, filterRows, normalizeSearch } from "./catalog-search";
import { groups, label, muscleNames, termMuscles } from "./labels";
import { useCatalogue, type CatalogEntry, type ExerciseChoice } from "./open-gym";

const viewKey = "spotter:exercise-view";
const gearKey = "spotter:exercise-gear";
const pageSize = 40;

type Props = {
  choose: (choice: ExerciseChoice, entry?: CatalogEntry) => void;
  quick?: (choice: ExerciseChoice, entry?: CatalogEntry) => void;
  profiles?: ExerciseProfile[];
  names?: string[];
  sameMuscle?: string;
  picker?: boolean;
};

export function OpenGymCatalogue({ choose, quick, profiles = [], names = [], sameMuscle, picker }: Props) {
  const { data, error, reload } = useCatalogue();
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [part, setPart] = useState("");
  const [type, setType] = useState("");
  const [equipment, setEquipment] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [cards, setCards] = useState(false);
  const [byMuscle, setByMuscle] = useState(Boolean(sameMuscle));
  const [terms, setTerms] = useState(sameMuscle ? [sameMuscle] : []);
  const [any, setAny] = useState(false);
  const [scope, setScope] = useState("");
  const [gear, setGear] = useState<string[]>([]);
  const [useGear, setUseGear] = useState(true);
  const [amount, setAmount] = useState(pageSize);
  useEffect(() => {
    try { setCards(localStorage.getItem(viewKey) === "cards"); setGear(JSON.parse(localStorage.getItem(gearKey) ?? "[]")); }
    catch { /* Browser storage is optional. */ }
  }, []);
  const favorites = useMemo(() => new Set(profiles.filter((profile) => profile.pinned).map(({ name }) => normalizeSearch(name))), [profiles]);
  const chosen = useMemo(() => new Set(names.map(normalizeSearch)), [names]);
  const personal = useMemo(() => [...new Set([...profiles.map(({ name }) => name), ...names])], [profiles, names]);
  const source = useMemo(() => {
    const rows = data?.rows ?? [];
    if (scope === "favorites") return rows.filter((item) => favorites.has(normalizeSearch(item.name)));
    if (scope === "chosen") return rows.filter((item) => chosen.has(normalizeSearch(item.name)));
    return rows;
  }, [data, scope, chosen, favorites]);
  const parts = useMemo(() => [...new Set(data?.rows.map((item) => item.part) ?? [])].sort(), [data]);
  const filters = useMemo(() => filterRows(source, { query: search, part, type, equipment,
    terms: byMuscle ? terms : [], any, gear: useGear ? gear : [],
  }), [source, search, part, type, equipment, terms, byMuscle, any, gear, useGear]);
  const rows = useMemo(() => {
    if (!search.trim() && !favorites.size) return filters.rows;
    return [...filters.rows].sort((a, b) => {
      const av = normalizeSearch(a.name), bv = normalizeSearch(b.name);
      return (filters.score.get(b.id) ?? 0) - (filters.score.get(a.id) ?? 0) ||
        Number(favorites.has(bv)) - Number(favorites.has(av)) ||
        (search.trim() ? Number(chosen.has(bv)) - Number(chosen.has(av)) : 0);
    });
  }, [filters, favorites, chosen, search]);
  const known = useMemo(() => new Set(data?.rows.map((item) => normalizeSearch(item.name)) ?? []), [data]);
  const custom = part || type || equipment || byMuscle ? [] : personal.filter((name) => !known.has(normalizeSearch(name)) &&
    normalizeSearch(name).includes(normalizeSearch(search)) && (!scope || (scope === "favorites" ? favorites : chosen).has(normalizeSearch(name))));
  const equipmentAll = useMemo(() => equipmentOptions(data?.rows ?? []), [data]);
  const activeOptions = Number(Boolean(filters.activeType)) + Number(Boolean(filters.activeEquipment));
  const selectedWeights = Object.fromEntries(terms.flatMap(termMuscles).map((key) => [key, 100]));
  const show = (change: () => void) => { change(); setAmount(pageSize); };
  const pickTerm = (key: string) => show(() => setTerms((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key]));
  const searchName = exerciseName.safeParse(query);
  function changeGear(item: string) {
    const next = gear.includes(item) ? gear.filter((value) => value !== item) : [...gear, item];
    try { localStorage.setItem(gearKey, JSON.stringify(next)); } catch { /* Still available in this view. */ }
    show(() => setGear(next));
  }

  return <section className="catalogue-browser feature-stack" aria-label={picker ? "动作选择器" : "完整动作库"}>
    <div className="section-head">
      <p className="catalogue-count">{data ? new Intl.NumberFormat("zh-CN").format(data.rows.length) + " 个目录动作" : error ? "动作目录" : "正在读取动作目录…"}</p>
      <button type="button" className="button outline small" aria-pressed={byMuscle} onClick={() => show(() => setByMuscle(!byMuscle))}>{byMuscle ? "返回全部部位" : "按肌肉浏览"}</button>
    </div>
    {error && <div className="inline-error">{error} <button type="button" className="button outline small" onClick={reload}>重试</button></div>}
    {byMuscle && <div className="card padded feature-stack">
      <Anatomy weights={selectedWeights} onPick={pickTerm} />
      <div className="catalogue-chip-row wraps" aria-label="肌群选择">{groups.map((group) => <button className="catalogue-chip" type="button" key={group.id}
        aria-pressed={terms.includes("group:" + group.id)} onClick={() => pickTerm("group:" + group.id)}>{group.title}</button>)}</div>
      <div className="catalogue-chip-row wraps" aria-label="单独肌肉选择">{groups.flatMap((group) => group.muscles).map((muscle) =>
        <button className="catalogue-chip" key={muscle} type="button" aria-pressed={terms.includes(muscle)} onClick={() => pickTerm(muscle)}>{muscleNames[muscle]}</button>)}</div>
      <div className="segmented"><button type="button" aria-pressed={!any} onClick={() => show(() => setAny(false))}>同时命中</button>
        <button type="button" aria-pressed={any} onClick={() => show(() => setAny(true))}>任意命中</button>
        <button type="button" onClick={() => show(() => setTerms([]))}>清除肌肉</button></div>
    </div>}
    <div className="catalogue-search-line">
      <label className="exercise-search"><Search size={17} /><input value={query} aria-label="搜索动作" onChange={(event) => show(() => setQuery(event.target.value))} placeholder="搜索中文或英文动作" /></label>
      {query && <button type="button" className="icon-button" aria-label="清除搜索" onClick={() => show(() => setQuery(""))}><X size={16} /></button>}
      <button type="button" className="icon-button" aria-label={cards ? "切到列表" : "切到卡片"} aria-pressed={cards} onClick={() => {
        try { localStorage.setItem(viewKey, cards ? "list" : "cards"); } catch { /* Still available in this view. */ }
        setCards(!cards);
      }}>{cards ? <List size={17} /> : <Grid2X2 size={17} />}</button>
    </div>
    <div className="catalogue-chip-row" aria-label="分类筛选">
      <button type="button" className="catalogue-chip" aria-haspopup="dialog" onClick={() => setShowFilters(true)}><SlidersHorizontal size={16} /> 筛选{activeOptions ? " " + activeOptions : ""}</button>
      {favorites.size > 0 && <button type="button" className="catalogue-chip" aria-pressed={scope === "favorites"} onClick={() => show(() => { setScope(scope === "favorites" ? "" : "favorites"); setPart(""); setEquipment(""); })}>收藏</button>}
      {chosen.size > 0 && <button type="button" className="catalogue-chip" aria-pressed={scope === "chosen"} onClick={() => show(() => { setScope(scope === "chosen" ? "" : "chosen"); setPart(""); setEquipment(""); })}>已选</button>}
      {filters.activeType && <button type="button" className="catalogue-chip" aria-label={"清除 " + label(filters.activeType)} onClick={() => show(() => setType(""))}>{label(filters.activeType)} <X size={13} /></button>}
      {filters.activeEquipment && <button type="button" className="catalogue-chip" aria-label={"清除 " + label(filters.activeEquipment)} onClick={() => show(() => setEquipment(""))}>{label(filters.activeEquipment)} <X size={13} /></button>}
      {parts.map((key) => <button key={key} type="button" className="catalogue-chip" aria-pressed={part === key} onClick={() => show(() => setPart(part === key ? "" : key))}>{label(key)}</button>)}
    </div>
    {picker && <div className="catalogue-chip-row" aria-label="器械快捷筛选">{filters.equipmentList.map((key) => <button type="button" className="catalogue-chip" key={key} aria-pressed={filters.activeEquipment === key} onClick={() => show(() => setEquipment(equipment === key ? "" : key))}>{label(key)}</button>)}</div>}
    {gear.length > 0 && <button type="button" className="button outline small" onClick={() => show(() => setUseGear(!useGear))}>{useGear ? "显示所有器械" : "只显示我的器械"}</button>}
    {data && <p className="muted catalogue-match" role="status">{rows.length + custom.length} 个结果</p>}
    {searchName.success && !known.has(normalizeSearch(searchName.data)) && !personal.includes(searchName.data) &&
      <button className="button outline small" type="button" onClick={() => choose({ name: searchName.data })}><Plus size={16} /> 创建「{searchName.data}」</button>}
    {picker && !query && <button className="button outline small" type="button" onClick={() => quick?.({ name: "" })}><Plus size={16} /> 手动输入动作</button>}
    {custom.map((name) => <div className="catalogue-row" key={"own:" + name}><span className="catalogue-thumb"><Dumbbell size={22} /></span>
      <button className="catalogue-exercise" onClick={() => choose({ name })} type="button"><strong>{name}</strong><small>自定义动作</small></button>
      {quick && <button type="button" className="icon-button" aria-label={"添加 " + name} onClick={() => quick({ name })}><Plus size={17} /></button>}</div>)}
    <div className={"catalogue-results" + (cards ? " catalogue-cards" : "")}>
      {rows.slice(0, amount).map((row) => {
        const selected = { name: row.name, catalogueId: row.id };
        const fav = favorites.has(normalizeSearch(row.name));
        return <div className="catalogue-row" key={row.id}>
          <span className="catalogue-thumb">{row.animation ? <img src={"/open-gym/thumb/" + row.id + ".svg"} loading="lazy" alt="" /> : <Dumbbell size={22} />}</span>
          <button type="button" className="catalogue-exercise" onClick={() => choose(selected, row)}><strong>{fav && <Star size={14} fill="#bc8a36" />} {row.name}</strong>
            <small>{label(row.target)} · {label(row.equipment)}</small></button>
          {quick && <button type="button" className="icon-button" aria-label={"添加 " + row.name} onClick={() => quick(selected, row)}><Plus size={17} /></button>}
        </div>;
      })}
    </div>
    {data && rows.length === 0 && custom.length === 0 && <p className="empty-copy">当前搜索和筛选条件下没有动作。</p>}
    {rows.length > amount && <button type="button" className="button outline" onClick={() => setAmount(amount + pageSize)}>显示更多</button>}
    {!picker && <p className="catalogue-attribution"><a href="/open-gym/NOTICE.txt" target="_blank" rel="noreferrer">动作库授权和来源</a> · <a href="/open-gym/catalogue-source.zip" download>下载目录源文件</a></p>}
    {showFilters && <Dialog title="筛选" className="catalogue-filter-dialog" onClose={() => setShowFilters(false)}>
      <div className="dialog-body feature-stack">
        <h3>动作类型</h3><div className="catalogue-chip-row wraps">
          <button type="button" className="catalogue-chip" aria-pressed={!filters.activeType} onClick={() => show(() => setType(""))}>全部类型</button>
          {filters.typeOptions.map((key) => <button key={key} type="button" className="catalogue-chip" aria-pressed={filters.activeType === key} onClick={() => show(() => setType(key))}>{label(key)}</button>)}
        </div>
        <h3>器械</h3><div className="catalogue-chip-row wraps">
          <button type="button" className="catalogue-chip" aria-pressed={!filters.activeEquipment} onClick={() => show(() => setEquipment(""))}>全部器械</button>
          {filters.equipmentList.map((key) => <button key={key} type="button" className="catalogue-chip" aria-pressed={filters.activeEquipment === key} onClick={() => show(() => setEquipment(key))}>{label(key)}</button>)}
        </div>
        <details className="catalogue-gear"><summary>设置我的器械</summary><p className="muted">勾选后显示你选的器械和自重动作。</p>
          <div className="catalogue-chip-row wraps">{equipmentAll.filter((key) => key !== "body weight").map((key) =>
            <button className="catalogue-chip" type="button" key={key} aria-pressed={gear.includes(key)} onClick={() => changeGear(key)}>{label(key)}</button>)}</div>
        </details>
        <button type="button" className="button primary" onClick={() => setShowFilters(false)}>完成</button>
        <button type="button" className="button subtle" onClick={() => show(() => { setType(""); setEquipment(""); setPart(""); setScope(""); })}>清除筛选</button>
      </div>
    </Dialog>}
  </section>;
}
