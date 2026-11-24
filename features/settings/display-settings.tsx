"use client";

import type { ChangeDisplay, DisplayPreferences } from "./display-preferences";
import { SettingsRows } from "./settings-hub";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="settings-control"><strong>{label}</strong><input className="settings-switch" type="checkbox" role="switch" checked={checked}
    onChange={(event) => onChange(event.target.checked)} /></label>;
}

export function DisplaySettings({ display, change, modules }: { display: DisplayPreferences; change: ChangeDisplay; modules?: boolean }) {
  if (modules) return <>
    <SettingsRows title="底栏功能">
      <Toggle label="饮食" checked={display.nutrition} onChange={(value) => change("nutrition", value)} />
      <Toggle label="好友与搭子" checked={display.social} onChange={(value) => change("social", value)} />
    </SettingsRows>
    <p className="settings-footnote">隐藏入口会保留你的记录和分享设置。这些选项应用于当前浏览器。</p>
  </>;
  return <>
    <SettingsRows title="外观">
      <label className="settings-control"><strong>主题</strong><select value={display.theme}
        onChange={(event) => change("theme", event.target.value as DisplayPreferences["theme"])}>
        <option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option>
      </select></label>
      <label className="settings-control"><strong>强调色</strong><select value={display.accent}
        onChange={(event) => change("accent", event.target.value as DisplayPreferences["accent"])}>
        <option value="lime">青柠</option><option value="mint">薄荷</option><option value="blue">天空蓝</option><option value="violet">丁香紫</option>
      </select></label>
      <label className="settings-control"><strong>字号</strong><select value={display.text}
        onChange={(event) => change("text", event.target.value as DisplayPreferences["text"])}>
        <option value="compact">紧凑</option><option value="normal">标准</option><option value="large">大字</option>
      </select></label>
      <Toggle label="界面过渡动效" checked={display.motion} onChange={(value) => change("motion", value)} />
    </SettingsRows>
    <SettingsRows title="首页">
      <Toggle label="显示云端连接状态" checked={display.cloud} onChange={(value) => change("cloud", value)} />
      <Toggle label="显示近 7 天打卡" checked={display.weeklyCheckins} onChange={(value) => change("weeklyCheckins", value)} />
      <Toggle label="显示添加计划捷径" checked={display.planShortcuts} onChange={(value) => change("planShortcuts", value)} />
    </SettingsRows>
    <p className="settings-footnote">这些选项应用于当前浏览器。</p>
  </>;
}
