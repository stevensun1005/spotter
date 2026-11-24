"use client";

import { ChevronLeft, ClipboardList } from "lucide-react";

export function TrainingNotice({ loading, finished, onBack, onDetails }: {
  loading: boolean; finished?: boolean; onBack: () => void; onDetails?: () => void;
}) {
  return <main className="training-page" aria-label="训练记录">
    <div className="training-shell">
      <header className="training-header">
        <button className="button subtle" onClick={onBack}><ChevronLeft size={18} /> 返回</button>
        <h1>训练记录</h1>
      </header>
      <section className="training-notice" aria-live="polite">
        <span className="tile mint"><ClipboardList size={22} /></span>
        <h2>{finished ? "这次训练已打卡" : loading ? "正在读取训练草稿" : "找不到这次训练草稿"}</h2>
        {finished && onDetails && <button className="button primary" onClick={onDetails}>查看打卡</button>}
        {!loading && !finished && <button className="button outline" onClick={onBack}>返回训练计划</button>}
      </section>
    </div>
  </main>;
}
