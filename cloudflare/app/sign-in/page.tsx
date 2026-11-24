import { safeReturnPath } from "@/features/auth/paths";
import { SignInForm } from "@/features/auth/sign-in-form";
import { OAuthControls } from "@/features/auth/oauth-controls";
import { isSpotterApp, oauthNotice } from "@/features/auth/oauth-ui";
import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ return_to?: string | string[]; auth?: string; account_deleted?: string }> }) {
  const { return_to, auth, account_deleted } = await searchParams;
  const app = isSpotterApp((await headers()).get("user-agent") ?? "");
  return <div className="app"><main className="content content-today">
    <section className="card padded feature-stack">
      <h1>登录训练搭子</h1>
      {(account_deleted === "done" || account_deleted === "apple") && <div className="feature-stack" role="status">
        <p>训练搭子账号已永久删除。</p>
        {account_deleted === "apple" && <p className="muted">如需撤销 Apple 登录授权，请在 iPhone 打开「设置 → 你的姓名 → 通过 Apple 登录」，选择「训练搭子」后点「删除」。</p>}
      </div>}
      <OAuthControls mode="login" notice={oauthNotice(auth)} />
      <p className="muted">已有访问码？先用原账号登录，再到设置绑定登录方式。</p>
      <SignInForm returnTo={safeReturnPath(return_to)} />
      <p className="muted"><Link href="/privacy">隐私说明</Link> · <Link href="/support">应用支持</Link></p>
      {!app && <Link className="button outline" href="/">返回首页</Link>}
    </section>
  </main></div>;
}
