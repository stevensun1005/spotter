import Link from "next/link";

export const metadata = { title: "应用支持 · 训练搭子" };

export default function SupportPage() {
  return <div className="app"><main className="content content-today">
    <article className="card padded feature-stack">
      <h1>训练搭子支持</h1>
      <p>登录、账号绑定、同步和训练记录遇到问题时，可以通过训练搭子的 GitHub 项目提交问题。请附上 App 版本、手机系统版本以及出错的操作步骤。</p>
      <p>GitHub 工单公开可见。提交前请移除邮箱、访问码、健康记录、设备令牌及含有这些内容的截图。</p>
      <p><a href="https://github.com/stevensun1005/spotter/issues" target="_blank" rel="noreferrer">联系训练搭子项目</a></p>
      <p><Link href="/privacy">阅读隐私说明</Link></p>
    </article>
  </main></div>;
}
