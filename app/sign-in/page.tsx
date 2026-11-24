import { safeReturnPath } from "@/features/auth/paths";
import { SignInForm } from "@/features/auth/sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ return_to?: string | string[] }> }) {
  const { return_to } = await searchParams;
  return <div className="app"><main className="content content-today">
    <section className="card padded feature-stack">
      <h1>登录训练搭子</h1>
      <p className="muted">使用获邀的邮箱和专属访问码登录。</p>
      <SignInForm returnTo={safeReturnPath(return_to)} />
      <a className="button outline" href="/">返回首页</a>
    </section>
  </main></div>;
}
