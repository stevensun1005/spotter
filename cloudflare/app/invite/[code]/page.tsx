import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "好友邀请 · 训练搭子", robots: { index: false, follow: false },
  referrer: "no-referrer" };

export default async function FriendInvite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-f0-9]{32}$/i.test(code)) notFound();
  const invite = code.toLowerCase();
  return <main className="card padded feature-stack" style={{ maxWidth: "28rem", margin: "10vh auto 2rem" }}>
    <h1>训练搭子好友邀请</h1>
    <p>登录后可以接受邀请，并选择想分享的训练内容。</p>
    <a className="button primary" href={`spotter://friend-invite/${invite}`}>在 App 中打开</a>
    <a className="button outline" href={`/#friend-invite=${invite}`}>在网页上继续</a>
  </main>;
}
