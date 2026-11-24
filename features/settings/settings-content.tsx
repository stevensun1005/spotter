"use client";

import type { ReactNode } from "react";
import { CalendarDays, ClipboardList, Download, HeartPulse, Package, RefreshCw, ShieldCheck, UserRound, Users, Watch } from "lucide-react";
import { signInPath, signOutEndpoint } from "@/features/auth/paths";
import type { AnatomyVariant } from "@/features/body/profile";
import type { ChangeDisplay, DisplayPreferences } from "./display-preferences";
import { DisplaySettings } from "./display-settings";
import { EquipmentSettings } from "./equipment-settings";
import { ReminderSettings } from "./reminders";
import { SettingsLink, SettingsRows, type SettingsPage } from "./settings-hub";
import { WeightEntrySettings, WorkoutSettings } from "./workout-settings";

export function SettingsContent({ page, open, owner, cloud, sex, sync, pair, sharing, coaching, body,
  schedule, programs, plans, planImport, latestWorkout, display, changeDisplay, protein, proteinWarehouse, data, agent }: {
  page: SettingsPage | undefined; open: (page: SettingsPage) => void; owner: string; cloud: string; sex?: AnatomyVariant;
  sync: () => void; pair: () => void; sharing?: () => void; coaching: () => void; body: () => void;
  schedule: () => void; programs: () => void; plans: () => void; planImport: ReactNode; latestWorkout?: () => void;
  display: DisplayPreferences; changeDisplay: ChangeDisplay; protein: ReactNode; proteinWarehouse: ReactNode; data: ReactNode; agent: ReactNode;
}) {
  switch (page) {
    case "account": return <>
      <SettingsRows title="账户与同步">
        {owner && <SettingsLink label="性别" detail={sex === "female" ? "女" : sex === "male" ? "男" : "未填写"} icon={UserRound} onClick={body} />}
        {owner && <SettingsLink label="立即同步" detail={cloud} icon={RefreshCw} onClick={sync} />}
        {owner ? <form method="post" action={signOutEndpoint}>
          <button type="submit" className="settings-row">
            <span className="settings-icon" data-tone="slate"><ShieldCheck size={18} aria-hidden="true" /></span>
            <strong>退出当前账号</strong>
          </button>
        </form> : <a className="settings-row" href={signInPath()}>
          <span className="settings-icon" data-tone="slate"><ShieldCheck size={18} aria-hidden="true" /></span>
          <strong>登录训练搭子</strong>
        </a>}
      </SettingsRows>
      <SettingsRows title="关系与隐私">
        <SettingsLink label="搭子空间" icon={Users} onClick={pair} />
        {sharing && <SettingsLink label="好友分享设置" detail="调整好友和搭子可见的数据" icon={ShieldCheck} onClick={sharing} />}
        <SettingsLink label="教练与学员" icon={Users} onClick={coaching} />
      </SettingsRows>
    </>;
    case "workout":
    case "advanced":
    case "alerts": return <WorkoutSettings page={page} navigate={open}>
      {page === "workout" && <>
        {protein}
        <SettingsRows><SettingsLink label="蛋白粉仓库" detail="管理训练打卡可选的款式" icon={Package} onClick={() => open("proteinWarehouse")} /></SettingsRows>
      </>}
    </WorkoutSettings>;
    case "proteinWarehouse": return proteinWarehouse;
    case "schedule": return <>
      <SettingsRows title="排程">
        {owner && <SettingsLink label="个人计划设置" detail="每周休息日和临时休息日期" onClick={schedule} icon={CalendarDays} />}
        <SettingsLink label="训练周期" detail="多周编排、调整和排期预览" onClick={programs} icon={CalendarDays} />
        <SettingsLink label="我的计划与模板" onClick={plans} />
        <SettingsLink label="粘贴已有内容" onClick={() => open("planImport")} icon={Download} />
      </SettingsRows>
      <SettingsRows title="首页周历">
        <label className="settings-control"><strong>每周从哪一天开始</strong>
          <select value={display.firstWeekday} onChange={(event) => changeDisplay("firstWeekday", event.target.value === "sunday" ? "sunday" : "monday")}>
            <option value="monday">周一</option><option value="sunday">周日</option>
          </select>
        </label>
        <label className="settings-control"><strong>每周打卡目标</strong>
          <select value={display.weeklyGoal} onChange={(event) => changeDisplay("weeklyGoal", Number(event.target.value))}>
            <option value={0}>关闭</option>
            {Array.from({ length: 14 }, (_, index) => <option value={index + 1} key={index}>{index + 1} 次</option>)}
          </select>
        </label>
      </SettingsRows>
      <p className="settings-footnote">周历和目标设置保存在当前浏览器。</p>
    </>;
    case "reminders": return <ReminderSettings owner={owner} />;
    case "units": return <>
      <WeightEntrySettings />
      <SettingsRows title="训练统计">
        <label className="settings-control"><strong>1RM 估算公式</strong>
          <select value={display.maxFormula} onChange={(event) => changeDisplay("maxFormula", event.target.value === "brzycki" ? "brzycki" : "epley")}>
            <option value="epley">Epley</option><option value="brzycki">Brzycki</option>
          </select>
        </label>
      </SettingsRows>
      <SettingsRows title="动作名称">
        <label className="settings-control">
          <strong>动作库显示语言</strong>
          <select value={display.exerciseNames} onChange={(e) => changeDisplay("exerciseNames", e.target.value as DisplayPreferences["exerciseNames"])}>
            <option value="zh">中文</option>
            <option value="both">中文及英文</option>
            <option value="en">英文</option>
          </select>
        </label>
      </SettingsRows>
    </>;
    case "equipment": return <EquipmentSettings />;
    case "appearance":
    case "modules": return <DisplaySettings display={display} change={changeDisplay} modules={page === "modules"} />;
    case "watches": return <>
      <SettingsRows title="心率数据">
        {latestWorkout && <SettingsLink label="打开最近一次训练的心率" icon={HeartPulse} onClick={latestWorkout} />}
        <div className="settings-connection"><Watch size={19} /><div><strong>Apple Watch 和 Apple 健康</strong>
          <p>在训练记录的心率区使用 iPhone 快捷指令，或导入 Apple 健康导出的 ZIP／XML。</p></div></div>
        <div className="settings-connection"><Watch size={19} /><div><strong>Garmin</strong>
          <p>用 Garmin Connect 导出该次活动的 FIT 或 TCX 文件，再到训练记录中导入。</p></div></div>
        <div className="settings-connection"><HeartPulse size={19} /><div><strong>WHOOP</strong>
          <p>训练记录可导入 WHOOP CSV 或 ZIP。站点配置授权后，可同步该次活动的已有心率统计。</p></div></div>
      </SettingsRows>
      {owner && !latestWorkout && <p className="settings-footnote">完成第一笔训练后，就可以从训练详情添加那一段的心率。</p>}
    </>;
    case "integrations": return <>
      <SettingsRows title="健康与设备">
        <SettingsLink label="手表与健康" onClick={() => open("watches")} icon={HeartPulse} />
        <SettingsLink label="身体数据" detail="体重、围度和体脂记录" onClick={body} icon={ClipboardList} />
      </SettingsRows>
      <SettingsRows title="数据和 AI">
        <SettingsLink label="Agent 连接与 API" onClick={() => open("ai")} icon={ShieldCheck} />
        <SettingsLink label="导入与备份" onClick={() => open("data")} icon={Download} />
      </SettingsRows>
    </>;
    case "data": return data;
    case "ai": return agent;
    case "planImport": return planImport;
    case "about": return <>
      <SettingsRows title="训练搭子 · Spotter">
        <SettingsLink label="加载网站最新版本" detail="刷新当前浏览器" onClick={() => window.location.reload()} icon={RefreshCw} />
        <a className="settings-row" href="https://github.com/stevensun1005/spotter" target="_blank" rel="noreferrer">
          <span className="settings-icon" data-tone="slate"><ClipboardList size={18} aria-hidden="true" /></span><strong>源码和更新记录</strong>
        </a>
      </SettingsRows>
      <SettingsRows title="添加到主屏幕">
        <div className="settings-connection"><Watch size={19} /><div><strong>iPhone</strong><p>在 Safari 的分享菜单里选择「添加到主屏幕」。</p></div></div>
        <div className="settings-connection"><Download size={19} /><div><strong>Chrome 与 Edge</strong><p>在浏览器菜单选择「安装此网站」或「添加到主屏幕」，如果菜单提供该选项。</p></div></div>
      </SettingsRows>
    </>;
    default: return null;
  }
}
