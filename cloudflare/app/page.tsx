import Dashboard from "./dashboard";
import { getChatGPTUser } from "./chatgpt-auth";
import { asDate } from "./workout";
import { workoutId } from "@/features/heart/server";
import { whoopStatuses, type WhoopStatus } from "@/features/heart/whoop";
import { agentProfileRef } from "@/features/agent/profile";
import { isSpotterApp, oauthNotice } from "@/features/auth/oauth-ui";
import { signInPath } from "@/features/auth/paths";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ heart?: string; whoop?: string; auth?: string }> }) {
  const user = await getChatGPTUser();
  const requiresSignIn = isSpotterApp((await headers()).get("user-agent") ?? "");
  if (!user && requiresSignIn) redirect(signInPath());
  const identity = user && { id: user.userId, name: user.fullName || user.email.split("@")[0] };
  const { heart, whoop, auth } = await searchParams;
  const result = whoopStatuses.find((value): value is WhoopStatus => value === whoop);
  const heartReturn = identity && heart && workoutId.safeParse(heart).success && result ? { id: heart, result } : undefined;
  return <Dashboard key={identity?.id} viewer={identity} requiresSignIn={requiresSignIn} initialDate={asDate()} heartReturn={heartReturn}
    authNotice={identity && (auth === "linked" || auth?.startsWith("link-")) ? oauthNotice(auth) : undefined}
    profileRef={identity ? await agentProfileRef(identity.id) : undefined} />;
}
