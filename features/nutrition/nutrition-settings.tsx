"use client";

import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Database, Grid2X2, HeartPulse, ListOrdered, PieChart } from "lucide-react";
import { SettingsLink, SettingsRows } from "@/features/settings/settings-hub";
import { Dialog } from "@/shared/ui";
import { clearNutritionCache } from "./nutrition-cache";
import { NutritionCopy } from "./nutrition-copy";
import { NutritionGoalsSettings, type NutritionPlanner, type SaveTargets, type TargetsRow } from "./nutrition-goals-settings";
import { nutritionShortcuts, useNutritionPreferences } from "./nutrition-preferences";

const pageTitles = {
  menu: "饮食设置", goals: "营养素设置", copy: "复制过往记录", shortcuts: "首页快捷按钮",
  order: "餐次顺序", health: "Apple 健康同步", cache: "本地数据缓存",
} as const;
type SettingsPage = keyof typeof pageTitles;

function SettingToggle({ label, checked, update, disabled }: { label: string; checked: boolean; update: (value: boolean) => void; disabled?: boolean }) {
  return <label className="settings-control"><strong>{label}</strong><input className="settings-switch" type="checkbox" role="switch"
    checked={checked} disabled={disabled} onChange={(event) => update(event.target.checked)} /></label>;
}

export function NutritionSettings({ owner, enabled, date, today, targets, readyToEditTargets = true, initialPage = "menu", onSaveTargets, onReload, onClose,
  onBody, onWeight, onDevices, onPlanning }: {
  owner: string; enabled: boolean; date: string; today: string; targets?: TargetsRow; readyToEditTargets?: boolean; initialPage?: "menu" | "goals";
  onSaveTargets: SaveTargets; onReload: () => void; onClose: () => void; onBody: () => void;
  onWeight?: () => void; onDevices?: () => void; onPlanning?: (tool: NutritionPlanner) => void;
}) {
  const [page, setPage] = useState<SettingsPage>(initialPage);
  const [status, setStatus] = useState("");
  const { preferences, update } = useNutritionPreferences(owner);

  function open(next: SettingsPage) {
    setStatus("");
    setPage(next);
  }

  function moveMeal(index: number, offset: number) {
    const order = [...preferences.mealOrder];
    const adjacent = index + offset;
    if (!order[index] || !order[adjacent]) return;
    [order[index], order[adjacent]] = [order[adjacent], order[index]];
    update({ mealOrder: order });
  }

  return <Dialog title={pageTitles[page]} onClose={onClose} className="nutrition-settings-dialog">
    <div className="dialog-body feature-stack">
      {page !== "menu" && initialPage === "menu" && <button type="button" className="settings-back" onClick={() => open("menu")}>
        <ArrowLeft size={18} aria-hidden="true" />饮食设置</button>}
      {page === "menu" && <>
        <SettingsRows title="记录与目标">
          <SettingsLink label="复制过往记录" detail="选一天的饮食和饮水记录" icon={Copy} onClick={() => open("copy")} />
          <SettingsLink label="营养素比例" detail="热量、宏量营养素、饮水和体重目标" icon={PieChart} onClick={() => open("goals")} />
        </SettingsRows>
        <SettingsRows title="显示与搜索">
          <SettingsLink label="首页快捷按钮" icon={Grid2X2} onClick={() => open("shortcuts")} />
          <SettingsLink label="餐次顺序" icon={ListOrdered} onClick={() => open("order")} />
          <SettingToggle label="运动消耗卡片" checked={preferences.showExerciseCard} update={(showExerciseCard) => update({ showExerciseCard })} />
          <SettingToggle label="快捷工具栏" checked={preferences.showToolbar} update={(showToolbar) => update({ showToolbar })} />
          <label className="settings-control"><strong>食物搜索</strong><select aria-label="食物搜索" value={preferences.foodSearch}
            onChange={(event) => update({ foodSearch: event.target.value === "all" ? "all" : "recommended" })}>
            <option value="recommended">优先常用</option><option value="all">全部食物</option>
          </select></label>
        </SettingsRows>
        <SettingsRows title="数据管理">
          <SettingsLink label="Apple 健康同步" icon={HeartPulse} onClick={() => open("health")} />
          <SettingsLink label="本地数据缓存" icon={Database} detail={preferences.cacheEnabled ? "此设备已开启" : "此设备已关闭"} onClick={() => open("cache")} />
        </SettingsRows>
      </>}
      {page === "goals" && <NutritionGoalsSettings key={String(readyToEditTargets)} owner={owner} enabled={enabled} readyToEdit={readyToEditTargets}
        today={today} targets={targets} onSaveTargets={onSaveTargets}
        onBody={onBody} onWeight={onWeight} onPlanning={onPlanning} />}
      {page === "copy" && <NutritionCopy enabled={enabled} date={date} today={today} onReload={onReload} />}
      {page === "shortcuts" && <SettingsRows title="首页显示">
        {nutritionShortcuts.map((key) => <SettingToggle key={key} label={key === "体重" ? "记体重" : key} checked={preferences.homeShortcuts.includes(key)}
          update={(visible) => update({ homeShortcuts: nutritionShortcuts.filter((shortcut) => shortcut === key ? visible : preferences.homeShortcuts.includes(shortcut)) })} />)}
      </SettingsRows>}
      {page === "order" && <ol className="settings-rows nutrition-meal-order" aria-label="餐次顺序">{preferences.mealOrder.map((meal, index) =>
        <li className="settings-control" key={meal}>
          <strong>{meal}</strong><span>
            <button type="button" className="icon-button" aria-label={`上移${meal}`} disabled={index === 0} onClick={() => moveMeal(index, -1)}><ArrowUp size={17} aria-hidden="true" /></button>
            <button type="button" className="icon-button" aria-label={`下移${meal}`} disabled={index === preferences.mealOrder.length - 1}
              onClick={() => moveMeal(index, 1)}><ArrowDown size={17} aria-hidden="true" /></button>
          </span>
        </li>)}</ol>}
      {page === "health" && <section className="feature-stack">
        <p className="muted">饮食和饮水的 Apple 健康同步需要 iPhone 原生应用授权。网页的「手表与健康」支持快捷指令及健康文件导入训练心率。</p>
        {onDevices && <button type="button" className="button outline" onClick={() => { onClose(); onDevices(); }}><HeartPulse size={17} aria-hidden="true" /> 打开手表与健康</button>}
      </section>}
      {page === "cache" && <section className="feature-stack">
        <SettingsRows><SettingToggle label="在本设备缓存饮食" checked={preferences.cacheEnabled} disabled={!enabled}
          update={(cacheEnabled) => { update({ cacheEnabled }); if (!cacheEnabled) clearNutritionCache(owner); setStatus(""); }} /></SettingsRows>
        <p className="muted">开启后保存最近查看的 14 天饮食、饮水和营养目标，供暂时离线时查看。</p>
        <button type="button" className="button outline" disabled={!enabled} onClick={() => { clearNutritionCache(owner); setStatus("已清除本地缓存。"); }}>
          清除本地缓存</button>
        {status && <p className="muted" role="status">{status}</p>}
      </section>}
    </div>
  </Dialog>;
}
