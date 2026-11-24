import { safeReturnPath } from "@/features/auth/paths";
import { SignInForm } from "@/features/auth/sign-in-form";
import { OAuthControls } from "@/features/auth/oauth-controls";
import { isSpotterApp, oauthNotice } from "@/features/auth/oauth-ui";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ return_to?: string | string[]; auth?: string }> }) {
  const { return_to, auth } = await searchParams;
  const app = isSpotterApp((await headers()).get("user-agent") ?? "");
  return <div className="app"><main className="content content-today">
    <section className="card padded feature-stack">
      <h1>登录训练搭子</h1>
      <OAuthControls mode="login" notice={oauthNotice(auth)} />
      <p className="muted">已有访问码？先用原账号登录，再到设置绑定登录方式。</p>
      <SignInForm returnTo={safeReturnPath(return_to)} />
      {!app && <a className="button outline" href="/">返回首页</a>}
    </section>
  </main></div>;
}
