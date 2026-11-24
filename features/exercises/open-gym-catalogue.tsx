"use client";

import { catalogueCover, catalogueDemo } from "./catalogue-demo";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Dumbbell, Grid2X2, List, Plus, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Dialog } from "@/shared/ui";
import { exerciseName, type ExerciseProfile } from "@/features/library/model";
import { Anatomy } from "./anatomy";
import { equipmentOptions, filterRows, normalizeSearch } from "./catalog-search";
import { catalogueSections, collapseCatalogueRows } from "./catalog-sections";
import { catalogFamilies, variantDetails, type ExerciseFamily } from "./catalog-families";
import { FamilyChooser } from "./family-chooser";
import { catalogueAreas, matchesCatalogueArea } from "./catalogue-areas";
import { groups, label, muscleNames, termMuscles } from "./labels";
import { useCatalogue, type CatalogEntry, type ExerciseChoice } from "./open-gym";
import { canonicalMoveName } from "./move-name";

const viewKey = "spotter:exercise-view";
const gearKey = "spotter:exercise-gear";
const searchPageSize = 40;
const sectionPageSize = 8;
const primaryEquipment = ["barbell", "dumbbell", "kettlebell", "cable"];
const featuredIds = ["0576", "0289", "0025"];

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
  const families = useMemo(() => catalogFamilies(data?.rows ?? []), [data]);
  const demonstrated = useMemo(() => {
    return new Set((data?.rows ?? []).filter((row) => {
      const { id, video, illustration, poseSlug } = catalogueDemo(row);
      return Boolean(id || video || illustration || poseSlug);
    }).map((row) => row.id));
  }, [data]);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(canonicalMoveName(query.trim()));
  const [area, setArea] = useState("");
  const [customName, setCustomName] = useState<string>();
  const [pickVariant, setPickVariant] = useState<{ family: ExerciseFamily; initial: CatalogEntry; quick: boolean }>();
  const [type, setType] = useState("");
  const [equipment, setEquipment] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [cards, setCards] = useState(true);
  const [byMuscle, setByMuscle] = useState(Boolean(sameMuscle));
  const [terms, setTerms] = useState(sameMuscle ? [sameMuscle] : []);
  const [any, setAny] = useState(false);
  const [scope, setScope] = useState("");
  const [gear, setGear] = useState<string[]>([]);
  const [useGear, setUseGear] = useState(true);
  const catalogueId = useId();
  const searchLine = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const [visibleBySection, setVisibleBySection] = useState<Record<string, number>>({});
  useEffect(() => {
    try { setCards(localStorage.getItem(viewKey) !== "list"); setGear(JSON.parse(localStorage.getItem(gearKey) ?? "[]")); }
    catch { /* Browser storage is optional. */ }
  }, []);
  const favorites = useMemo(() => new Set(profiles.filter((profile) => profile.pinned).map(({ name }) => normalizeSearch(name))), [profiles]);
  const chosen = useMemo(() => new Set(names.map(normalizeSearch)), [names]);
  const personal = useMemo(() => [...new Set([...profiles.map(({ name }) => name), ...names].map(canonicalMoveName))], [profiles, names]);
  const source = useMemo(() => {
    if (area === "custom") return [];
    const rows = (data?.rows ?? []).filter((item) => matchesCatalogueArea(item, area));
    if (scope === "favorites") return rows.filter((item) => favorites.has(normalizeSearch(item.name)));
    if (scope === "chosen") return rows.filter((item) => chosen.has(normalizeSearch(item.name)));
    return rows;
  }, [data, area, scope, chosen, favorites]);
  const filters = useMemo(() => filterRows(source, { query: search, part: "", type, equipment,
    terms: byMuscle ? terms : [], any, gear: useGear ? gear : [], families,
  }), [source, search, type, equipment, terms, byMuscle, any, gear, useGear, families]);
  const matched = useMemo(() => {
    const querying = Boolean(search.trim());
    return [...filters.rows].sort((a, b) => {
      const aName = querying || favorites.size ? normalizeSearch(a.name) : "";
      const bName = querying || favorites.size ? normalizeSearch(b.name) : "";
      const pinnedFirst = Number(favorites.has(bName)) - Number(favorites.has(aName));
      const demoFirst = Number(demonstrated.has(b.id)) - Number(demonstrated.has(a.id));
      if (!querying) return pinnedFirst || demoFirst;
      return (filters.score.get(b.id) ?? 0) - (filters.score.get(a.id) ?? 0) ||
        pinnedFirst || Number(chosen.has(bName)) - Number(chosen.has(aName)) || demoFirst;
    });
  }, [filters, favorites, chosen, search, demonstrated]);
  const rows = useMemo(() => collapseCatalogueRows(matched, families, filters.score, favorites, demonstrated),
    [matched, families, filters.score, favorites, demonstrated]);
  const known = useMemo(() => new Set([
    ...(data?.rows ?? []).map((item) => normalizeSearch(item.name)),
    ...[...new Set(families.values())].flatMap((family) => [family.title, ...(family.aliases ?? [])].map(normalizeSearch)),
  ]), [data, families]);
  const custom = (area && area !== "custom") || type || equipment || byMuscle ? [] : personal.filter((name) => !known.has(normalizeSearch(name)) &&
    normalizeSearch(name).includes(normalizeSearch(search)) && (!scope || (scope === "favorites" ? favorites : chosen).has(normalizeSearch(name))));
  const searching = Boolean(search.trim());
  const sections = searching
    ? [{ id: "search", title: "搜索结果", jumpLabel: "", rows, customNames: custom }]
    : catalogueSections(rows, custom, favorites);
  const showJumpRail = sections.length > 1;
  const equipmentAll = useMemo(() => equipmentOptions(data?.rows ?? []), [data]);
  const equipmentChips = [...primaryEquipment.filter((key) => filters.equipmentList.includes(key)),
    ...filters.equipmentList.filter((key) => !primaryEquipment.includes(key))];
  const activeOptions = Number(Boolean(filters.activeType)) + Number(Boolean(filters.activeEquipment)) + Number(byMuscle);
  const familyKey = (id: string) => families.get(id)?.id ?? id;
  const featured = !search && !scope && area !== "custom" && !byMuscle && !filters.activeType && !filters.activeEquipment
    ? [...new Set([
      ...featuredIds.flatMap((id) => rows.find((row) => familyKey(row.id) === familyKey(id)) ?? []),
      ...rows.filter((row) => demonstrated.has(row.id)).slice(0, 3),
    ])].slice(0, 3)
    : [];
  const parsedCustom = exerciseName.safeParse(customName === undefined ? undefined : canonicalMoveName(customName.trim()));
  const customExists = (name: string) => known.has(normalizeSearch(name)) || personal.some((item) => normalizeSearch(item) === normalizeSearch(name));
  const selectedWeights = Object.fromEntries(terms.flatMap(termMuscles).map((key) => [key, 100]));
  function resultsPane() {
    const element = results.current;
    return element && getComputedStyle(element).overflowY === "auto" ? element : undefined;
  }
  const show = (change: () => void) => {
    change();
    setVisibleBySection({});
    const pane = resultsPane();
    if (pane) pane.scrollTop = 0;
  };
  function pickArea(id: string) {
    show(() => {
      setArea(id);
      if (id === "custom") { setType(""); setEquipment(""); setByMuscle(false); }
    });
    const start = searchLine.current;
    if (!resultsPane() && start && start.getBoundingClientRect().top < 0) start.scrollIntoView({ block: "start", inline: "nearest" });
  }

  function jumpTo(id: string) {
    const target = document.getElementById(catalogueId + "-" + id);
    if (!target) return;
    target.focus({ preventScroll: true });
    const pane = resultsPane();
    if (pane) pane.scrollTop += target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 4;
    else target.scrollIntoView({ block: "start", inline: "nearest" });
  }
  const pickTerm = (key: string) => show(() => setTerms((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key]));
  const searchName = exerciseName.safeParse(canonicalMoveName(query.trim()));
  function changeScope(next: string) {
    show(() => {
      setScope(scope === next ? "" : next);
      setArea("");
      setEquipment("");
    });
  }

  function createCustom(event: FormEvent) {
    event.preventDefault();
    if (!parsedCustom.success || customExists(parsedCustom.data)) return;
    setCustomName(undefined);
    choose({ name: parsedCustom.data });
  }

  function chooseExercise(name: string, row?: CatalogEntry, useQuick = false) {
    const family = row && families.get(row.id);
    if (row && family && (picker || useQuick)) {
      setPickVariant({ family, initial: row, quick: useQuick });
      return;
    }
    (useQuick ? quick : choose)?.({ name, catalogueId: row?.id }, row);
  }

  function renderExercise(name: string, row?: CatalogEntry) {
    const family = row && families.get(row.id);
    const caption = family?.title ?? name;
    const match = row && family && filters.score.get(row.id) === 4 && caption !== name
      ? variantDetails(row, family).label : undefined;
    const pinned = favorites.has(normalizeSearch(name));
    const cover = row && catalogueCover(catalogueDemo(row));
    return <div className="catalogue-row" key={family?.id ?? row?.id ?? "own:" + name}>
      <button type="button" className="catalogue-exercise" onClick={() => chooseExercise(name, row)}>
        <span className="catalogue-thumb" aria-hidden="true">{cover
          ? <img src={cover} loading="lazy" alt="" />
          : <Dumbbell size={23} />}</span>
        <span className="catalogue-exercise-text"><strong>{pinned && <Star size={13} fill="currentColor" aria-label="已置顶" />} {caption}</strong>
          <small>{row ? [match ?? label(row.target), label(row.equipment), family && family.variants.length + " 个变式"].filter(Boolean).join(" · ") : "自定义动作"}</small></span>
      </button>
      {quick && <button type="button" className="icon-button catalogue-add"
        aria-label={family ? "选择 " + caption + " 的变式" : "添加 " + name} onClick={() => chooseExercise(name, row, true)}><Plus size={17} /></button>}
    </div>;
  }

  function changeGear(item: string) {
    const next = gear.includes(item) ? gear.filter((value) => value !== item) : [...gear, item];
    try { localStorage.setItem(gearKey, JSON.stringify(next)); } catch { /* Still available in this view. */ }
    show(() => setGear(next));
  }

  const chooser = pickVariant && <FamilyChooser family={pickVariant.family} initial={pickVariant.initial}
    variants={pickVariant.family.variants.filter((row) => matchesCatalogueArea(row, area) &&
      (!filters.activeEquipment || row.equipment === filters.activeEquipment) &&
      (!filters.activeType || row.type === filters.activeType) &&
      (!useGear || !gear.length || row.equipment === "body weight" || gear.includes(row.equipment)))}
    inline={picker} onClose={() => setPickVariant(undefined)}
    onChoose={(row) => {
      setPickVariant(undefined);
      (pickVariant.quick ? quick : choose)?.({ name: row.name, catalogueId: row.id }, row);
    }} />;
  if (picker && chooser) return chooser;

  return <section className="catalogue-browser feature-stack" aria-label={picker ? "动作选择器" : "完整动作库"}>
    <div className="catalogue-search-line" ref={searchLine}>
      <div className="catalogue-search-field">
        <Search size={19} aria-hidden="true" />
        <input value={query} aria-label="搜索动作" enterKeyHint="search" onChange={(event) => show(() => setQuery(event.target.value))} placeholder="搜索动作名称" />
        {query && <button type="button" className="catalogue-clear" aria-label="清除搜索" onClick={() => show(() => setQuery(""))}><X size={17} /></button>}
      </div>
      <button type="button" className="icon-button catalogue-view-switch" aria-label={cards ? "切到列表" : "切到卡片"} aria-pressed={cards} onClick={() => {
        try { localStorage.setItem(viewKey, cards ? "list" : "cards"); } catch { /* Still available in this view. */ }
        setCards(!cards);
      }}>{cards ? <List size={19} /> : <Grid2X2 size={19} />}</button>
      <button type="button" className="icon-button catalogue-new" aria-label={picker ? "手动输入动作" : "新建自定义动作"}
        onClick={() => picker && quick ? quick({ name: "" }) : setCustomName("")}><Plus size={21} /></button>
    </div>
    {error && <div className="inline-error">{error} <button type="button" className="button outline small" onClick={reload}>重试</button></div>}
    <div className="catalogue-layout">
      <div className="catalogue-rail" role="group" aria-label="部位筛选">
        {catalogueAreas.map(({ id, title, children }) => {
          const expanded = Boolean(children && (area === id || children.some((child) => child.id === area)));
          return <div className="catalogue-area" key={id}>
            <button type="button" className="catalogue-area-parent" aria-pressed={area === id}
              aria-expanded={children ? expanded : undefined} onClick={() => pickArea(id)}>
              <span>{title}</span>{children && <ChevronDown size={13} aria-hidden="true" />}
            </button>
            {expanded && <div className="catalogue-subareas" role="group" aria-label={title + "细分"}>
              {children?.map((child) => <button key={child.id} type="button" aria-pressed={area === child.id}
                onClick={() => pickArea(child.id)}>{child.title}</button>)}
            </div>}
          </div>;
        })}
      </div>
      <div className="catalogue-main">
        <div className="catalogue-controls">
          <div className="catalogue-chip-row catalogue-equipment" role="group" aria-label="器械快捷筛选">
            <button type="button" className="catalogue-chip" aria-pressed={scope === "favorites"} onClick={() => changeScope("favorites")}><Star size={14} /> 置顶</button>
            {equipmentChips.map((key) => <button type="button" className="catalogue-chip" key={key}
              aria-pressed={filters.activeEquipment === key} onClick={() => show(() => setEquipment(equipment === key ? "" : key))}>{label(key)}</button>)}
          </div>
          <div className="catalogue-tools">
            <div className="catalogue-scope" role="group" aria-label="动作范围">
              <button type="button" aria-pressed={scope !== "chosen"} onClick={() => show(() => setScope(""))}>精选动作</button>
              <button type="button" aria-pressed={scope === "chosen"} onClick={() => changeScope("chosen")}>{picker ? "已选动作" : "常用动作"}</button>
            </div>
            <button type="button" className="icon-button catalogue-filter" aria-label={activeOptions ? "筛选，已选 " + activeOptions + " 项" : "筛选"}
              aria-haspopup="dialog" onClick={() => setShowFilters(true)}><SlidersHorizontal size={17} /></button>
          </div>
          <div className="catalogue-context">
            {data ? <p className="muted catalogue-match" role="status">{rows.length + custom.length} 个结果</p> :
              !error && <p className="muted catalogue-match" role="status">正在加载动作…</p>}
            {gear.length > 0 && <button type="button" className="catalogue-text-button" onClick={() => show(() => setUseGear(!useGear))}>{useGear ? "显示所有器械" : "只显示我的器械"}</button>}
          </div>
        </div>
        <div className={"catalogue-sections-layout" + (showJumpRail ? " has-jumps" : "")}>
          <div className="catalogue-scroll" ref={results} role="region" aria-label="动作列表" tabIndex={picker ? undefined : 0}>
            {featured.length > 0 && <div className="catalogue-featured" role="group" aria-label="精选推荐">
              {featured.map((row) => renderExercise(row.name, row))}
            </div>}
            {searchName.success && !customExists(searchName.data) &&
              <button className="button outline small catalogue-create-result" type="button" onClick={() => choose({ name: searchName.data })}><Plus size={16} /> 创建「{searchName.data}」</button>}
            {sections.length > 0 && <div className="catalogue-sections">
              {sections.map(({ id, title, rows, customNames }) => {
                const size = searching ? searchPageSize : sectionPageSize;
                const limit = visibleBySection[id] ?? size;
                const count = rows.length + customNames.length;
                return <section className="catalogue-section" key={id} id={catalogueId + "-" + id}
                  tabIndex={-1} aria-label={title}>
                  <div className="catalogue-section-heading"><h3 className="catalogue-section-title">{title}</h3><span>{count} 个</span></div>
                  <div className={"catalogue-results" + (cards ? " catalogue-cards" : "")}>
                    {customNames.slice(0, limit).map((name) => renderExercise(name))}
                    {rows.slice(0, Math.max(0, limit - customNames.length)).map((row) => renderExercise(row.name, row))}
                  </div>
                  {count > limit && <button className="button outline catalogue-section-more" type="button"
                    aria-label={"显示更多 " + title} onClick={() => setVisibleBySection((previous) => ({ ...previous, [id]: limit + size }))}>显示更多</button>}
                </section>;
              })}
            </div>}
            {data && rows.length === 0 && custom.length === 0 && <p className="empty-copy">
              {scope === "favorites" ? "暂无符合条件的置顶动作。" : scope === "chosen" ? "暂无符合条件的动作。" : "当前搜索和筛选条件下没有动作。"}</p>}
            {!picker && <p className="catalogue-attribution"><a href="/open-gym/NOTICE.txt" target="_blank" rel="noreferrer">动作库授权和来源</a> · <a href="/open-gym/catalogue-source.zip" download>下载目录源文件</a></p>}
          </div>
          {showJumpRail && <nav className="catalogue-jumps" aria-label="器械分区导航">
            {sections.map(({ id, title, jumpLabel }) => <button key={id} type="button" title={title}
              aria-label={"跳到 " + title} onClick={() => jumpTo(id)}>{jumpLabel}</button>)}
          </nav>}
        </div>
      </div>
    </div>
    {customName !== undefined && <Dialog title="新建自定义动作" onClose={() => setCustomName(undefined)}>
      <form className="dialog-body form-fields" onSubmit={createCustom}>
        <label>动作名称<input value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={100} required /></label>
        {parsedCustom.success && customExists(parsedCustom.data) && <p className="inline-error">已存在同名动作。</p>}
        <button className="button primary" disabled={!parsedCustom.success || customExists(parsedCustom.data)}>继续</button>
      </form>
    </Dialog>}
    {chooser}
    {showFilters && <Dialog title="筛选" className="catalogue-filter-dialog" onClose={() => setShowFilters(false)}>
      <div className="dialog-body feature-stack">
        <button type="button" className="button outline small" aria-pressed={byMuscle}
          onClick={() => show(() => { setByMuscle(!byMuscle); if (area === "custom") setArea(""); })}>
          {byMuscle ? "关闭肌肉图筛选" : "按肌肉图筛选"}</button>
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
        <button type="button" className="button subtle" onClick={() => show(() => { setType(""); setEquipment(""); setArea(""); setScope(""); setTerms([]); setByMuscle(false); })}>清除筛选</button>
      </div>
    </Dialog>}
  </section>;
}
