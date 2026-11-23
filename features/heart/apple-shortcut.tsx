"use client";

import { useEffect, useRef, useState } from "react";
import { Watch } from "lucide-react";
import type { HeartData, TimeWindow } from "./model";
import { shortcutHeart } from "./shortcut-data";

const eventName = "spotter-apple-health";
const selector = "[data-spotter-apple-from][data-spotter-apple-to]";
const readWindow = [
  "const target = document.querySelector('" + selector + "');",
  "completion(target ? { Start: target.dataset.spotterAppleFrom, End: target.dataset.spotterAppleTo } : {});",
].join("\n");
const returnSamples = [
  "const target = document.querySelector('" + selector + "');",
  "const encoded = 'BASE64 魔法变量';",
  "if (!target) { completion('请先在训练详情打开 Apple 健康。'); } else {",
  "  const csv = atob(encoded);",
  "  target.dispatchEvent(new CustomEvent('" + eventName + "', { detail: csv }));",
  "  completion('已送到训练搭子，返回预览并保存。');",
  "}",
].join("\n");

export function AppleShortcut({ window, receive, fail }: {
  window: TimeWindow; receive: (value: HeartData) => void; fail: (message: string) => void;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const [copied, setCopied] = useState("");
  const from = new Date(window.from).toISOString();
  const to = new Date(window.to).toISOString();

  useEffect(() => {
    const target = root.current;
    const handler = (event: Event) => {
      const data: unknown = (event as CustomEvent).detail;
      if (!target?.open || typeof data !== "string") return;
      try { receive(shortcutHeart(data, window)); }
      catch (error) { fail(error instanceof Error ? error.message : "无法读取 Apple 健康心率。"); }
    };
    target?.addEventListener(eventName, handler);
    return () => target?.removeEventListener(eventName, handler);
  }, [window, receive, fail]);

  async function copy(text: string, name: string) {
    try { await navigator.clipboard.writeText(text); setCopied("已复制" + name); }
    catch { setCopied("可在下方选中文字手动复制。"); }
  }

  return <details ref={root} className="heart-help shortcut-help" data-spotter-apple-from={from} data-spotter-apple-to={to}>
    <summary><Watch size={16} /> 从 iPhone 健康读取</summary>
    <p>在 iPhone 的 Safari 打开本页。通过快捷指令读取 Apple 健康里这次训练时段的心率，回到这里预览并保存。</p>
    <details><summary>首次设置快捷指令</summary>
      <ol>
        <li>在「快捷指令」新建「训练搭子心率」，开启在共享表单中显示，输入类型只选「Safari 网页」。在 iPhone 设置的「快捷指令 → 高级」中允许运行脚本。</li>
        <li>加「在网页上运行 JavaScript」，输入选「快捷指令输入」，粘贴下面的读取脚本。获取返回字典的 Start 与 End 值，分别用「获取输入中的日期」转成日期。</li>
        <li>加「查找健康样本」，类型为「心率」，开始日期设在 Start 和 End 之间。关闭限制，按开始日期排序。首次运行时允许读心率。</li>
        <li>加「重复每一项」。对每条样本，获取开始日期和数值，把日期格式化为 ISO 8601，用「文本」输出一行 <code>日期,数值</code>。以换行合并「重复结果」，再用「Base64 编码」，关闭换行。</li>
        <li>再加一次「在网页上运行 JavaScript」，输入仍选最初的「快捷指令输入」。粘贴回传脚本，把引号里的「BASE64 魔法变量」换成上一步的 Base64 编码结果变量。</li>
      </ol>
      <div className="shortcut-scripts">
        {[[readWindow, "读取脚本"], [returnSamples, "回传脚本"]].map(([code, name]) => <div key={name}>
          <button className="button outline small" type="button" onClick={() => void copy(code, name)}>复制{name}</button>
          <textarea aria-label={name} readOnly value={code} rows={3} onFocus={(event) => event.target.select()} />
        </div>)}
      </div>
      {copied && <p role="status">{copied}</p>}
    </details>
    <p>打开此面板后，点 Safari 分享 →「训练搭子心率」。</p>
  </details>;
}
