import Link from "next/link";

export const metadata = { title: "隐私说明 · 训练搭子" };

export default function PrivacyPage() {
  return <div className="app"><main className="content content-today">
    <article className="card padded feature-stack">
      <h1>训练搭子隐私说明</h1>
      <p>本说明适用于连接 Cloudflare 的训练搭子网页和 iPhone App。</p>
      <h2>账号和同步</h2>
      <p>登录时会处理你的邮箱、显示名称和登录身份标识。训练、计划、饮食、体重及你导入的健康记录关联到你的训练搭子账号，保存在 Cloudflare，供手机和网页同步。绑定 Apple 或 Google 后，两个身份会关联到同一个训练搭子账号。</p>
      <h2>设备和分享</h2>
      <p>相机、照片和语音由你在使用相应功能时授权。设备导入会根据你选择的文件或授权范围读取数据。训练和健康记录由账号权限保护。你可以在设置中管理好友可见内容，也可以撤销外部 Agent 或设备连接。</p>
      <h2>AI 教练</h2>
      <p>使用需要模型处理的功能时，按界面授权将该次任务所需的对话、选定照片或备注发送给 Anthropic。你可以通过应用内的隐私提示了解本次提交范围，也可以使用手动录入。</p>
      <h2>导出和删除</h2>
      <p>系统保存账号记录以提供同步。你可以在「设置 → 导入与备份」导出自己的记录，或在「设置 → 账号」发起删除账号。其他用户已独立保存的计划或记录由他们管理。</p>
      <p><Link href="/support">训练搭子支持</Link></p>
    </article>
  </main></div>;
}
