"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, Bell, CalendarDays, ChevronRight, CircleUserRound, ClipboardList, Dumbbell, FolderArchive,
  Grid2X2, Info, Package, Palette, Plug, Ruler, Search, Sparkles, Speaker, Watch, Wrench, X,
} from "lucide-react";

const pages = {
  account: { title: "账号", description: "个人资料、云端同步和隐私", keywords: "性别 肌群图 登录 退出 搭子 好友 分享 教练 sync account", icon: CircleUserRound, tone: "slate" },
  workout: { title: "训练", description: "记录方式、默认值和训练画面", keywords: "屏幕常亮 组间休息 动画 蛋白粉 RPE workout", icon: Dumbbell, tone: "green" },
  proteinWarehouse: { title: "蛋白粉仓库", description: "常喝的蛋白粉、一勺粉量和杯量", keywords: "品牌 补剂 乳清 奶昔 克 毫升 protein powder", icon: Package, tone: "teal" },
  advanced: { title: "微调", description: "训练记录的进阶偏好", keywords: "键盘 自动 完成 收起 跳过 advance collapse", icon: Wrench, tone: "slate" },
  alerts: { title: "计时提醒", description: "休息结束时的提示方式", keywords: "休息 音效 声音 震动 振动 闪屏 rest timer sound vibrate", icon: Speaker, tone: "rose" },
  schedule: { title: "计划与日程", description: "休息日、训练周期和计划导入", keywords: "请假 顺延 时间 周 日期 template plan schedule", icon: CalendarDays, tone: "orange" },
  planImport: { title: "粘贴已有内容", description: "训练文本、视频链接和计划 JSON", keywords: "手动 导入 拷贝 黏贴 上传 训练计划 import paste", icon: ClipboardList, tone: "orange" },
  reminders: { title: "提醒", description: "待训练日程与提醒方式", keywords: "打卡 跳过 通知 提醒 notification reminders", icon: Bell, tone: "red" },
  units: { title: "单位与语言", description: "配重单位和动作名称", keywords: "kg lb 公斤 磅 中文 英文 units language", icon: Ruler, tone: "teal" },
  equipment: { title: "器械", description: "常用器械和 GoodLife 替换条件", keywords: "健身房 哑铃 杠铃 卧推凳 支架 龙门架 gear equipment", icon: Dumbbell, tone: "indigo" },
  appearance: { title: "外观与首页", description: "主题、强调色、字号和首页", keywords: "颜色 深色 暗色 动效 排版 界面 theme dark", icon: Palette, tone: "violet" },
  modules: { title: "模块", description: "选择底栏显示的功能", keywords: "导航 底栏 隐藏 功能 tabs modules", icon: Grid2X2, tone: "blue" },
  watches: { title: "手表与健康", description: "Apple Watch、Garmin 和 WHOOP", keywords: "苹果 健康 心率 FIT TCX 快捷指令 wearables health", icon: Watch, tone: "slate" },
  integrations: { title: "集成", description: "健康数据、AI 工具和文件导入", keywords: "数据 接口 下载 mcp api integrations", icon: Plug, tone: "indigo" },
  ai: { title: "AI 教练", description: "训练对话、计划草稿与 Agent 连接", keywords: "GPT Claude AI Haiku Sonnet 权限 账号识别码 Token 训练草稿", icon: Sparkles, tone: "green" },
  data: { title: "数据与备份", description: "导入、恢复及导出个人数据", keywords: "JSON CSV Excel 上传 导入 保存 backup export", icon: FolderArchive, tone: "blue" },
  about: { title: "关于与更新", description: "刷新网站和添加到主屏幕", keywords: "安装 更新 版本 about update", icon: Info, tone: "slate" },
} as const;
export type SettingsPage = keyof typeof pages;
export const settingsGroups: { title?: string; ids: SettingsPage[] }[] = [
  { title: "训练", ids: ["workout", "proteinWarehouse", "alerts", "schedule", "reminders"] },
  { title: "首选项", ids: ["units", "equipment", "appearance", "modules"] },
  { title: "连接", ids: ["watches", "integrations", "ai"] },
  { ids: ["data", "about"] },
];

export function SettingsRows({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="settings-group">
    {title && <h2>{title}</h2>}
    <div className="settings-rows">{children}</div>
  </section>;
}

export function SettingsLink({ label, detail, onClick, icon: Icon = ClipboardList }: {
  label: string; detail?: string; onClick: () => void; icon?: typeof ClipboardList;
}) {
  return <button type="button" className="settings-row" onClick={onClick}>
    <span className="settings-icon" data-tone="slate"><Icon size={18} aria-hidden="true" /></span>
    <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
    <ChevronRight className="settings-arrow" size={17} aria-hidden="true" />
  </button>;
}

export function SettingsHub({ page, open, close, name, cloud, account, children }: {
  page: SettingsPage | undefined; open: (page?: SettingsPage) => void; close: () => void;
  name: string; cloud: string; account: boolean; children?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current !== page) titleRef.current?.focus({ preventScroll: true });
    previousPage.current = page;
  }, [page]);
  const query = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = (Object.keys(pages) as SettingsPage[]).filter((key) => {
    const { title, description, keywords } = pages[key];
    return query.every((term) => (title + " " + description + " " + keywords).toLowerCase().includes(term));
  });
  const parent = page === "advanced" ? "workout" : page === "planImport" ? "schedule" : undefined;
  function link(id: SettingsPage) {
    const { title, description, icon: Icon, tone } = pages[id];
    return <button type="button" key={id} className="settings-row" onClick={() => open(id)}>
      <span className="settings-icon" data-tone={tone}><Icon size={18} aria-hidden="true" /></span>
      <span><strong>{title}</strong><small>{description}</small></span>
      <ChevronRight className="settings-arrow" size={17} aria-hidden="true" />
    </button>;
  }
  return <section className="settings-hub">
    <button type="button" className="settings-back" onClick={() => page ? open(parent) : close()}>
      <ArrowLeft size={18} aria-hidden="true" />{parent ? pages[parent].title : page ? "设置" : "今日"}
    </button>
    <h1 ref={titleRef} tabIndex={-1}>{page ? pages[page].title : "设置"}</h1>
    {page ? <div className="settings-body" key={page}>{children}</div> : <>
      <div className="settings-search"><Search size={18} aria-hidden="true" />
        <input type="search" aria-label="搜索设置" placeholder="搜索设置" value={search} onChange={(event) => setSearch(event.target.value)} />
        {search && <button type="button" className="icon-button" aria-label="清除设置搜索" onClick={() => setSearch("")}><X size={15} aria-hidden="true" /></button>}
      </div>
      {query.length ? results.length ? <SettingsRows title="搜索结果">{results.map(link)}</SettingsRows> :
        <p className="settings-empty" role="status">没有匹配的设置</p> : <>
        <button type="button" className="settings-account settings-row" onClick={() => open("account")}>
          <span className="settings-account-avatar" aria-hidden="true">{account ? Array.from(name.trim())[0]?.toUpperCase() || "我" : <CircleUserRound size={25} />}</span>
          <span><strong>{account ? name : "登录训练搭子"}</strong><small>{cloud}</small></span>
          <ChevronRight className="settings-arrow" size={18} aria-hidden="true" />
        </button>
        {settingsGroups.map(({ title, ids }) => <SettingsRows key={ids[0]} title={title}>{ids.map(link)}</SettingsRows>)}
      </>}
    </>}
  </section>;
}
